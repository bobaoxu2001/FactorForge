import { barCloseInstant, firstReactionIndex, parseInstant, type MarketCalendar } from "./time";

/**
 * Event-window market analytics (pure; no I/O).
 *
 * Abnormal return = actual return − what the benchmark move alone predicts,
 * using a market model (α + β·benchmark) fitted on a window that ends well
 * before the event, so the event cannot contaminate its own baseline. Day 0 is
 * the first bar that closes after the event, which for a US equity can be the
 * next session. Windows that run past the data are marked incomplete rather
 * than truncated silently.
 *
 * Two checks on each cumulative abnormal return (CAR):
 * - t-statistic with the market-model prediction-error variance
 *   σ²·(L + L²/n + (ΣRm − L·R̄m)²/Sxx), so a large benchmark move on the event
 *   day widens the band (Campbell, Lo & MacKinlay, ch. 4);
 * - placebo rank: the share of the asset's own pre-event L-day windows whose
 *   |CAR| was at least as large. It does not assume normal returns, so fat
 *   tails cannot make an ordinary move look rare.
 * A cell is "significant" only when both agree. These are associations
 * around a date, not proof that the event caused the move.
 */

export interface PriceSeries {
  symbol: string;
  calendar: MarketCalendar;
  dates: string[];
  /** Split- and dividend-adjusted close. */
  adj: number[];
  volume: number[];
}

export interface AlignedReturns {
  dates: string[];
  asset: number[];
  bench: number[] | null;
  volume: number[];
}

/** Daily simple returns on dates both series share. Returns are dated by the bar they end on. */
export function alignReturns(asset: PriceSeries, bench: PriceSeries | null): AlignedReturns {
  const benchIdx = bench ? new Map(bench.dates.map((d, i) => [d, i])) : null;
  const dates: string[] = [];
  const a: number[] = [];
  const b: number[] = [];
  const v: number[] = [];
  let prevA: number | null = null;
  let prevB: number | null = null;
  for (let i = 0; i < asset.dates.length; i++) {
    const d = asset.dates[i];
    const j = benchIdx?.get(d);
    if (benchIdx && j === undefined) continue; // keep only shared dates so both returns span the same interval
    const pa = asset.adj[i];
    const pb = bench && j !== undefined ? bench.adj[j] : null;
    if (prevA !== null && (pb === null || prevB !== null)) {
      dates.push(d);
      a.push(pa / prevA - 1);
      if (pb !== null && prevB !== null) b.push(pb / prevB - 1);
      v.push(asset.volume[i]);
    }
    prevA = pa;
    prevB = pb;
  }
  return { dates, asset: a, bench: bench ? b : null, volume: v };
}

export interface MarketModel {
  method: "market-model" | "market-adjusted" | "raw";
  alpha: number;
  beta: number;
  residualSd: number;
  n: number;
  /** Mean benchmark return and its sum of squared deviations over the estimation window (market model only). */
  meanBench: number;
  sxx: number;
  /** Dates of the estimation window, for contamination checks. */
  from: string | null;
  to: string | null;
}

/** OLS of asset on benchmark over [from, to). Falls back when the sample is short. */
export function fitMarketModel(r: AlignedReturns, from: number, to: number, minObs = 60): MarketModel {
  const lo = Math.max(0, from);
  const hi = Math.max(lo, Math.min(r.asset.length, to));
  const ys = r.asset.slice(lo, hi);
  const span = { from: r.dates[lo] ?? null, to: r.dates[hi - 1] ?? null };
  if (!r.bench) {
    const mean = ys.reduce((s, x) => s + x, 0) / Math.max(1, ys.length);
    const sd = Math.sqrt(ys.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, ys.length - 1));
    return { method: "raw", alpha: 0, beta: 0, residualSd: sd, n: ys.length, meanBench: 0, sxx: 0, ...span };
  }
  const xs = r.bench.slice(lo, hi);
  if (ys.length < minObs) {
    const resid = ys.map((y, i) => y - xs[i]);
    const sd = Math.sqrt(resid.reduce((s, x) => s + x * x, 0) / Math.max(1, resid.length - 1));
    return { method: "market-adjusted", alpha: 0, beta: 1, residualSd: sd || Number.NaN, n: ys.length, meanBench: 0, sxx: 0, ...span };
  }
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const beta = sxx > 0 ? sxy / sxx : 1;
  const alpha = my - beta * mx;
  const resid = ys.map((y, i) => y - alpha - beta * xs[i]);
  const residualSd = Math.sqrt(resid.reduce((s, e) => s + e * e, 0) / Math.max(1, resid.length - 2));
  return { method: "market-model", alpha, beta, residualSd, n: ys.length, meanBench: mx, sxx, ...span };
}

