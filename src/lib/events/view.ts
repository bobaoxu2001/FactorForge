import "server-only";
import fundamentalsFixture from "@/__fixtures__/events/fundamentals.json";
import manifestFixture from "@/__fixtures__/events/manifest.json";
import pricesFixture from "@/__fixtures__/events/prices.json";
import forecastLedger from "@/data/events/forecast-ledger.json";
import thesisLedger from "@/data/events/thesis-ledger.json";
import { ALL_CLAIMS, ALL_EVENTS, ALL_SOURCES, INSTRUMENTS, RESEARCH_CASES, caseBySlug, instrument } from "@/data/events";
import type { ResearchCase, ThesisAssessment } from "@/data/events/types";
import { applyFamily, pooledCoverage, summarize, walkForward, type PooledCoverage, type WalkForwardSummary } from "./evaluation";
import { HORIZONS, MODEL_VERSION, SCORING_VERSION, scoreForecast, type ForecastRecord, type ForecastScore, type Horizon } from "./forecast";
import { compareWithMarket, companyImpacts, measuredMetrics, missingEvidence, validateGraph, EXPOSURE_DIMENSIONS, type CompanyImpact, type EvidenceResolver, type ExposureKey, type ExposureProfile, type MarketComparison, type MeasuredMetric, type ResolvedEvidence } from "./impact";
import { canonicalJson, verifyChain, type ChainCheck } from "./ledger";
import { eventStudy, groupReactions, returnOn, type EventStudy, type GroupReaction, type PriceSeries } from "./market";
import { replayThesis, triggerWordingFindings, validateThesis, type MarketObservation, type ThesisReplay, type ThesisRecord } from "./thesis";
import { barCloseInstant, firstReactionIndex, parseInstant, toIso, type MarketCalendar } from "./time";
import type { Claim, CompetingExplanation, EventRecord, EventView, SourceRecord } from "./types";
import { availableAt, eventAsOf, validateCase, verifyClaim, type ValidationIssue } from "./verification";
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
   * A second, differently built benchmark: where the two disagree, the
   * result is benchmark-sensitive.
   */
  equalWeight: Record<string, EventStudy>;
  /** The same day-0 tests against the equal-weight S&P 500, for the stocks that have one. */
  day0TestsEqualWeight: { run: number; significant: number; expectedByChance: number };
  /** Day-0 raw moves of the benchmarks themselves, so a reader can see how much the market moved. */
  benchmarkMoves: Array<{ symbol: string; ret: number }>;
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
    day0TestsEqualWeight: (() => {
      const ewTested = tested.map((s) => equalWeight[s.symbol]).filter((e) => e?.windows[0]?.tStat != null);
      return { run: ewTested.length, significant: ewTested.filter((e) => e.windows[0].significant).length, expectedByChance: ewTested.length * 0.05 };
    })(),
    benchmarkMoves: (() => {
      const d0 = longest?.day0;
      if (!d0) return [];
      const syms = [...new Set([...studies.map((s) => s.benchmark).filter((b): b is string => !!b), ...(Object.keys(equalWeight).length ? [EQUAL_WEIGHT_BENCHMARK] : [])])];
      return syms.map((sym) => ({ symbol: sym, ret: series(sym) ? returnOn(series(sym)!, d0) : null })).filter((x): x is { symbol: string; ret: number } => x.ret !== null);
    })(),
  };
  windowCache.set(key, view);
  return view;
}

const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;

/**
 * Plain statement of how much a window's result depends on the benchmark.
 * Counts are labelled with the benchmark behind them; no cause is inferred.
 */
