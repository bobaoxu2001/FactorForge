/**
 * Strategy intelligence layer — deterministic, research-grade synthesis on top
 * of an existing backtest result + market-stress diagnostics + market regime.
 *
 * Everything here is computed from data the pipeline already produces (equity
 * curve, metrics, stress diagnostics, strategy rules) — no new "model" is
 * trained and nothing is fabricated. The goal is to make each strategy read as
 * a research object (regime fit, factor tilt, catalyst sensitivity, downside-risk
 * priority, confidence, a suggested next test, and a research-gate classification)
 * rather than a static metric dump.
 */

import type { BacktestResult } from "@/types/backtest";
import type { StrategyStressDiagnostics } from "@/lib/quant/marketStress";

export type Tilt = "high" | "moderate" | "low" | "negative";

export interface FactorTilt {
  factor: string;
  tilt: Tilt;
  weight: number; // 0–1, drives the bar width
}

export type ResearchGateKind = "observe" | "investigate" | "watchlist";

export interface StrategyIntel {
  baseScore: number;
  stressAdjustedScore: number;
  regimeFit: { score: number; label: string };
  regimeSensitivity: { level: "high" | "moderate" | "low"; note: string };
  factorExposure: FactorTilt[];
  catalystSensitivity: { score: number; label: string };
  recentDecomposition: {
    windowLabel: string;
    strategyReturn: number;
    benchmarkReturn: number;
    marketComponent: number;
    selectionComponent: number;
  };
  benchmarkBehavior: { upCapture: number | null; downCapture: number | null; label: string };
  downsideRiskPriority: { score: number; label: string };
  confidence: { score: number; label: string };
  modelFreshness: { label: string; asOf: string };
  dataQuality: { label: string; score: number };
  currentRiskState: { label: string; tone: "stable" | "watch" | "stress" };
  suggestedResearchTest: string;
  researchGate: { kind: ResearchGateKind; label: string; reason: string };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Affinity of each strategy family to a market regime (0–1). */
const REGIME_AFFINITY: Record<string, { "risk-on": number; neutral: number; "risk-off": number }> = {
  breakout: { "risk-on": 0.9, neutral: 0.55, "risk-off": 0.3 },
  momentum: { "risk-on": 0.85, neutral: 0.55, "risk-off": 0.32 },
  "mean reversion": { "risk-on": 0.5, neutral: 0.62, "risk-off": 0.6 },
  rotation: { "risk-on": 0.55, neutral: 0.68, "risk-off": 0.82 },
};

const CATALYST_BASE: Record<string, number> = { breakout: 60, momentum: 50, "mean reversion": 42, rotation: 30 };

function behavioralFactorExposure(result: BacktestResult): FactorTilt[] {
  const t = result.type;
  const m = result.metrics;
  const tiltFor = (w: number): Tilt => (w >= 0.66 ? "high" : w >= 0.4 ? "moderate" : w > 0 ? "low" : "negative");

  // Priors from the strategy family, nudged by realized statistics.
  let momentum = t === "momentum" || t === "breakout" ? 0.8 : t === "rotation" ? 0.4 : 0.25;
  let trend = t === "breakout" ? 0.7 : t === "momentum" ? 0.6 : t === "rotation" ? 0.55 : 0.35;
  let lowVol = t === "rotation" ? 0.8 : t === "mean reversion" ? 0.5 : 0.3;
  const reversion = t === "mean reversion" ? 0.7 : t === "rotation" ? 0.35 : 0.2;

  // Nudge by realized stats: strong return lifts momentum; low vol + high win rate lift low-vol.
  momentum = clamp(momentum + (m.annualizedReturn > 0.1 ? 0.1 : 0) - (m.annualizedReturn < 0 ? 0.1 : 0), 0, 1);
  lowVol = clamp(lowVol + (m.volatility < 0.18 && m.winRate > 0.55 ? 0.12 : 0), 0, 1);
  trend = clamp(trend + (m.maxDrawdown > -0.15 ? 0.08 : 0), 0, 1);

  return [
    { factor: "Momentum", tilt: tiltFor(momentum), weight: momentum },
    { factor: "Trend", tilt: tiltFor(trend), weight: trend },
    { factor: "Low volatility", tilt: tiltFor(lowVol), weight: lowVol },
    { factor: "Mean reversion", tilt: tiltFor(reversion), weight: reversion },
  ];
}

function benchmarkCapture(result: BacktestResult): { upCapture: number | null; downCapture: number | null; label: string } {
  const curve = result.equityCurve;
  if (curve.length < 20) return { upCapture: null, downCapture: null, label: "Insufficient history" };
  const window = curve.slice(-252);
  const up: { s: number; b: number }[] = [];
  const down: { s: number; b: number }[] = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1];
    const cur = window[i];
    if (prev.equity <= 0 || prev.benchmarkEquity <= 0) continue;
    const s = cur.equity / prev.equity - 1;
    const b = cur.benchmarkEquity / prev.benchmarkEquity - 1;
    if (b > 0) up.push({ s, b });
    else if (b < 0) down.push({ s, b });
  }
  const upB = mean(up.map((x) => x.b));
  const downB = mean(down.map((x) => x.b));
  const upCapture = upB !== 0 && up.length ? mean(up.map((x) => x.s)) / upB : null;
  const downCapture = downB !== 0 && down.length ? mean(down.map((x) => x.s)) / downB : null;
  let label = "Tracks benchmark";
  if (upCapture !== null && downCapture !== null) {
    if (downCapture < upCapture - 0.15) label = "Asymmetric — captures less downside";
    else if (downCapture > upCapture + 0.15) label = "Lags up, exposed down — review";
    else label = "Symmetric participation";
  }
  return { upCapture, downCapture, label };
}