/** Variance of a CAR over window days `idx`, including estimation error for the market model. */
export function carVariance(model: MarketModel, benchReturns: number[] | null, idx: number[]): number {
  const L = idx.length;
  const s2 = model.residualSd ** 2;
  if (model.method !== "market-model" || !benchReturns || model.sxx <= 0) return s2 * L;
  const sumRm = idx.reduce((a, i) => a + benchReturns[i], 0);
  return s2 * (L + (L * L) / model.n + (sumRm - L * model.meanBench) ** 2 / model.sxx);
}

export interface WindowResult {
  label: string;
  startDate: string;
  endDate: string | null;
  days: number;
  complete: boolean;
  raw: number | null;
  benchmark: number | null;
  abnormal: number | null;
  tStat: number | null;
  /** Share of pre-event windows of the same length with |CAR| at least this large. */
  placeboShare: number | null;
  placeboN: number;
  /** |t| ≥ 1.96 and placebo share ≤ 5% (with at least 100 placebo windows). */
  significant: boolean;
}

export type Persistence = "persistent" | "partially-reversed" | "reversed" | "no-significant-reaction" | "insufficient-data";

export interface EventStudy {
  symbol: string;
  benchmark: string | null;
  calendar: MarketCalendar;
  day0: string | null;
  /** The event time fell after this bar closed, so this bar cannot contain the reaction. */
  lastPreEventBar: string | null;
  model: MarketModel;
  windows: WindowResult[];
  volumeRatio: number | null;
  persistence: Persistence;
  persistenceNote: string;
}

const compound = (xs: number[]) => xs.reduce((p, x) => p * (1 + x), 1) - 1;

/** Sessions before day 0 used for placebo windows (about two years of trading days). */
const PLACEBO_LOOKBACK = 500;

export const DEFAULT_WINDOWS: Array<[number, number]> = [
  [0, 0],
  [0, 1],
  [0, 4],
  [0, 19],
];

