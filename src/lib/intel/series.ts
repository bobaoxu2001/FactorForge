import type { Freshness, KpiReading, SeriesFrequency, SeriesPoint } from "./types";

/**
 * Time-series math for KPI research. Pure functions, no I/O.
 *
 * Conventions:
 *  - FRED monthly observations are dated on the first day of the period
 *    (2026-07-01 = July 2026). Weekly series are dated on the week-ending day.
 *  - YoY is matched by calendar period, never by array offset, so a missing
 *    month produces a null YoY instead of silently comparing the wrong months.
 */

const DAY_MS = 86_400_000;

export function toPoints(observations: Array<[string, number]>): SeriesPoint[] {
  return observations
    .filter(([, value]) => Number.isFinite(value))
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const monthKey = (date: string) => date.slice(0, 7);

function shiftMonthKey(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** YoY change per point: monthly by calendar month; weekly by the observation 364±3 days earlier. */
export function yoyChanges(points: SeriesPoint[], frequency: SeriesFrequency): Array<number | null> {
  if (frequency === "weekly") {
    const times = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
    return points.map((point, index) => {
      const target = times[index] - 364 * DAY_MS;
      let best: number | null = null;
      for (let j = index - 1; j >= 0; j -= 1) {
        if (times[j] < target - 3 * DAY_MS) break;
        if (Math.abs(times[j] - target) <= 3 * DAY_MS) {
          best = j;
          break;
        }
      }
      return best === null || points[best].value === 0 ? null : point.value / points[best].value - 1;
    });
  }
  // Monthly and quarterly series are both keyed by calendar month.
  const byMonth = new Map(points.map((p) => [monthKey(p.date), p.value]));
  return points.map((point) => {
    const prior = byMonth.get(shiftMonthKey(monthKey(point.date), -12));
    return prior === undefined || prior === 0 ? null : point.value / prior - 1;
  });
}

/** Change vs the immediately preceding observation (MoM for monthly, WoW for weekly). */
export function periodChanges(points: SeriesPoint[]): Array<number | null> {
  return points.map((point, index) => {
    const prior = points[index - 1];
    return !prior || prior.value === 0 ? null : point.value / prior.value - 1;
  });
}

/**
 * Z-score of each value against the trailing `window` values (excluding the
 * current one). Needs at least `minObs` prior values, else null.
 */
export function trailingZScores(values: Array<number | null>, window = 36, minObs = 24): Array<number | null> {
  return values.map((value, index) => {
    if (value === null) return null;
    const history = values.slice(Math.max(0, index - window), index).filter((v): v is number => v !== null);
    if (history.length < minObs) return null;
    const mean = history.reduce((s, v) => s + v, 0) / history.length;
    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / (history.length - 1);
    const sd = Math.sqrt(variance);
    return sd < 1e-12 ? null : (value - mean) / sd;
  });
}

export const ANOMALY_Z = 2;

export function buildReadings(points: SeriesPoint[], frequency: SeriesFrequency): KpiReading[] {
  const yoy = yoyChanges(points, frequency);
  const change = periodChanges(points);
  const window = frequency === "weekly" ? 156 : 36;
  const minObs = frequency === "weekly" ? 104 : 24;
  const z = trailingZScores(yoy, window, minObs);
  return points.map((point, index) => ({
    date: point.date,
    value: point.value,
    yoy: yoy[index],
    change: change[index],
    zScore: z[index],
    anomaly: z[index] !== null && Math.abs(z[index] as number) >= ANOMALY_Z,
  }));
}

/** Average of the last `n` non-null YoY readings; null if fewer than n are available. */
export function trailingAverageYoy(readings: KpiReading[], n: number): number | null {
  const recent = readings.slice(-n).map((r) => r.yoy);
  if (recent.length < n || recent.some((v) => v === null)) return null;
  return (recent as number[]).reduce((s, v) => s + v, 0) / n;
}

/** Weekly → calendar-month averages, dated on the first of the month (FRED convention). */
export function weeklyToMonthlyAverage(points: SeriesPoint[]): SeriesPoint[] {
  const buckets = new Map<string, number[]>();
  for (const p of points) {
    const key = monthKey(p.date);
    const bucket = buckets.get(key) ?? [];
    bucket.push(p.value);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({ date: `${key}-01`, value: values.reduce((s, v) => s + v, 0) / values.length }));
}

// ── Correlation & lead-lag ──────────────────────────────────────────────────

export function pearsonPairs(pairs: Array<[number, number]>): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx < 1e-18 || syy < 1e-18) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export interface LagCorrelation {
  /** Positive lag k = the leader's value at month t is paired with the follower at t+k. */
  lag: number;
  correlation: number | null;
  n: number;
}

export interface LeadLagResult {
  lags: LagCorrelation[];
  best: LagCorrelation | null;
  /** Correlation at the best lag in the first and second half of the overlap — a stability check. */
  firstHalf: number | null;
  secondHalf: number | null;
  stable: boolean;
  caveats: string[];
}

/**
 * In-sample lead-lag scan between two monthly series (typically YoY changes,
 * which makes NSA and SA levels comparable). This is exploratory, not a test of
 * predictive power: YoY series are strongly autocorrelated, so the effective
 * sample is far smaller than `n` and the best lag is chosen after looking.
 */
export function leadLag(
  leader: Array<{ date: string; value: number | null }>,
  follower: Array<{ date: string; value: number | null }>,
  maxLag = 12,
): LeadLagResult {
  const followerByMonth = new Map(
    follower.filter((p) => p.value !== null).map((p) => [monthKey(p.date), p.value as number]),
  );
  const leaderClean = leader.filter((p) => p.value !== null) as Array<{ date: string; value: number }>;
  const pairsAt = (lag: number): Array<[number, number]> =>
    leaderClean
      .map((p) => {
        const y = followerByMonth.get(shiftMonthKey(monthKey(p.date), lag));
        return y === undefined ? null : ([p.value, y] as [number, number]);
      })
      .filter((pair): pair is [number, number] => pair !== null);

  const lags: LagCorrelation[] = [];
  for (let lag = 0; lag <= maxLag; lag += 1) {
    const pairs = pairsAt(lag);
    lags.push({ lag, correlation: pearsonPairs(pairs), n: pairs.length });
  }
  const usable = lags.filter((l) => l.correlation !== null && l.n >= 24);
  const best = usable.length
    ? usable.reduce((a, b) => (Math.abs(b.correlation as number) > Math.abs(a.correlation as number) ? b : a))
    : null;

  let firstHalf: number | null = null;
  let secondHalf: number | null = null;
  if (best) {
    const pairs = pairsAt(best.lag);
    const mid = Math.floor(pairs.length / 2);
    firstHalf = pearsonPairs(pairs.slice(0, mid));
    secondHalf = pearsonPairs(pairs.slice(mid));
  }
  const stable =
    best !== null &&
    firstHalf !== null &&
    secondHalf !== null &&
    Math.sign(firstHalf) === Math.sign(best.correlation as number) &&
    Math.sign(secondHalf) === Math.sign(best.correlation as number) &&
    Math.abs(firstHalf) >= 0.3 &&
    Math.abs(secondHalf) >= 0.3;

  const caveats = [
    "In-sample Pearson correlation of YoY changes. It describes co-movement and does not demonstrate predictive power.",
    "YoY series overlap 11 of 12 months with their neighbours, so observations are not independent and naive significance would overstate confidence.",
    "The best lag is selected after scanning 0–" + maxLag + " months (a multiple-comparison choice).",
  ];
  if (best && !stable) caveats.push("The relationship is not stable across the two halves of the sample.");
  return { lags, best, firstHalf, secondHalf, stable, caveats };
}

// ── Simple OLS (one regressor) for fuel-adjusted residuals ─────────────────

export interface SimpleFit {
  intercept: number;
  slope: number;
  rSquared: number;
  n: number;
  residualSd: number;
}

export function simpleRegression(pairs: Array<[number, number]>): SimpleFit | null {
  const n = pairs.length;
  if (n < 12) return null;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx < 1e-18) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const sse = pairs.reduce((s, [x, y]) => s + (y - (intercept + slope * x)) ** 2, 0);
  return { intercept, slope, rSquared: syy < 1e-18 ? 0 : 1 - sse / syy, n, residualSd: Math.sqrt(sse / Math.max(1, n - 2)) };
}