export function benchmarkSensitivity(v: WindowView): string | null {
  const own = v.day0Tests;
  const ew = v.day0TestsEqualWeight;
  if (ew.run === 0) return null;
  const owns = [...new Set(v.studies.map((s) => s.benchmark).filter(Boolean))].sort().join(" or ");
  const moves = v.benchmarkMoves.length ? ` On day 0 the benchmarks themselves moved ${v.benchmarkMoves.map((m) => `${m.symbol} ${signed(m.ret)}`).join(", ")}.` : "";
  const compare =
    ew.significant === own.significant
      ? "The two benchmarks give the same count."
      : `${ew.significant > own.significant ? "More" : "Fewer"} moves look unusual against the equal-weight index, so the reading depends on the benchmark chosen: a stock's expected move is its estimated beta times its benchmark's move, and both differ between the two.`;
  return `Against each stock's own benchmark (${owns}), ${own.significant} of ${own.run} day-0 moves pass both checks; against the equal-weight S&P 500 (${EQUAL_WEIGHT_BENCHMARK}), ${ew.significant} of ${ew.run} do. About ${own.expectedByChance.toFixed(1)} would pass by chance in each.${moves} ${compare} Neither comparison says why the stocks moved.`;
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

// ── Evidence resolution ─────────────────────────────────────────────────────

/** The moment a case's current view speaks for: its dated assessment, or the snapshot. */
export const caseAsOf = (c: ResearchCase) => c.currentAssessment?.at ?? PLATFORM_AS_OF;

const shorten = (text: string, max = 72) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max - 1))}…`);
const STATE_WORD = { CONFIRMED: "confirmed", CORROBORATED: "corroborated", REPORTED: "reported, unverified", RUMOR: "rumour", DISPUTED: "disputed" } as const;

/**
 * Resolves an evidence id as it stood at `asOf`: claims are re-verified on the
 * sources published and read by then (and recorded by then), market checks
 * count only after their day-0 close, figures only from a read document
 * published by then. Exposure entries are analyst classifications and never
 * count as evidence until checked against a filing.
 */
export function evidenceResolver(c: ResearchCase, asOf: string): EvidenceResolver {
  const asOfMs = parseInstant(asOf, "asOf");
  const claims = new Map(ALL_CLAIMS.map((x) => [x.id, x]));
  const figures = new Map((c.companyCases ?? []).flatMap((cc) => cc.figures).map((f) => [f.id, f]));
  const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;
  return (id: string): ResolvedEvidence => {
    if (id.startsWith("MKT:")) {
      const [, windowId, symbol] = id.split(":");
      const v = windowView(c, windowId);
      const study = v?.studies.find((x) => x.symbol === symbol);
      const w = study?.windows[0];
      if (!study || !w || !study.day0) return missingEvidence(id);
      const available = barCloseInstant(study.day0, study.calendar) <= asOfMs;
      const abn = w.abnormal === null ? "n/a" : signedPct(w.abnormal);
      return {
        id,
        kind: "market",
        exists: true,
        label: `${symbol}, ${study.day0}: ${abn} against ${study.benchmark ?? "its own history"}`,
        available,
        status: w.significant ? "beyond noise" : "within noise",
        admissible: available && w.significant,
        note: w.significant ? "A measured price response; it describes the move, not its cause." : "Within normal noise: inconclusive, not evidence of no effect.",
      };
    }
    if (id.startsWith("EXP:")) {
      const [, ticker, dim] = id.split(":");
      const cell = c.exposures.find((x) => x.ticker === ticker)?.cells[dim as ExposureKey];
      if (!cell) return missingEvidence(id);
      const label = EXPOSURE_DIMENSIONS.find((d) => d.key === dim)?.label ?? dim;
      return {
        id,
        kind: "exposure",
        exists: true,
        label: `${ticker} ${label.toLowerCase()}: ${cell.level}`,
        available: true,
        status: cell.verified ? "checked against filing" : "analyst classification, unverified",
        admissible: cell.verified,
        note: cell.basis,
      };
    }
    if (id.startsWith("FIG:")) {
      const f = figures.get(id.slice(4));
      const src = f ? ALL_SOURCES.find((x) => x.id === f.sourceId) : undefined;
      if (!f || !src) return missingEvidence(id);
      const available = src.retrieval === "read" && availableAt(src) <= asOfMs;
      return {
        id,
        kind: "figure",
        exists: true,
        label: f.label,
        available,
        status: f.value === null ? "not disclosed" : f.basis === "disclosed" ? "disclosed by the company" : "derived from disclosed figures",
        admissible: available && f.value !== null,
        note: `${src.publisher}, ${f.period}; ${f.where}.`,
      };
    }
    const claim = claims.get(id);
    return claim ? resolveClaimEvidence(claim, ALL_SOURCES, asOfMs) : missingEvidence(id);
  };
}

/**
 * A claim as evidence at a cutoff: it counts only if it was recorded by then
 * and a source that was actually read had published it by then. Rumours and
 * disputed claims are shown but are not admissible.
 */
export function resolveClaimEvidence(claim: Claim, sources: SourceRecord[], asOfMs: number): ResolvedEvidence {
  const label = claim.short ?? shorten(claim.statement);
  const recorded = parseInstant(claim.recordedAt, `${claim.id}.recordedAt`) <= asOfMs;
  const v = recorded ? verifyClaim(claim, sources, asOfMs) : null;
  if (!v) {
    const cited = claim.citations.map((ci) => sources.find((x) => x.id === ci.sourceId)).filter((x) => x !== undefined);
    const published = cited.filter((x) => availableAt(x) <= asOfMs);
    const note = !recorded
      ? "Recorded after the cutoff."
      : published.length === 0
        ? "Not yet published at the cutoff."
        : "Its sources published by the cutoff were not read (blocked or not attempted).";
    return { id: claim.id, kind: "claim", exists: true, label, available: false, status: "not available at cutoff", admissible: false, note };
  }
  return {
    id: claim.id,
    kind: "claim",
    exists: true,
    label,
    available: true,
    status: STATE_WORD[v.verification],
    admissible: v.verification !== "DISPUTED" && v.verification !== "RUMOR",
    note: v.verificationReason,
  };
}

export const resolveRefs = (c: ResearchCase, ids: string[], asOf = caseAsOf(c)) => {
  const resolve = evidenceResolver(c, asOf);
  return ids.map(resolve);
};

/** A research test's price prediction against its one measured window; null when it makes none. */
export function testPriceCheck(c: ResearchCase, t: CompetingExplanation): MarketComparison | null {
  if (!t.priceCheck) return null;
  const study = windowView(c, t.priceCheck.windowId)?.studies.find((s) => s.symbol === t.priceCheck!.symbol);
  return compareWithMarket({ direction: t.priceCheck.direction, target: "price", metric: `${t.priceCheck.symbol}'s price`, horizon: "event-window", windowLabel: "[0,0]" }, study, "[0,0]");
}