export function eventStudy(
  asset: PriceSeries,
  bench: PriceSeries | null,
  eventAt: string,
  windows: Array<[number, number]> = DEFAULT_WINDOWS,
): EventStudy {
  const r = alignReturns(asset, bench);
  const eventMs = parseInstant(eventAt, "eventAt");
  const day0 = firstReactionIndex(r.dates, eventMs, asset.calendar);
  const empty = (persistenceNote: string): EventStudy => ({
    symbol: asset.symbol,
    benchmark: bench?.symbol ?? null,
    calendar: asset.calendar,
    day0: null,
    lastPreEventBar: r.dates.at(-1) ?? null,
    model: { method: bench ? "market-model" : "raw", alpha: 0, beta: 0, residualSd: Number.NaN, n: 0, meanBench: 0, sxx: 0, from: null, to: null },
    windows: [],
    volumeRatio: null,
    persistence: "insufficient-data",
    persistenceNote,
  });
  if (day0 < 0) return empty("No bar has closed since the event.");

  // Estimation window ends 10 bars before day 0 so pre-event leakage stays out of the baseline.
  const model = fitMarketModel(r, day0 - 130, day0 - 10);
  const expected = (i: number) => (r.bench ? model.alpha + model.beta * r.bench[i] : 0);

  const results: WindowResult[] = windows.map(([s, e]) => {
    const start = day0 + s;
    const endWanted = day0 + e;
    const end = Math.min(endWanted, r.asset.length - 1);
    const complete = endWanted <= r.asset.length - 1;
    if (start > r.asset.length - 1) {
      return { label: `[${s},${e}]`, startDate: r.dates[day0], endDate: null, days: e - s + 1, complete: false, raw: null, benchmark: null, abnormal: null, tStat: null, placeboShare: null, placeboN: 0, significant: false };
    }
    const idx = Array.from({ length: end - start + 1 }, (_, k) => start + k);
    const raw = compound(idx.map((i) => r.asset[i]));
    const benchmark = r.bench ? compound(idx.map((i) => r.bench![i])) : null;
    const abnormal = idx.reduce((sum, i) => sum + (r.asset[i] - expected(i)), 0);
    const variance = carVariance(model, r.bench, idx);
    const tStat = Number.isFinite(variance) && variance > 0 ? abnormal / Math.sqrt(variance) : null;
    // Placebo: every earlier window of the same length that ends before day 0.
    const L = idx.length;
    let placeboN = 0;
    let asLarge = 0;
    let rolling = 0;
    const firstPlacebo = Math.max(1, day0 - PLACEBO_LOOKBACK);
    for (let i = firstPlacebo; i < day0; i++) {
      rolling += r.asset[i] - expected(i);
      if (i - firstPlacebo >= L) rolling -= r.asset[i - L] - expected(i - L);
      if (i - firstPlacebo >= L - 1) {
        placeboN += 1;
        if (Math.abs(rolling) >= Math.abs(abnormal) - 1e-12) asLarge += 1;
      }
    }
    const placeboShare = placeboN ? asLarge / placeboN : null;
    const significant = tStat !== null && Math.abs(tStat) >= 1.96 && placeboShare !== null && placeboN >= 100 && placeboShare <= 0.05;
    return { label: `[${s},${e}]`, startDate: r.dates[start], endDate: r.dates[end], days: L, complete, raw, benchmark, abnormal, tStat, placeboShare, placeboN, significant };
  });

  const prior = r.volume.slice(Math.max(0, day0 - 20), day0).filter((x) => x > 0);
  const volumeRatio = prior.length >= 10 && r.volume[day0] > 0 ? r.volume[day0] / (prior.reduce((s, x) => s + x, 0) / prior.length) : null;

  const w0 = results.find((w) => w.label === "[0,0]");
  const w4 = results.find((w) => w.label === "[0,4]");
  let persistence: Persistence = "insufficient-data";
  let persistenceNote = "Fewer than five bars since day 0.";
  if (w0?.abnormal != null && w0.tStat != null && !w0.significant) {
    persistence = "no-significant-reaction";
    const placebo = w0.placeboShare === null ? "" : `; ${(w0.placeboShare * 100).toFixed(1)}% of the previous ${w0.placeboN} sessions moved at least as much`;
    persistenceNote = `Day-0 abnormal return is within normal noise (|t| = ${Math.abs(w0.tStat).toFixed(1)}${placebo}).`;
  } else if (w0?.abnormal != null && w4?.complete && w4.abnormal != null) {
    const a0 = w0.abnormal;
    const a4 = w4.abnormal;
    if (Math.sign(a4) !== Math.sign(a0) || Math.abs(a4) < 0.25 * Math.abs(a0)) {
      persistence = "reversed";
      persistenceNote = "Most of the day-0 abnormal move was gone after five bars.";
    } else if (Math.abs(a4) >= 0.75 * Math.abs(a0)) {
      persistence = "persistent";
      persistenceNote = "At least three-quarters of the day-0 abnormal move remained after five bars.";
    } else {
      persistence = "partially-reversed";
      persistenceNote = "Between a quarter and three-quarters of the day-0 abnormal move remained after five bars.";
    }
  }

  return {
    symbol: asset.symbol,
    benchmark: bench?.symbol ?? null,
    calendar: asset.calendar,
    day0: r.dates[day0],
    lastPreEventBar: day0 > 0 ? r.dates[day0 - 1] : null,
    model,
    windows: results,
    volumeRatio,
    persistence,
    persistenceNote,
  };
}

/** Simple return on one dated bar (close to close), or null if absent. */
export function returnOn(series: PriceSeries, date: string): number | null {
  const i = series.dates.indexOf(date);
  if (i <= 0) return null;
  return series.adj[i] / series.adj[i - 1] - 1;
}

/** Whether a bar dated `date` closed before an instant. */
export const barClosedBefore = (date: string, calendar: MarketCalendar, instantMs: number) => barCloseInstant(date, calendar) <= instantMs;

export interface GroupReaction {
  group: string;
  members: string[];
  meanAbnormal: number | null;
  meanRaw: number | null;
  n: number;
}

/** Equal-weighted mean abnormal return per group for one window label. */
export function groupReactions(studies: EventStudy[], groupOf: (symbol: string) => string, window: string): GroupReaction[] {
  const groups = new Map<string, EventStudy[]>();
  for (const s of studies) {
    const g = groupOf(s.symbol);
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return [...groups.entries()].map(([group, items]) => {
    const ws = items.map((s) => s.windows.find((w) => w.label === window)).filter((w): w is WindowResult => !!w && w.abnormal != null);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      group,
      members: items.map((s) => s.symbol),
      meanAbnormal: mean(ws.map((w) => w.abnormal!)),
      meanRaw: mean(ws.map((w) => w.raw!).filter((x) => x != null)),
      n: ws.length,
    };
  });
}
