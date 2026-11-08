import { predict, scoreForecast, sliceToCutoff, type ForecastScore, type Horizon, type Prediction } from "./forecast";
import type { PriceSeries } from "./market";

/**
 * Walk-forward evaluation of the baseline forecast.
 *
 * At each origin (every `step` bars) the model sees only bars up to that
 * origin, makes its forecast, and is scored `horizon` bars later. Nothing is
 * refitted on the test period. Origins whose horizons overlap are not
 * independent, so every count is reported next to an "effective n"
 * (n × step / horizon when the horizon is longer than the step).
 *
 * The question this answers is narrow: is the 80% range honest, and is there
 * any directional skill worth acting on? A direction is "validated" only when
 * the hit rate beats 50% at p < 0.05 on the effective n, the Brier score beats
 * the 0.25 of a coin flip, and both halves of the sample agree.
 */

export type Regime = "calm" | "normal" | "stressed";

export interface WalkForwardSample {
  origin: string;
  regime: Regime;
  prediction: Prediction;
  score: ForecastScore;
  /** Trailing-mean drift forecast, the "slightly smarter" rival to zero drift. */
  driftForecast: number;
}

export interface WalkForwardSummary {
  instrument: string;
  horizon: Horizon;
  n: number;
  effectiveN: number;
  coverage: number | null;
  relCoverage: number | null;
  maeZero: number | null;
  rmseZero: number | null;
  maeDrift: number | null;
  rmseDrift: number | null;
  brier: number | null;
  brierSkill: number | null;
  hitRate: number | null;
  /** Share of outcomes that were positive: what "always up" would have scored. */
  upShare: number | null;
  pValue: number | null;
  directionValidated: boolean;
  validationNote: string;
  byRegime: Record<Regime, { n: number; coverage: number | null; maeZero: number | null }>;
  calibration: Array<{ bin: string; n: number; meanP: number; observedUp: number }>;
  firstOrigin: string | null;
  lastOrigin: string | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Normal approximation to a one-sided binomial test of hit rate > 0.5. */
export function binomialPValue(hits: number, n: number): number | null {
  if (n <= 0) return null;
  const z = (hits - 0.5 * n) / Math.sqrt(0.25 * n);
  return 1 - normalCdf(z);
}

export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Trailing 20-bar realized volatility percentile against the previous 250 bars → regime per date. */
export function regimeByDate(series: PriceSeries): Map<string, Regime> {
  const r = series.adj.slice(1).map((p, i) => Math.log(p / series.adj[i]));
  const vol: Array<number | null> = r.map((_, i) => {
    if (i < 19) return null;
    const w = r.slice(i - 19, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (w.length - 1));
  });
  const out = new Map<string, Regime>();
  vol.forEach((v, i) => {
    if (v === null || i < 270) return;
    const hist = vol.slice(i - 250, i).filter((x): x is number => x !== null);
    const pct = hist.filter((x) => x < v).length / hist.length;
    out.set(series.dates[i + 1], pct > 2 / 3 ? "stressed" : pct < 1 / 3 ? "calm" : "normal");
  });
  return out;
}

export function walkForward(
  asset: PriceSeries,
  bench: PriceSeries | null,
  regimeSource: PriceSeries,
  horizon: Horizon,
  step = 5,
  until?: string,
): WalkForwardSample[] {
  const regimes = regimeByDate(regimeSource);
  const samples: WalkForwardSample[] = [];
  const last = until ? asset.dates.filter((d) => d <= until).length - 1 : asset.dates.length - 1;
  for (let i = 260; i + horizon <= last; i += step) {
    const origin = asset.dates[i];
    const { dataAsOf, prediction } = predict({ instrument: asset.symbol, benchmark: bench?.symbol ?? null, horizon, informationCutoff: origin }, asset, bench);
    if (prediction.status !== "OK") continue;
    // Score only against data inside the evaluation window.
    const visible = until ? sliceToCutoff(asset, until) : asset;
    const visibleBench = bench && until ? sliceToCutoff(bench, until) : bench;
    const score = scoreForecast({ dataAsOf, horizon, prediction, costBps: 0 }, visible, visibleBench);
    if (score.status !== "scored") continue;
    const past = asset.adj.slice(Math.max(0, i - 250), i + 1);
    const drift = past.length > 1 ? Math.log(past.at(-1)! / past[0]) / (past.length - 1) : 0;
    samples.push({ origin, regime: regimes.get(origin) ?? "normal", prediction, score, driftForecast: Math.exp(drift * horizon) - 1 });
  }
  return samples;
}

export function summarize(instrument: string, horizon: Horizon, samples: WalkForwardSample[], step = 5): WalkForwardSummary {
  const scored = samples.filter((s) => s.score.realized !== null);
  const n = scored.length;
  const effectiveN = horizon > step ? Math.max(1, Math.floor((n * step) / horizon)) : n;
  const realized = scored.map((s) => s.score.realized!);
  const cov = scored.map((s) => s.score.inInterval).filter((x): x is boolean => x !== null);
  const rel = scored.map((s) => s.score.inRelInterval).filter((x): x is boolean => x !== null);
  const errZero = realized;
  const errDrift = scored.map((s) => s.score.realized! - s.driftForecast);
  const briers = scored.map((s) => s.score.brier).filter((x): x is number => x !== null);
  const calls = scored.filter((s) => s.prediction.pUp !== null);
  const hits = calls.filter((s) => (s.prediction.pUp! >= 0.5) === (s.score.realized! > 0)).length;
  const hitRate = calls.length ? hits / calls.length : null;
  const effectiveHits = hitRate === null ? 0 : Math.round(hitRate * effectiveN);
  const pValue = hitRate === null ? null : binomialPValue(effectiveHits, effectiveN);
  const brier = mean(briers);
  const brierSkill = brier === null ? null : 1 - brier / 0.25;

  const half = Math.floor(calls.length / 2);
  const halfRate = (xs: WalkForwardSample[]) => (xs.length ? xs.filter((s) => (s.prediction.pUp! >= 0.5) === (s.score.realized! > 0)).length / xs.length : 0);
  const stable = calls.length >= 20 && halfRate(calls.slice(0, half)) > 0.5 && halfRate(calls.slice(half)) > 0.5;
  const directionValidated = pValue !== null && pValue < 0.05 && (brierSkill ?? 0) > 0 && stable;
  const validationNote = n === 0
    ? "No scored forecasts yet."
    : directionValidated
      ? `Hit rate ${(hitRate! * 100).toFixed(0)}% on ${effectiveN} effective observations (p = ${pValue!.toFixed(3)}), Brier better than a coin flip, both halves agree.`
      : `Not validated: hit rate ${(hitRate! * 100).toFixed(0)}% on ${effectiveN} effective observations (p = ${pValue?.toFixed(2) ?? "n/a"})${(brierSkill ?? 0) <= 0 ? ", Brier no better than a coin flip" : ""}${stable ? "" : ", halves disagree"}.`;

  const byRegime = Object.fromEntries(
    (["calm", "normal", "stressed"] as Regime[]).map((g) => {
      const xs = scored.filter((s) => s.regime === g);
      const c = xs.map((s) => s.score.inInterval).filter((x): x is boolean => x !== null);
      return [g, { n: xs.length, coverage: c.length ? c.filter(Boolean).length / c.length : null, maeZero: mean(xs.map((s) => Math.abs(s.score.realized!))) }];
    }),
  ) as WalkForwardSummary["byRegime"];

  const bins = [
    [0, 0.45],
    [0.45, 0.5],
    [0.5, 0.55],
    [0.55, 0.6],
    [0.6, 1.01],
  ];
  const calibration = bins
    .map(([lo, hi]) => {
      const xs = calls.filter((s) => s.prediction.pUp! >= lo && s.prediction.pUp! < hi);
      return {
        bin: hi > 1 ? `≥ ${lo.toFixed(2)}` : `${lo.toFixed(2)}–${hi.toFixed(2)}`,
        n: xs.length,
        meanP: mean(xs.map((s) => s.prediction.pUp!)) ?? 0,
        observedUp: xs.length ? xs.filter((s) => s.score.realized! > 0).length / xs.length : 0,
      };
    })
    .filter((b) => b.n > 0);

  return {
    instrument,
    horizon,
    n,
    effectiveN,
    coverage: cov.length ? cov.filter(Boolean).length / cov.length : null,
    relCoverage: rel.length ? rel.filter(Boolean).length / rel.length : null,
    maeZero: mean(errZero.map(Math.abs)),
    rmseZero: n ? Math.sqrt(mean(errZero.map((e) => e * e))!) : null,
    maeDrift: mean(errDrift.map(Math.abs)),
    rmseDrift: n ? Math.sqrt(mean(errDrift.map((e) => e * e))!) : null,
    brier,
    brierSkill,
    hitRate,
    upShare: n ? realized.filter((x) => x > 0).length / n : null,
    pValue,
    directionValidated,
    validationNote,
    byRegime,
    calibration,
    firstOrigin: scored[0]?.origin ?? null,
    lastOrigin: scored.at(-1)?.origin ?? null,
  };
}