// ── Exposure ────────────────────────────────────────────────────────────────

export interface ExposureRow extends ExposureProfile {
  name: string;
  metrics: MeasuredMetric[];
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
    const metrics = measuredMetrics({
      forwardPE: f?.forwardPE ?? null,
      evToRevenue: f?.evToRevenue ?? null,
      netDebtToMarketCap: netDebt,
      beta: study && study.model.method === "market-model" ? study.model.beta : null,
      benchmark: study?.benchmark ?? null,
      momentum60,
      volumeRatio: study?.volumeRatio ?? null,
    });
    return { ...p, name: instrument(p.ticker)?.name ?? p.ticker, metrics, fundamentals: f, study };
  });
}

export function impacts(c: ResearchCase, asOf = caseAsOf(c)): CompanyImpact[] {
  const w = windowView(c, c.graphWindowId);
  const studies = new Map((w?.studies ?? []).map((s) => [s.symbol, s]));
  return companyImpacts(c.graph, studies, evidenceResolver(c, asOf), parseInstant(asOf, "asOf"));
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
      : { status: "not-scorable", note: "Instrument missing from the snapshot.", targetDate: null, barsRemaining: null, realized: null, benchmarkReturn: null, excess: null, relative: null, error: null, inInterval: null, inRelInterval: null, inRelIntervalV1: null, scoringVersion: SCORING_VERSION, directionHit: null, brier: null, netDirectionalReturn: null };
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
  /** Dated notes on parts of the thesis, from the case file. The thesis itself is unchanged. */
  assessments: ThesisAssessment[];
  /** What the trigger wording rules now in force would say about this thesis (binding only for later theses). */
  ruleFindings: string[];
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
        assessments: (c.assessments ?? []).filter((a) => a.thesisId === t.id),
        ruleFindings: triggerWordingFindings(t, ALL_CLAIMS),
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
