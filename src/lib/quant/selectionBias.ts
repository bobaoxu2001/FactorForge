import type { BacktestResult } from "@/types/backtest";
import { dailyReturns } from "./indicators";
import { DAILY_RISK_FREE_RATE } from "./metrics";

/**
 * Selection-bias (multiple-testing) diagnostics for "best of N" backtests.
 *
 * The strategy showcase runs each rule on every symbol and keeps the strongest
 * run. Picking a maximum inflates Sharpe even when no run has real skill, so the
 * selected run is tested against the Sharpe that the best of N skill-less runs
 * would reach by luck — the Deflated Sharpe Ratio of Bailey & López de Prado
 * (2014), which also corrects for sample length, skew and fat tails.
 */

const TRADING_DAYS = 252;
const EULER_GAMMA = 0.5772156649015329;
const VOL_EPSILON = 1e-12;

/** Confidence a selected run must reach to count as distinguishable from luck. */
export const DSR_CONFIDENCE = 0.95;

/** Inverse standard-normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Standard-normal CDF via a Chebyshev erfc fit (fractional error < 1.2e-7). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const erfc =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/** Expected maximum of `trials` independent standard normals: (1−γ)Φ⁻¹(1−1/N) + γΦ⁻¹(1−1/(N·e)). */
export function expectedMaxStandardNormal(trials: number): number {
  if (trials <= 1) return 0;
  return (1 - EULER_GAMMA) * inverseNormalCdf(1 - 1 / trials) + EULER_GAMMA * inverseNormalCdf(1 - 1 / (trials * Math.E));
}

/**
 * Expected maximum annualised Sharpe ratio among `trials` independent strategies
 * with zero true Sharpe, each estimated over `years` of data (SR estimation
 * error ≈ 1/√years).
 */
export function expectedMaxSharpe(trials: number, years: number): number {
  if (trials <= 1 || years <= 0) return 0;
  return expectedMaxStandardNormal(trials) / Math.sqrt(years);
}

export interface ReturnMoments {
  n: number;
  /** Per-period (daily) Sharpe ratio, excess of the configured risk-free rate. */
  sharpe: number;
  skew: number;
  /** Raw (non-excess) kurtosis; 3 for a normal distribution. */
  kurtosis: number;
}

export function returnMoments(returns: number[]): ReturnMoments | null {
  const n = returns.length;
  if (n < 3) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const m2 = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const sd = Math.sqrt(m2);
  if (sd < VOL_EPSILON) return null;
  const m3 = returns.reduce((s, r) => s + (r - mean) ** 3, 0) / n;
  const m4 = returns.reduce((s, r) => s + (r - mean) ** 4, 0) / n;
  const sampleSd = Math.sqrt((m2 * n) / (n - 1));
  return { n, sharpe: (mean - DAILY_RISK_FREE_RATE) / sampleSd, skew: m3 / sd ** 3, kurtosis: m4 / m2 ** 2 };
}

/**
 * Probabilistic Sharpe ratio: probability that the true per-period Sharpe exceeds
 * `benchmarkSharpe`, given the estimate's sample length, skew and kurtosis.
 */
export function probabilisticSharpe(moments: ReturnMoments, benchmarkSharpe: number): number | null {
  const { n, sharpe, skew, kurtosis } = moments;
  const variance = 1 - skew * sharpe + ((kurtosis - 1) / 4) * sharpe ** 2;
  if (!(variance > 0)) return null;
  return normalCdf(((sharpe - benchmarkSharpe) * Math.sqrt(n - 1)) / Math.sqrt(variance));
}

export interface SelectionBiasSummary {
  /** Number of runs the selected one was picked from (incl. itself). */
  trials: number;
  selectedSymbol: string;
  observations: number;
  /** Annualised Sharpe of the selected run, as reported by the backtest. */
  sharpe: number;
  /** Annualised Sharpe the best of `trials` skill-less runs would reach by luck. */
  luckThreshold: number;
  /** P(true Sharpe > 0) for the selected run, ignoring that it was picked. */
  psr: number | null;
  /** P(true Sharpe > 0) after deflating for picking the best of `trials`. */
  dsr: number | null;
  /** True when `dsr` reaches {@link DSR_CONFIDENCE}. */
  survives: boolean;
}

function runMoments(result: BacktestResult): ReturnMoments | null {
  return returnMoments(dailyReturns(result.equityCurve.map((p) => p.equity)));
}

/**
 * Deflated Sharpe ratio of `selected`, picked as the best of `trials`.
 * The luck threshold SR₀ = √Var(SR_trials) · E[max Z_N] uses the dispersion of
 * the trials' own Sharpe estimates, so correlated trials (same rule, similar
 * symbols) raise the bar less than truly independent ones would.
 */
export function deflatedSharpeForSelection(selected: BacktestResult, trials: BacktestResult[]): SelectionBiasSummary {
  const trialSharpes = trials.map((t) => runMoments(t)?.sharpe ?? 0);
  const n = trialSharpes.length;
  const mean = trialSharpes.reduce((s, x) => s + x, 0) / Math.max(n, 1);
  const variance = n > 1 ? trialSharpes.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const sr0 = Math.sqrt(variance) * expectedMaxStandardNormal(n);
  const moments = runMoments(selected);
  const psr = moments ? probabilisticSharpe(moments, 0) : null;
  const dsr = moments ? probabilisticSharpe(moments, sr0) : null;
  return {
    trials: n,
    selectedSymbol: selected.symbol,
    observations: moments?.n ?? 0,
    sharpe: selected.metrics.sharpe,
    luckThreshold: sr0 * Math.sqrt(TRADING_DAYS),
    psr,
    dsr,
    survives: dsr !== null && dsr >= DSR_CONFIDENCE,
  };
}
