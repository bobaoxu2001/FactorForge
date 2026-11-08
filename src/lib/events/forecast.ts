import type { PriceSeries } from "./market";

/**
 * Baseline market forecasts and their scoring (pure; no I/O).
 *
 * Model "ewma-interval-v2" makes no directional call. Its point forecast is a
 * zero log return (random walk). Its job is an honest range: an 80% interval
 * from exponentially weighted volatility (λ = 0.94), widened by √horizon. A
 * probability of a positive return comes from the instrument's own base rate,
 * shrunk toward one half. A direction is issued only when walk-forward
 * evaluation has shown skill for that horizon; otherwise the forecast says
 * ABSTAIN, which is a result, not a gap.
 *
 * v1 → v2 changed only that gate (see MODEL_HISTORY). Records made under v1
 * stay on the ledger unchanged; the scorecard shows how the v2 gate would
 * have treated any v1 directional call.
 *
 * Leakage guard: the model is handed the full series and slices it to bars
 * dated on or before the information cutoff itself, so a caller cannot pass
 * future prices in by mistake. Tests check that appending future bars leaves
 * every prediction unchanged.
 */

export const MODEL_VERSION = "ewma-interval-v2";
export const MODEL_HISTORY: Record<string, string> = {
  "ewma-interval-v1":
    "Direction allowed when the hit rate beat 50% at p < 0.05 on an overlap-adjusted n, Brier beat a coin flip, and both halves agreed. Tested each instrument and horizon on its own.",
  "ewma-interval-v2":
    "Direction allowed only when the rule beats the better constant rule (always up or always down) in a paired sign test, survives a Holm correction across every instrument and horizon tested together, beats the hindsight base rate on Brier score, and both halves agree. Effective n also accounts for autocorrelation.",
};
export const HORIZONS = [1, 5, 20, 60] as const;
export type Horizon = (typeof HORIZONS)[number];
export const INTERVAL_LEVEL = 0.8;
const Z80 = 1.2815515655446004;
const LAMBDA = 0.94;
const MIN_RETURNS = 250;
const LOOKBACK = 500;
const MAX_STALE_DAYS = 5;

export type Direction = "UP" | "DOWN" | "ABSTAIN";

export interface Prediction {
  status: "OK" | "INSUFFICIENT_DATA";
  reason: string | null;
  direction: Direction;
  directionReason: string;
  /** Base-rate probability of a positive return over the horizon. */
  pUp: number | null;
  /** Point forecast of the simple return (zero for a random walk). */
  center: number;
  interval: [number, number] | null;
  /**
   * Interval for the relative wealth return (1 + r) / (1 + r_benchmark) − 1.
   * Built from log(asset) − log(benchmark) returns, so that is its target —
   * not the arithmetic difference r − r_benchmark.
   */
  relInterval: [number, number] | null;
  sigmaDaily: number | null;
  observations: number;
}

export interface ForecastSpec {
  instrument: string;
  benchmark: string | null;
  horizon: Horizon;
  informationCutoff: string; // YYYY-MM-DD, inclusive
  /** Direction is allowed only when evaluation has validated it for this horizon. */
  directionValidated?: boolean;
}

export interface ForecastRecord extends ForecastSpec {
  id: string;
  createdAt: string;
  /** Last bar actually used (≤ cutoff). */
  dataAsOf: string | null;
  calendar: PriceSeries["calendar"];
  modelVersion: string;
  /** "live": made on or right after the cutoff. "backfill": made later using only data to the cutoff. */
  origin: "live" | "backfill";
  eventId?: string;
  thesisId?: string;
  /** Round-trip cost assumed when judging a directional call's economic value. */
  costBps: number;
  prediction: Prediction;
  prevHash: string;
  hash: string;
}

/** Bars on or before the cutoff. The only door through which the model sees data. */
export function sliceToCutoff(series: PriceSeries, cutoff: string): PriceSeries {
  let end = series.dates.length;
  while (end > 0 && series.dates[end - 1] > cutoff) end -= 1;
  return { ...series, dates: series.dates.slice(0, end), adj: series.adj.slice(0, end), volume: series.volume.slice(0, end) };
}

const logReturns = (adj: number[]) => adj.slice(1).map((p, i) => Math.log(p / adj[i]));

