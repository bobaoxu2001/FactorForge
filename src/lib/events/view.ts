import "server-only";
import fundamentalsFixture from "@/__fixtures__/events/fundamentals.json";
import manifestFixture from "@/__fixtures__/events/manifest.json";
import pricesFixture from "@/__fixtures__/events/prices.json";
import forecastLedger from "@/data/events/forecast-ledger.json";
import thesisLedger from "@/data/events/thesis-ledger.json";
import { ALL_CLAIMS, ALL_EVENTS, ALL_SOURCES, INSTRUMENTS, RESEARCH_CASES, caseBySlug, instrument } from "@/data/events";
import type { ResearchCase } from "@/data/events/types";
import { applyFamily, pooledCoverage, summarize, walkForward, type PooledCoverage, type WalkForwardSummary } from "./evaluation";
import { HORIZONS, MODEL_VERSION, scoreForecast, type ForecastRecord, type ForecastScore, type Horizon } from "./forecast";
import { companyImpacts, measuredCells, validateGraph, type CompanyImpact, type ExposureProfile } from "./impact";
import { canonicalJson, verifyChain, type ChainCheck } from "./ledger";
import { eventStudy, groupReactions, type EventStudy, type GroupReaction, type PriceSeries } from "./market";
import { replayThesis, validateThesis, type MarketObservation, type ThesisReplay, type ThesisRecord } from "./thesis";
import { barCloseInstant, firstReactionIndex, parseInstant, toIso, type MarketCalendar } from "./time";
import type { EventRecord, EventView } from "./types";
import { eventAsOf, validateCase, type ValidationIssue } from "./verification";
import { createHash } from "node:crypto";

/**
 * Server-side assembly of the event-intelligence views from committed data:
 * case files (events, claims, sources, theses), the market snapshot and the
 * two ledgers. Everything is deterministic for a given snapshot, and memoised.
 */

// ── Market data ─────────────────────────────────────────────────────────────

interface RawPrices {
  retrievedAt: string;
  prices: Record<string, { symbol: string; instrumentType: string | null; rows: Array<[string, number, number, number]>; missingCloses: number }>;
}

export interface Fundamentals {
  symbol: string;
  asOf: string;
  trailingPE: number | null;
  forwardPE: number | null;
  evToRevenue: number | null;
  evToEbitda: number | null;
  revenueGrowthYoY: number | null;
  operatingMargin: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  marketCap: number | null;
}

export const SNAPSHOT = manifestFixture as {
  builtAt: string;
  status: string;
  missingRequired: string[];
  counts: Record<string, number>;
  providers: Record<string, string>;
  runLog: Array<{ symbol: string; step: string; status: string; error?: string; last?: string | null; rows?: number; missingCloses?: number }>;
};

/** The platform's "now": when the market snapshot was built. */
export const PLATFORM_AS_OF = SNAPSHOT.builtAt;

const calendarOf = (symbol: string, type: string | null): MarketCalendar => (type === "CRYPTOCURRENCY" || symbol.endsWith("-USD") ? "crypto-utc" : "us-equity");

let seriesCache: Map<string, PriceSeries> | null = null;
export function priceSeries(): Map<string, PriceSeries> {
  if (seriesCache) return seriesCache;
  const raw = pricesFixture as unknown as RawPrices;
  seriesCache = new Map(
    Object.values(raw.prices).map((p) => [
      p.symbol,
      { symbol: p.symbol, calendar: calendarOf(p.symbol, p.instrumentType), dates: p.rows.map((r) => r[0]), adj: p.rows.map((r) => r[2]), volume: p.rows.map((r) => r[3]) },
    ]),
  );
  return seriesCache;
}

export const series = (symbol: string | null) => (symbol ? (priceSeries().get(symbol) ?? null) : null);