function recentDecomposition(result: BacktestResult) {
  const curve = result.equityCurve;
  const w = Math.min(63, curve.length - 1);
  const windowLabel = `Last ~${w} sessions`;
  if (w < 2) {
    return { windowLabel, strategyReturn: 0, benchmarkReturn: 0, marketComponent: 0, selectionComponent: 0 };
  }
  const start = curve[curve.length - 1 - w];
  const end = curve[curve.length - 1];
  const strategyReturn = start.equity > 0 ? end.equity / start.equity - 1 : 0;
  const benchmarkReturn = start.benchmarkEquity > 0 ? end.benchmarkEquity / start.benchmarkEquity - 1 : 0;
  return {
    windowLabel,
    strategyReturn,
    benchmarkReturn,
    marketComponent: benchmarkReturn,
    selectionComponent: strategyReturn - benchmarkReturn,
  };
}

export function buildStrategyIntel(params: {
  result: BacktestResult;
  diagnostics?: StrategyStressDiagnostics;
  regime: { regime: string; stressScore: number };
  status?: string;
}): StrategyIntel {
  const { result, diagnostics, regime, status } = params;
  const m = result.metrics;
  const regimeKey = (regime.regime as "risk-on" | "neutral" | "risk-off") ?? "neutral";

  const baseScore = diagnostics?.baseScore ?? 0;
  const stressAdjustedScore = diagnostics?.stressAdjustedScore ?? baseScore;

  // Regime fit
  const affinity = REGIME_AFFINITY[result.type]?.[regimeKey] ?? 0.5;
  const recentRel = diagnostics?.recentReturnVsBenchmark ?? m.excessReturn;
  const regimeFitScore = Math.round(
    clamp(affinity * 70 + (recentRel > 0 ? 16 : 0) + (stressAdjustedScore >= baseScore ? 14 : 4), 5, 98),
  );
  const regimeFitLabel =
    regimeFitScore >= 66 ? "Well-aligned with the current regime" : regimeFitScore >= 45 ? "Partial fit — mixed signals" : "Out of favor in this regime";

  // Regime sensitivity (how regime-dependent the outcome is)
  const sens = mean([diagnostics?.drawdownSensitivity ?? 50, diagnostics?.volatilitySensitivity ?? 50]);
  const regimeSensitivity = {
    level: (sens >= 66 ? "high" : sens >= 40 ? "moderate" : "low") as "high" | "moderate" | "low",
    note:
      sens >= 66
        ? "Outcome is highly regime-dependent — expect wide dispersion across conditions."
        : sens >= 40
          ? "Moderately regime-dependent — performance shifts with volatility and drawdown."
          : "Relatively regime-stable — less dispersion across conditions.",
  };

  // Catalyst sensitivity
  const turnover = clamp(Math.min(m.tradeCount, 40) / 40, 0, 1) * 20;
  const shortHold = m.averageHoldingDays < 10 ? 20 : m.averageHoldingDays < 25 ? 10 : 0;
  const volBump = m.volatility > 0.3 ? 10 : 0;
  const catScore = Math.round(clamp((CATALYST_BASE[result.type] ?? 40) + turnover + shortHold + volBump - 10, 5, 95));
  const catalystSensitivity = {
    score: catScore,
    label: catScore >= 65 ? "Event/catalyst-reactive" : catScore >= 45 ? "Moderately catalyst-sensitive" : "Slow / structural",
  };

  // Downside-risk priority (higher = more attention warranted)
  const curDD = diagnostics?.currentDrawdown ?? 0;
  const dVol = diagnostics?.downsideVolatility ?? Math.max(0, m.volatility * 0.7);
  const downsideScore = Math.round(
    clamp(Math.abs(m.maxDrawdown) * 115 + Math.abs(curDD) * 150 + dVol * 80, 0, 100),
  );
  const downsideRiskPriority = {
    score: downsideScore,
    label: downsideScore >= 70 ? "Elevated — prioritize review" : downsideScore >= 45 ? "Moderate" : "Contained",
  };

  // Confidence
  const sampleFactor = clamp(Math.min(m.tradeCount, 30) / 30, 0, 1);
  const dataFactor = result.dataStatus.isFallback ? 0.5 : result.dataStatus.adjusted ? 1 : 0.85;
  const sharpeFactor = clamp(m.sharpe / 1.5, 0, 1);
  const winFactor = clamp(m.winRate, 0, 1);
  const confScore = Math.round(
    clamp(100 * (0.3 * sampleFactor + 0.25 * dataFactor + 0.25 * sharpeFactor + 0.2 * winFactor), 5, 95),
  );
  const confidence = {
    score: confScore,
    label: confScore >= 65 ? "Higher-evidence" : confScore >= 45 ? "Moderate-evidence" : "Lower-evidence",
  };

  // Freshness + data quality
  const asOf = result.equityCurve[result.equityCurve.length - 1]?.date ?? result.dataStatus.updatedAt;
  const updated = new Date(result.dataStatus.updatedAt).getTime();
  const daysOld = Number.isFinite(updated) ? (Date.now() - updated) / 86_400_000 : NaN;
  const freshLabel = !Number.isFinite(daysOld) ? "As of last bar" : daysOld <= 2 ? "Fresh" : daysOld <= 7 ? "Recent" : "Aging — re-fetch";
  const dataQuality = {
    label: result.dataStatus.isFallback ? "Fallback / demo data" : result.dataStatus.adjusted ? "Adjusted real data" : "Raw real data",
    score: result.dataStatus.isFallback ? 40 : result.dataStatus.adjusted ? 95 : 80,
  };

  // Current risk state
  const riskTone = (diagnostics?.status ?? "stable") === "under stress" ? "stress" : (diagnostics?.status ?? "stable") === "watch" ? "watch" : "stable";
  const currentRiskState = {
    tone: riskTone as "stable" | "watch" | "stress",
    label: riskTone === "stress" ? "Under stress" : riskTone === "watch" ? "Watch" : "Stable",
  };

  // Suggested next research test (targets the weakest dimension)
  let suggestedResearchTest: string;
  if (m.tradeCount < 8) suggestedResearchTest = "Extend the backtest window or universe to grow the trade sample before any observation admission.";
  else if (downsideScore >= 70) suggestedResearchTest = "Add a volatility/regime filter and re-test the drawdown profile under stress.";
  else if (regimeFitScore < 45) suggestedResearchTest = "Re-run under the opposite regime to confirm the edge isn't regime-specific.";
  else if (confScore < 50) suggestedResearchTest = "Validate with walk-forward out-of-sample slices before observation.";
  else suggestedResearchTest = "Stress-test position sizing and slippage, then add to the paper-observation queue.";

  // Research gate classification. These labels intentionally avoid buy/sell or
  // investable recommendation language; they only describe observation status.
  let researchGate: StrategyIntel["researchGate"];
  const isCandidate = status === "radar candidate";
  const isRejected = status === "rejected";
  if (isCandidate && confScore >= 52 && downsideScore < 72 && stressAdjustedScore >= baseScore - 6) {
    researchGate = { kind: "observe", label: "Eligible for paper observation", reason: "Adequate evidence, contained downside, and a stress-adjusted score that holds up for simulation review." };
  } else if (isRejected || downsideScore >= 82 || confScore < 35) {
    researchGate = { kind: "watchlist", label: "Park on watchlist", reason: "Downside risk or evidence quality is below the bar for simulated observation." };
  } else {
    researchGate = { kind: "investigate", label: "Needs one more validation", reason: "Promising but not yet clear of the gates; run one more research test before observation." };
  }

  return {
    baseScore,
    stressAdjustedScore,
    regimeFit: { score: regimeFitScore, label: regimeFitLabel },
    regimeSensitivity,
    factorExposure: behavioralFactorExposure(result),
    catalystSensitivity,
    recentDecomposition: recentDecomposition(result),
    benchmarkBehavior: benchmarkCapture(result),
    downsideRiskPriority,
    confidence,
    modelFreshness: { label: freshLabel, asOf },
    dataQuality,
    currentRiskState,
    suggestedResearchTest,
    researchGate,
  };
}