export function ewmaSigma(returns: number[]): number | null {
  if (returns.length < 30) return null;
  const seed = returns.slice(0, 30);
  const m = seed.reduce((s, x) => s + x, 0) / seed.length;
  let variance = seed.reduce((s, x) => s + (x - m) ** 2, 0) / (seed.length - 1);
  for (const r of returns.slice(30)) variance = LAMBDA * variance + (1 - LAMBDA) * r * r;
  return Math.sqrt(variance);
}

function excessLogReturns(asset: PriceSeries, bench: PriceSeries): number[] {
  const idx = new Map(bench.dates.map((d, i) => [d, i]));
  const out: number[] = [];
  let prev: { a: number; b: number } | null = null;
  for (let i = 0; i < asset.dates.length; i++) {
    const j = idx.get(asset.dates[i]);
    if (j === undefined) continue;
    const cur = { a: asset.adj[i], b: bench.adj[j] };
    if (prev) out.push(Math.log(cur.a / prev.a) - Math.log(cur.b / prev.b));
    prev = cur;
  }
  return out;
}

const daysApart = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function predict(spec: ForecastSpec, assetFull: PriceSeries, benchFull: PriceSeries | null): { dataAsOf: string | null; prediction: Prediction } {
  const asset = sliceToCutoff(assetFull, spec.informationCutoff);
  const bench = benchFull ? sliceToCutoff(benchFull, spec.informationCutoff) : null;
  const dataAsOf = asset.dates.at(-1) ?? null;
  const insufficient = (reason: string): Prediction => ({
    status: "INSUFFICIENT_DATA",
    reason,
    direction: "ABSTAIN",
    directionReason: reason,
    pUp: null,
    center: 0,
    interval: null,
    relInterval: null,
    sigmaDaily: null,
    observations: Math.max(0, asset.dates.length - 1),
  });
  if (!dataAsOf) return { dataAsOf, prediction: insufficient("No prices on or before the cutoff.") };
  if (daysApart(dataAsOf, spec.informationCutoff) > MAX_STALE_DAYS) {
    return { dataAsOf, prediction: insufficient(`Latest price (${dataAsOf}) is more than ${MAX_STALE_DAYS} days older than the cutoff.`) };
  }
  const returns = logReturns(asset.adj).slice(-LOOKBACK);
  if (returns.length < MIN_RETURNS) {
    return { dataAsOf, prediction: insufficient(`Only ${returns.length} daily returns; the model needs ${MIN_RETURNS}.`) };
  }
  const sigma = ewmaSigma(returns)!;
  const h = spec.horizon;
  const half = Z80 * sigma * Math.sqrt(h);
  const interval: [number, number] = [Math.exp(-half) - 1, Math.exp(half) - 1];

  let relInterval: [number, number] | null = null;
  if (bench) {
    const ex = excessLogReturns(asset, bench).slice(-LOOKBACK);
    const s = ewmaSigma(ex);
    if (s !== null) {
      const hr = Z80 * s * Math.sqrt(h);
      relInterval = [Math.exp(-hr) - 1, Math.exp(hr) - 1];
    }
  }

  // Base rate of positive h-bar returns over the lookback, shrunk toward 0.5 (50 pseudo-observations).
  const adj = asset.adj.slice(-(LOOKBACK + 1));
  let ups = 0;
  let n = 0;
  for (let i = h; i < adj.length; i++) {
    n += 1;
    if (adj[i] > adj[i - h]) ups += 1;
  }
  const pUp = (ups + 25) / (n + 50);

  const direction: Direction = spec.directionValidated ? (pUp >= 0.5 ? "UP" : "DOWN") : "ABSTAIN";
  const directionReason = spec.directionValidated
    ? "Walk-forward evaluation found directional skill at this horizon."
    : "No directional skill shown out of sample at this horizon; the range is the forecast.";

  return {
    dataAsOf,
    prediction: {
      status: "OK",
      reason: null,
      direction,
      directionReason,
      pUp,
      center: 0,
      interval,
      relInterval,
      sigmaDaily: sigma,
      observations: returns.length,
    },
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Scoring methodology. Scores are derived at read time from the ledger and
 * prices, so a scoring fix changes no stored record; the version says which
 * rules produced the numbers shown.
 */
export const SCORING_VERSION = "score-v2";
export const SCORING_HISTORY: Record<string, string> = {
  "score-v1": "Scored the relative range against the arithmetic excess return r − r_benchmark, which is not what the range was built for.",
  "score-v2": "Scores the relative range against the relative wealth return (1 + r) / (1 + r_benchmark) − 1, the quantity it was built from. Arithmetic excess is still reported, as a separate figure.",
};

export interface ForecastScore {
  status: "scored" | "pending" | "not-scorable";
  note: string;
  targetDate: string | null;
  barsRemaining: number | null;
  realized: number | null;
  benchmarkReturn: number | null;
  /** Arithmetic excess r − r_benchmark. Reported for reference; the relative range does not target it. */
  excess: number | null;
  /** Relative wealth return (1 + r) / (1 + r_benchmark) − 1: what the relative range targets. */
  relative: number | null;
  /** Realized minus the point forecast. */
  error: number | null;
  inInterval: boolean | null;
  /** `relative` inside the relative range (score-v2). */
  inRelInterval: boolean | null;
  /** The score-v1 comparison (arithmetic excess inside the relative range), kept to show where the versions disagree. */
  inRelIntervalV1: boolean | null;
  scoringVersion: string;
  directionHit: boolean | null;
  brier: number | null;
  /** Return of acting on the direction, after costs; null when the forecast abstained. */
  netDirectionalReturn: number | null;
}

/** Last bar on or before a date (benchmarks can miss dates the asset has). */
function valueOnOrBefore(series: PriceSeries, date: string): number | null {
  let lo = 0;
  let hi = series.dates.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series.dates[mid] <= date) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best >= 0 ? series.adj[best] : null;
}

export function scoreForecast(
  record: Pick<ForecastRecord, "dataAsOf" | "horizon" | "prediction" | "costBps">,
  asset: PriceSeries,
  bench: PriceSeries | null,
): ForecastScore {
  const blank = {
    targetDate: null,
    barsRemaining: null,
    realized: null,
    benchmarkReturn: null,
    excess: null,
    relative: null,
    error: null,
    inInterval: null,
    inRelInterval: null,
    inRelIntervalV1: null,
    scoringVersion: SCORING_VERSION,
    directionHit: null,
    brier: null,
    netDirectionalReturn: null,
  };
  if (record.prediction.status !== "OK" || !record.dataAsOf) return { status: "not-scorable", note: record.prediction.reason ?? "No prediction was made.", ...blank };
  const start = asset.dates.indexOf(record.dataAsOf);
  if (start < 0) return { status: "not-scorable", note: `The bar the forecast used (${record.dataAsOf}) is no longer in the price history.`, ...blank };
  const target = start + record.horizon;
  if (target > asset.dates.length - 1) {
    const remaining = target - (asset.dates.length - 1);
    return { status: "pending", note: `Realizes after ${remaining} more bar${remaining === 1 ? "" : "s"}.`, ...blank, barsRemaining: remaining };
  }
  const targetDate = asset.dates[target];
  const realized = asset.adj[target] / asset.adj[start] - 1;
  const b0 = bench ? valueOnOrBefore(bench, record.dataAsOf) : null;
  const b1 = bench ? valueOnOrBefore(bench, targetDate) : null;
  const benchmarkReturn = b0 && b1 ? b1 / b0 - 1 : null;
  const excess = benchmarkReturn === null ? null : realized - benchmarkReturn;
  const relative = benchmarkReturn === null ? null : (1 + realized) / (1 + benchmarkReturn) - 1;
  const p = record.prediction;
  const inside = (x: number | null, range: [number, number] | null) => (range && x !== null ? x >= range[0] && x <= range[1] : null);
  const up = realized > 0 ? 1 : 0;
  const directional = p.direction === "ABSTAIN" ? null : p.direction === "UP" ? 1 : -1;
  return {
    status: "scored",
    note: `Scored on the ${targetDate} close.`,
    targetDate,
    barsRemaining: 0,
    realized,
    benchmarkReturn,
    excess,
    relative,
    error: realized - p.center,
    inInterval: inside(realized, p.interval),
    inRelInterval: inside(relative, p.relInterval),
    inRelIntervalV1: inside(excess, p.relInterval),
    scoringVersion: SCORING_VERSION,
    directionHit: directional === null ? null : (directional === 1) === (realized > 0),
    brier: p.pUp === null ? null : (p.pUp - up) ** 2,
    netDirectionalReturn: directional === null ? null : directional * realized - record.costBps / 10_000,
  };
}