/** Last complete bar per calendar: US equities stop at Friday's close while crypto trades through the weekend. */
export function pricesThrough(): { equity: string | null; crypto: string | null } {
  const last = (cal: MarketCalendar) => [...priceSeries().values()].filter((s) => s.calendar === cal).map((s) => s.dates.at(-1)!).sort().at(-1) ?? null;
  return { equity: last("us-equity"), crypto: last("crypto-utc") };
}
export const benchmarkOf = (symbol: string) => instrument(symbol)?.benchmark ?? null;
/** Round-trip cost assumption for judging a directional call: ETFs 5 bp, stocks 10 bp, crypto 20 bp. */
export const instrumentKindCost = (symbol: string) => {
  const kind = instrument(symbol)?.kind;
  return kind === "crypto" ? 20 : kind === "equity" ? 10 : 5;
};
export const fundamentals = (symbol: string) => ((fundamentalsFixture as { fundamentals: Record<string, Fundamentals> }).fundamentals[symbol] ?? null);

// ── Event studies ───────────────────────────────────────────────────────────

export interface WindowView {
  spec: ResearchCase["windows"][number];
  event: EventRecord;
  studies: EventStudy[];
  groups: Record<string, GroupReaction[]>;
  /** Other registered events whose first reaction bar falls inside each window. */
  overlaps: Record<string, Array<{ eventId: string; title: string; date: string }>>;
  /** Other registered events whose first reaction bar falls inside the estimation window. */
  estimationOverlaps: Array<{ eventId: string; title: string; date: string }>;
  /** Day-0 tests run, and how many pass both checks: the false-positive yardstick. */
  day0Tests: { run: number; significant: number; expectedByChance: number };
  /**
   * The same US equities measured against the equal-weight S&P 500 (RSP).
   * When the affected names are a large share of QQQ or SPY, the cap-weighted
   * benchmark absorbs part of the event; this shows how much.
   */
  equalWeight: Record<string, EventStudy>;
}

export const EQUAL_WEIGHT_BENCHMARK = "RSP";

function estimationOverlapsFor(study: EventStudy, eventId: string): WindowView["estimationOverlaps"] {
  const s = series(study.symbol);
  if (!s || !study.model.from || !study.model.to) return [];
  const from = study.model.from;
  const to = study.model.to;
  return ALL_EVENTS.filter((e) => e.id !== eventId)
    .map((e) => ({ e, i: firstReactionIndex(s.dates, parseInstant(e.occurredAt), s.calendar) }))
    .filter(({ i }) => i >= 0 && s.dates[i] >= from && s.dates[i] <= to)
    .map(({ e, i }) => ({ eventId: e.id, title: e.title, date: s.dates[i] }));
}

function overlapsFor(study: EventStudy, eventId: string): WindowView["overlaps"] {
  const s = series(study.symbol);
  const out: WindowView["overlaps"] = {};
  if (!s || !study.day0) return out;
  const day0 = s.dates.indexOf(study.day0);
  for (const w of study.windows) {
    const end = w.endDate ? s.dates.indexOf(w.endDate) : -1;
    out[w.label] = ALL_EVENTS.filter((e) => e.id !== eventId)
      .map((e) => ({ e, i: firstReactionIndex(s.dates, parseInstant(e.occurredAt), s.calendar) }))
      .filter(({ i }) => i >= day0 && end >= 0 && i <= end)
      .map(({ e, i }) => ({ eventId: e.id, title: e.title, date: s.dates[i] }));
  }
  return out;
}