// ── Freshness ───────────────────────────────────────────────────────────────

function endOfPeriod(date: string, frequency: SeriesFrequency): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (frequency === "weekly") return t; // dated on the week-ending day
  const d = new Date(t);
  const months = frequency === "quarterly" ? 3 : 1;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 0);
}

/**
 * Compare the latest observation with what *should* be published by `asOf`
 * given the series cadence and typical publication lag.
 *   fresh   — the latest expected period is present
 *   lagging — one period behind (a release may be pending or slipped)
 *   stale   — two or more periods behind; treat readings as out of date
 */
export function seriesFreshness(
  lastObservation: string | null,
  frequency: SeriesFrequency,
  publicationLagDays: number,
  asOf: Date,
): { freshness: Freshness; periodsBehind: number; note: string } {
  if (!lastObservation) return { freshness: "stale", periodsBehind: Infinity, note: "No observations available." };
  const periodDays = frequency === "weekly" ? 7 : frequency === "quarterly" ? 91 : 30.44;
  const availableUntil = asOf.getTime() - publicationLagDays * DAY_MS;
  const lastEnd = endOfPeriod(lastObservation, frequency);
  const gapDays = (availableUntil - lastEnd) / DAY_MS;
  const periodsBehind = Math.max(0, Math.floor(gapDays / periodDays));
  const freshness: Freshness = periodsBehind === 0 ? "fresh" : periodsBehind === 1 ? "lagging" : "stale";
  const note =
    freshness === "fresh"
      ? "Latest expected period is published."
      : `${periodsBehind} period${periodsBehind > 1 ? "s" : ""} behind the expected release cadence (assumes ~${publicationLagDays}-day publication lag).`;
  return { freshness, periodsBehind, note };
}