const windowCache = new Map<string, WindowView>();
export function windowView(c: ResearchCase, windowId: string): WindowView | null {
  const key = `${c.id}:${windowId}`;
  if (windowCache.has(key)) return windowCache.get(key)!;
  const spec = c.windows.find((w) => w.id === windowId);
  const event = spec ? c.events.find((e) => e.id === spec.eventId) : undefined;
  if (!spec || !event) return null;
  const studies = spec.symbols
    .map((sym) => {
      const asset = series(sym);
      if (!asset) return null;
      return eventStudy(asset, series(benchmarkOf(sym)), event.occurredAt);
    })
    .filter((s): s is EventStudy => s !== null);
  const groupOf = (sym: string) => c.groups[sym] ?? instrument(sym)?.group ?? "Other";
  const groups = Object.fromEntries(["[0,0]", "[0,1]", "[0,4]", "[0,19]"].map((w) => [w, groupReactions(studies.filter((s) => s.benchmark !== null), groupOf, w)]));
  const longest = studies.find((s) => s.calendar === "us-equity") ?? studies[0];
  const tested = studies.filter((s) => s.benchmark !== null && s.windows[0]?.tStat != null);
  const ew = series(EQUAL_WEIGHT_BENCHMARK);
  const equalWeight: WindowView["equalWeight"] = {};
  if (ew) {
    for (const st of studies) {
      const asset = series(st.symbol);
      if (!asset || st.calendar !== "us-equity" || st.symbol === EQUAL_WEIGHT_BENCHMARK) continue;
      equalWeight[st.symbol] = eventStudy(asset, ew, event.occurredAt);
    }
  }
  const view: WindowView = {
    spec,
    event,
    studies,
    groups,
    overlaps: longest ? overlapsFor(longest, event.id) : {},
    estimationOverlaps: longest ? estimationOverlapsFor(longest, event.id) : [],
    day0Tests: { run: tested.length, significant: tested.filter((s) => s.windows[0].significant).length, expectedByChance: tested.length * 0.05 },
    equalWeight,
  };
  windowCache.set(key, view);
  return view;
}

/** Day-0 tests across every window that measures an event: how many ran, how many passed both checks. */
export function eventReactionSummary(eventId: string): { run: number; significant: number } {
  let run = 0;
  let significant = 0;
  for (const c of RESEARCH_CASES) {
    for (const w of c.windows.filter((x) => x.eventId === eventId)) {
      const v = windowView(c, w.id);
      if (!v) continue;
      run += v.day0Tests.run;
      significant += v.day0Tests.significant;
    }
  }
  return { run, significant };
}

export function observations(): MarketObservation[] {
  return RESEARCH_CASES.flatMap((c) =>
    c.observations.map((o) => {
      const study = windowView(c, o.windowId)?.studies.find((s) => s.symbol === o.symbol);
      const w = study?.windows.find((x) => x.label === o.window);
      const value = w && w.complete ? (o.measure === "abnormal" ? w.abnormal : w.raw) : null;
      const observedAt = w && w.complete && w.endDate && study ? toIso(barCloseInstant(w.endDate, study.calendar)) : null;
      return { id: o.id, label: o.label, value, observedAt };
    }),
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

export function eventViews(asOf = PLATFORM_AS_OF): EventView[] {
  return ALL_EVENTS.map((e) => eventAsOf(e, ALL_CLAIMS, ALL_SOURCES, asOf)).filter((v): v is EventView => v !== null);
}

export const eventView = (eventId: string, asOf = PLATFORM_AS_OF) => {
  const e = ALL_EVENTS.find((x) => x.id === eventId);
  return e ? eventAsOf(e, ALL_CLAIMS, ALL_SOURCES, asOf) : null;
};

// ── Exposure ────────────────────────────────────────────────────────────────

export interface ExposureRow extends ExposureProfile {
  name: string;
  measured: ReturnType<typeof measuredCells>;
  fundamentals: Fundamentals | null;
  study: EventStudy | null;
}

export function exposureRows(c: ResearchCase): ExposureRow[] {
  const w = windowView(c, c.graphWindowId);
  return c.exposures.map((p) => {
    const f = fundamentals(p.ticker);
    const study = w?.studies.find((s) => s.symbol === p.ticker) ?? null;
    const s = series(p.ticker);
    let momentum60: number | null = null;
    if (s && study?.day0) {
      const i = s.dates.indexOf(study.day0);
      if (i > 60) momentum60 = s.adj[i - 1] / s.adj[i - 61] - 1;
    }
    const netDebt = f && f.totalDebt !== null && f.totalCash !== null && f.marketCap ? (f.totalDebt - f.totalCash) / f.marketCap : null;
    const measured = measuredCells({
      forwardPE: f?.forwardPE ?? null,
      evToRevenue: f?.evToRevenue ?? null,
      netDebtToMarketCap: netDebt,
      beta: study && study.model.method === "market-model" ? study.model.beta : null,
      momentum60,
      volumeRatio: study?.volumeRatio ?? null,
    });
    return { ...p, name: instrument(p.ticker)?.name ?? p.ticker, measured, fundamentals: f, study };
  });
}

export function impacts(c: ResearchCase): CompanyImpact[] {
  const w = windowView(c, c.graphWindowId);
  const studies = new Map((w?.studies ?? []).map((s) => [s.symbol, s]));
  return companyImpacts(c.graph, studies);
}

// ── Forecasts ───────────────────────────────────────────────────────────────

export const FORECASTS = forecastLedger as unknown as ForecastRecord[];

export interface ScoredForecast {
  record: ForecastRecord;
  score: ForecastScore;
  ruleCheck: RuleCheck | null;
}

export function scoredForecasts(): ScoredForecast[] {
  return FORECASTS.map((record) => {
    const asset = series(record.instrument);
    const score: ForecastScore = asset
      ? scoreForecast(record, asset, series(record.benchmark))
      : { status: "not-scorable", note: "Instrument missing from the snapshot.", targetDate: null, barsRemaining: null, realized: null, benchmarkReturn: null, excess: null, error: null, inInterval: null, inRelInterval: null, directionHit: null, brier: null, netDirectionalReturn: null };
    return { record, score, ruleCheck: ruleCheck(record) };
  });
}

export const EVALUATED_SYMBOLS = () => [...new Set(FORECASTS.map((f) => f.instrument))];

const familyCache = new Map<string, Map<string, WalkForwardSummary>>();
/**
 * Walk-forward summaries for every evaluated instrument × horizon, with the
 * skill test Holm-corrected across the whole family. `until` limits both the
 * forecasts and their scoring to data on or before that date.
 */
export function evaluationFamily(until?: string): Map<string, WalkForwardSummary> {
  const key = until ?? "all";
  if (familyCache.has(key)) return familyCache.get(key)!;
  const raw: WalkForwardSummary[] = [];
  for (const symbol of EVALUATED_SYMBOLS()) {
    const asset = series(symbol);
    if (!asset) continue;
    const bench = series(benchmarkOf(symbol));
    for (const h of HORIZONS) raw.push(summarize(symbol, h, walkForward(asset, bench, bench ?? asset, h, 5, until)));
  }
  const family = new Map(applyFamily(raw).map((s) => [`${s.instrument}:${s.horizon}`, s]));
  familyCache.set(key, family);
  return family;
}

/** Walk-forward summary of the baseline for one instrument and horizon, on all data in the snapshot. */
export const evaluation = (symbol: string, horizon: Horizon): WalkForwardSummary | null => evaluationFamily().get(`${symbol}:${horizon}`) ?? null;

let pooledCache: PooledCoverage[] | null = null;
export function pooled(): PooledCoverage[] {
  if (pooledCache) return pooledCache;
  const all = [...evaluationFamily().values()];
  pooledCache = HORIZONS.map((h) => pooledCoverage(h, all));
  return pooledCache;
}

/**
 * How the current direction gate treats a record made under an older model
 * version. History is not rewritten: the record keeps its call, and this sits
 * beside it.
 */
export interface RuleCheck {
  recordVersion: string;
  currentVersion: string;
  currentRuleWouldCall: boolean;
  note: string;
}

export function ruleCheck(record: ForecastRecord): RuleCheck | null {
  if (record.prediction.direction === "ABSTAIN" || record.modelVersion === MODEL_VERSION) return null;
  const s = evaluationFamily(record.informationCutoff).get(`${record.instrument}:${record.horizon}`);
  if (!s) return null;
  return {
    recordVersion: record.modelVersion,
    currentVersion: MODEL_VERSION,
    currentRuleWouldCall: s.directionValidated,
    note: s.directionValidated
      ? `Re-tested with data to ${record.informationCutoff}: the ${MODEL_VERSION} gate would also have called a direction.`
      : `Re-tested with data to ${record.informationCutoff}: the ${MODEL_VERSION} gate would have abstained. ${s.validationNote}`,
  };
}

// ── Theses ──────────────────────────────────────────────────────────────────

export const ALL_THESES: ThesisRecord[] = RESEARCH_CASES.flatMap((c) => c.theses);

export const thesisContentHash = (t: ThesisRecord) => {
  const { hash: _h, prevHash: _p, ...content } = t;
  void _h;
  void _p;
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
};

export interface ThesisView {
  replay: ThesisReplay;
  caseSlug: string;
  forecasts: ScoredForecast[];
  outcome: { state: "right" | "wrong" | "unscored" | "open"; detail: string };
  integrity: { recorded: boolean; matches: boolean };
  /** Post-horizon claims from this thesis's own case. */
  postHorizonClaims: string[];
}

let thesisCache: ThesisView[] | null = null;
export function thesisViews(): ThesisView[] {
  if (thesisCache) return thesisCache;
  const obs = observations();
  const scored = scoredForecasts();
  const ledger = thesisLedger as unknown as Array<{ id: string; contentHash: string }>;
  thesisCache = RESEARCH_CASES.flatMap((c) =>
    c.theses.map((t) => {
      const replay = replayThesis(t, ALL_CLAIMS, ALL_SOURCES, obs, PLATFORM_AS_OF);
      let outcome: ThesisView["outcome"] = { state: "open", detail: `Open until ${t.horizonEnd}.` };
      if (replay.status === "CLOSED" || replay.status === "INVALIDATED") {
        const o = t.outcome ? obs.find((x) => x.id === t.outcome!.observationId) : undefined;
        if (!t.outcome || !o || o.value === null) outcome = { state: "unscored", detail: "No market outcome defined or measured for this thesis." };
        else {
          const right = t.outcome.op === ">" ? o.value > t.outcome.threshold : o.value < t.outcome.threshold;
          outcome = { state: right ? "right" : "wrong", detail: `${t.outcome.description} Measured: ${(o.value * 100).toFixed(1)}%.` };
        }
      }
      const entry = ledger.find((l) => l.id === t.id);
      return {
        replay,
        caseSlug: c.slug,
        forecasts: scored.filter((f) => f.record.thesisId === t.id),
        outcome,
        integrity: { recorded: !!entry, matches: !!entry && entry.contentHash === thesisContentHash(t) },
        postHorizonClaims: replay.postHorizonClaims.filter((id) => c.claims.some((x) => x.id === id)),
      };
    }),
  );
  return thesisCache;
}

// ── Integrity ───────────────────────────────────────────────────────────────

export interface IntegrityReport {
  forecastChain: ChainCheck;
  thesisChain: ChainCheck;
  caseIssues: Record<string, ValidationIssue[]>;
  graphIssues: Record<string, string[]>;
  thesisIssues: Record<string, string[]>;
}

export function integrity(): IntegrityReport {
  const obs = observations();
  return {
    forecastChain: verifyChain(FORECASTS),
    thesisChain: verifyChain(thesisLedger as unknown as Array<{ id: string; hash: string; prevHash: string }>),
    caseIssues: Object.fromEntries(RESEARCH_CASES.map((c) => [c.id, validateCase(c.events, c.claims, c.sources)])),
    graphIssues: Object.fromEntries(RESEARCH_CASES.map((c) => [c.id, validateGraph(c.graph)])),
    thesisIssues: Object.fromEntries(ALL_THESES.map((t) => [t.id, validateThesis(t, ALL_CLAIMS, obs, ALL_SOURCES)])),
  };
}

export const getCaseOrNull = caseBySlug;
export { INSTRUMENTS, RESEARCH_CASES };
