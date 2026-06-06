import type { BacktestResult, EquityPoint } from "@/types/backtest";
import type { FactorSnapshot, HistoricalPriceResult } from "@/types/market";
import type { RadarCandidate } from "@/types/strategy";
import { dailyReturns } from "./indicators";

/**
 * Market-stress / selloff regime engine.
 *
 * Everything here is DETERMINISTIC compute over the same price/factor/backtest
 * data the rest of the research pipeline already produces — no external LLM, no
 * hardcoded "stress" verdicts. The regime is classified from real breadth,
 * volatility-expansion, momentum, and one-day breadth-of-decline signals, so the
 * banner reflects the actual tape rather than a flashy fixed alarm. The prose
 * fields ("AI-style" memo / interpretations) are templated on top of these
 * numbers, never inventing levels of their own.
 *
 * Research only. None of these outputs are trading signals or advice.
 */

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const ANNUALIZE = Math.sqrt(252);

export type StressTone = "stress" | "caution" | "stable";
export type DataQuality = "real" | "mixed" | "fallback";

export interface MarketStressReport {
  /** Underlying regime classification. */
  regime: "risk-off" | "neutral" | "risk-on";
  /** Headline label for the banner, e.g. "Market Stress Detected". */
  regimeLabel: string;
  /** Accent family used by the UI — kept muted (amber/rose), never alarm-red. */
  tone: StressTone;
  /** 0–100 composite, higher = more stressed. */
  stressScore: number;
  volatilityState: "expanding" | "elevated" | "normal" | "compressed";
  breadthState: "weakening" | "mixed" | "broad";
  momentumState: "under pressure" | "neutral" | "leading";
  liquidityState: "gap risk" | "thinning" | "orderly";
  // Engine-derived numbers backing the states above.
  breadthPct: number;
  aboveTrend: number;
  symbolCount: number;
  avgVolatility20d: number;
  volExpansion: number;
  avgMomentum20d: number;
  avgOneDay: number;
  avgFiveDay: number;
  advancers: number;
  decliners: number;
  declinerShare: number;
  avgVolumeSurge: number | null;
  worstName: { symbol: string; oneDay: number } | null;
  // Data provenance.
  realCount: number;
  fallbackCount: number;
  dataQuality: DataQuality;
  /** ISO timestamp the report was generated. */
  updatedAt: string;
  /** Freshest underlying bar date across the universe, if known. */
  asOf: string | null;
  headline: string;
  interpretation: string;
  /**
   * True only for the clearly-labeled illustrative stress preview. The live
   * report is always false. UI surfaces must badge preview reports as
   * non-live so a calm tape is never misread as a real selloff.
   */
  isPreview: boolean;
}

export interface StressInsightCard {
  title: string;
  state: string;
  tone: StressTone | "positive";
  explanation: string;
  confidence: number;
  dataQuality: DataQuality;
  researchAction: string;
}

export interface StrategyStressDiagnostics {
  status: "stable" | "watch" | "under stress";
  tone: StressTone;
  badges: string[];
  /** 0–100, higher = more drawdown-sensitive. */
  drawdownSensitivity: number;
  /** 0–100, higher = more volatility-sensitive. */
  volatilitySensitivity: number;
  /** Trailing 20-session strategy return minus benchmark over the same window. */
  recentReturnVsBenchmark: number;
  riskFlagCount: number;
  paperSuitable: boolean;
  // Drawdown-focused views.
  maxDrawdown: number;
  currentDrawdown: number;
  downsideVolatility: number;
  worstFiveDay: number;
  benchmarkRelativeDrawdown: number;
  recoveryDays: number | null;
  daysUnderwater: number;
  stopLossTriggers: number;
  // Stress-aware radar scoring.
  baseScore: number;
  stressAdjustedScore: number;
  fallbackActive: boolean;
}

export interface FactorStressGroup {
  group: string;
  condition: string;
  direction: "improving" | "weakening" | "stable";
  stressImpact: "elevated" | "moderate" | "low";
  confidence: number;
  interpretation: string;
}

export interface SelloffMemo {
  title: string;
  source: "deterministic";
  marketContext: string;
  factorBehavior: string;
  strategyRisk: string;
  radarImpact: string;
  paperObservation: string;
  nextExperiments: string[];
}

export interface PaperStressObservation {
  riskState: StressTone;
  riskStateLabel: string;
  activeCount: number;
  todaySimulatedPnl: number;
  todaySimulatedReturn: number;
  currentDrawdown: number;
  benchmarkRelative: number;
  resilientCount: number;
  underStressCount: number;
  notes: string[];
  timeline: Array<{ label: string; detail: string; state: "done" | "active" }>;
}

interface SymbolPulse {
  symbol: string;
  oneDay: number;
  fiveDay: number;
  vol20: number;
  vol60: number;
  isFallback: boolean;
}

function annualizedVol(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * ANNUALIZE;
}

function symbolPulse(result: HistoricalPriceResult): SymbolPulse | null {
  const closes = result.prices.map((price) => price.close);
  if (closes.length < 7) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const fiveAgo = closes[closes.length - 6];
  const returns = dailyReturns(closes);
  return {
    symbol: result.symbol,
    oneDay: prev ? last / prev - 1 : 0,
    fiveDay: fiveAgo ? last / fiveAgo - 1 : 0,
    vol20: annualizedVol(returns.slice(-20)),
    vol60: annualizedVol(returns.slice(-60)),
    isFallback: result.isFallback,
  };
}

function classifyDataQuality(realCount: number, total: number): DataQuality {
  if (total === 0) return "fallback";
  if (realCount === total) return "real";
  return realCount >= total / 2 ? "mixed" : "fallback";
}

/**
 * Build the market-wide stress / regime read from the live price + factor data.
 */
export function buildMarketStressReport(
  pricesBySymbol: Record<string, HistoricalPriceResult>,
  factors: FactorSnapshot[],
): MarketStressReport {
  const priceResults = Object.values(pricesBySymbol);
  const pulses = priceResults
    .map(symbolPulse)
    .filter((pulse): pulse is SymbolPulse => pulse !== null);

  const symbolCount = factors.length || pulses.length;
  const aboveTrend = factors.filter((factor) => factor.aboveSma200).length;
  const breadthPct = symbolCount > 0 ? aboveTrend / symbolCount : 0;

  const momentum20 = factors.map((f) => f.momentum20d).filter((v): v is number => v !== null);
  const avgMomentum20d = momentum20.reduce((sum, v) => sum + v, 0) / Math.max(momentum20.length, 1);
  const vol20Factors = factors.map((f) => f.volatility20d).filter((v): v is number => v !== null);
  const avgVolatility20d = vol20Factors.length > 0
    ? vol20Factors.reduce((sum, v) => sum + v, 0) / vol20Factors.length
    : pulses.reduce((sum, p) => sum + p.vol20, 0) / Math.max(pulses.length, 1);
  const surges = factors.map((f) => f.volumeSurge).filter((v): v is number => v !== null);
  const avgVolumeSurge = surges.length > 0 ? surges.reduce((sum, v) => sum + v, 0) / surges.length : null;

  const meanVol20 = pulses.reduce((sum, p) => sum + p.vol20, 0) / Math.max(pulses.length, 1);
  const meanVol60 = pulses.reduce((sum, p) => sum + p.vol60, 0) / Math.max(pulses.length, 1);
  const volExpansion = meanVol60 > 1e-6 ? meanVol20 / meanVol60 : 1;
  const avgOneDay = pulses.reduce((sum, p) => sum + p.oneDay, 0) / Math.max(pulses.length, 1);
  const avgFiveDay = pulses.reduce((sum, p) => sum + p.fiveDay, 0) / Math.max(pulses.length, 1);
  const decliners = pulses.filter((p) => p.oneDay < 0).length;
  const advancers = pulses.length - decliners;
  const declinerShare = pulses.length > 0 ? decliners / pulses.length : 0;
  const worstName = pulses.length > 0
    ? pulses.reduce((worst, p) => (p.oneDay < worst.oneDay ? p : worst))
    : null;

  // Component stresses, each 0–100 (higher = more stressed).
  const breadthStress = clamp((0.7 - breadthPct) / 0.7 * 100);
  const volStress = clamp(((volExpansion - 0.95) / 0.4) * 70 + ((avgVolatility20d - 0.25) / 0.3) * 40);
  const momentumStress = clamp(((0.03 - avgMomentum20d) / 0.1) * 100);
  const declineStress = clamp(((declinerShare - 0.4) / 0.45) * 100);
  const todayStress = clamp((-avgOneDay / 0.025) * 100);

  const stressScore = Math.round(
    breadthStress * 0.2 +
      volStress * 0.25 +
      momentumStress * 0.2 +
      declineStress * 0.15 +
      todayStress * 0.2,
  );

  const regime: MarketStressReport["regime"] =
    stressScore >= 62 ? "risk-off" : stressScore >= 42 ? "neutral" : "risk-on";
  const tone: StressTone = regime === "risk-off" ? "stress" : regime === "neutral" ? "caution" : "stable";
  const regimeLabel =
    stressScore >= 76 ? "Market Stress Detected" :
    regime === "risk-off" ? "Risk-Off Regime Active" :
    regime === "neutral" ? "Mixed / Transitional Regime" :
    "Risk-On Regime Active";

  const volatilityState: MarketStressReport["volatilityState"] =
    volExpansion >= 1.15 || avgVolatility20d > 0.45 ? "expanding" :
    avgVolatility20d > 0.3 ? "elevated" :
    avgVolatility20d < 0.18 ? "compressed" : "normal";
  const breadthState: MarketStressReport["breadthState"] =
    breadthPct < 0.4 ? "weakening" : breadthPct < 0.65 ? "mixed" : "broad";
  const momentumState: MarketStressReport["momentumState"] =
    avgMomentum20d < -0.01 ? "under pressure" : avgMomentum20d < 0.02 ? "neutral" : "leading";
  const liquidityState: MarketStressReport["liquidityState"] =
    declinerShare > 0.6 && (avgVolumeSurge ?? 0) > 1.15 ? "gap risk" :
    (avgVolumeSurge !== null && avgVolumeSurge < 0.8) ? "thinning" : "orderly";

  const realCount = priceResults.filter((r) => !r.isFallback).length;
  const fallbackCount = priceResults.length - realCount;
  const dataQuality = classifyDataQuality(realCount, priceResults.length);
  const asOf = factors.map((f) => f.date).filter(Boolean).sort().at(-1) ?? null;

  const headline = buildHeadline(regime, {
    breadthPct, aboveTrend, symbolCount, volatilityState, avgVolatility20d, declinerShare, avgOneDay,
  });
  const interpretation = buildInterpretation(regime, {
    breadthState, momentumState, volatilityState, liquidityState, avgMomentum20d, volExpansion,
  });

  return {
    regime, regimeLabel, tone, stressScore,
    volatilityState, breadthState, momentumState, liquidityState,
    breadthPct, aboveTrend, symbolCount,
    avgVolatility20d, volExpansion, avgMomentum20d, avgOneDay, avgFiveDay,
    advancers, decliners, declinerShare, avgVolumeSurge, worstName,
    realCount, fallbackCount, dataQuality, updatedAt: new Date().toISOString(), asOf,
    headline, interpretation, isPreview: false,
  };
}

/**
 * Clearly-labeled illustrative stress preview. NOT live data — it returns a
 * representative risk-off regime so reviewers can see how the stress surfaces
 * behave when the real tape is calm. `isPreview` is true and the UI badges it
 * as a non-live preview. It deliberately invents no price levels.
 */
export function buildPreviewStressReport(base: MarketStressReport): MarketStressReport {
  const symbolCount = base.symbolCount || 28;
  const aboveTrend = Math.max(0, Math.round(symbolCount * 0.32));
  const breadthPct = symbolCount > 0 ? aboveTrend / symbolCount : 0.32;
  const preview: MarketStressReport = {
    ...base,
    regime: "risk-off",
    regimeLabel: "Market Stress Detected",
    tone: "stress",
    stressScore: 78,
    volatilityState: "expanding",
    breadthState: "weakening",
    momentumState: "under pressure",
    liquidityState: "gap risk",
    breadthPct,
    aboveTrend,
    avgVolatility20d: 0.46,
    volExpansion: 1.28,
    avgMomentum20d: -0.052,
    avgOneDay: -0.022,
    avgFiveDay: -0.047,
    advancers: Math.max(0, Math.round(symbolCount * 0.18)),
    decliners: Math.round(symbolCount * 0.82),
    declinerShare: 0.82,
    avgVolumeSurge: 1.45,
    worstName: base.worstName,
    isPreview: true,
  };
  preview.headline = buildHeadline("risk-off", {
    breadthPct, aboveTrend, symbolCount, volatilityState: "expanding", avgVolatility20d: 0.46, declinerShare: 0.82, avgOneDay: -0.022,
  });
  preview.interpretation = buildInterpretation("risk-off", {
    breadthState: "weakening", momentumState: "under pressure", volatilityState: "expanding", liquidityState: "gap risk", avgMomentum20d: -0.052, volExpansion: 1.28,
  });
  return preview;
}

function buildHeadline(
  regime: MarketStressReport["regime"],
  m: { breadthPct: number; aboveTrend: number; symbolCount: number; volatilityState: string; avgVolatility20d: number; declinerShare: number; avgOneDay: number },
): string {
  const breadth = `${m.aboveTrend}/${m.symbolCount} names hold their 200-day trend`;
  const decl = `${Math.round(m.declinerShare * 100)}% of the universe is lower on the session`;
  if (regime === "risk-off") {
    return `Volatility expansion detected: ${breadth} and ${decl}. Strategy performance should be interpreted under stressed market conditions.`;
  }
  if (regime === "neutral") {
    return `Mixed tape: ${breadth} while ${decl}. Treat backtest strength cautiously until breadth and volatility resolve.`;
  }
  return `Constructive tape: ${breadth} with contained volatility (${(m.avgVolatility20d * 100).toFixed(0)}% annualized). Risk signals are quiet, but drawdown discipline still applies.`;
}

function buildInterpretation(
  regime: MarketStressReport["regime"],
  m: { breadthState: string; momentumState: string; volatilityState: string; liquidityState: string; avgMomentum20d: number; volExpansion: number },
): string {
  const volPhrase = m.volExpansion >= 1.05
    ? `short-horizon volatility is running ${((m.volExpansion - 1) * 100).toFixed(0)}% above its 60-day baseline`
    : `short-horizon volatility is roughly in line with its 60-day baseline`;
  if (regime === "risk-off") {
    return `Breadth is ${m.breadthState} and momentum is ${m.momentumState}; ${volPhrase}. Favor benchmark-relative resilience and drawdown control over trailing-return rank, and read recent backtest strength with added skepticism.`;
  }
  if (regime === "neutral") {
    return `Breadth is ${m.breadthState}, momentum is ${m.momentumState}, and ${volPhrase}. The regime is transitional — monitor whether participation broadens or volatility keeps expanding before promoting candidates.`;
  }
  return `Breadth is ${m.breadthState} and momentum is ${m.momentumState}; ${volPhrase}. Conditions support continuation research, but keep stops and position sizing documented in case the regime turns.`;
}

/**
 * Six insight cards used by the AI Market and Overview surfaces. Each is a short
 * deterministic read tied to engine numbers, with a confidence score and a
 * suggested research action (never a trade instruction).
 */
export function buildStressInsightCards(report: MarketStressReport): StressInsightCard[] {
  const baseConfidence = Math.round(58 + (report.realCount / Math.max(report.realCount + report.fallbackCount, 1)) * 32);
  const dq = report.dataQuality;
  const cards: StressInsightCard[] = [
    {
      title: `Market Regime: ${titleCase(report.regime)}`,
      state: report.regimeLabel,
      tone: report.tone,
      explanation: `Composite stress score is ${report.stressScore}/100 from breadth, volatility expansion, momentum, and breadth-of-decline. ${report.aboveTrend}/${report.symbolCount} names hold their 200-day trend.`,
      confidence: clamp(baseConfidence + (report.stressScore > 60 ? 6 : 0), 50, 95),
      dataQuality: dq,
      researchAction: report.regime === "risk-off"
        ? "Re-rank candidates by drawdown control and benchmark-relative resilience, not trailing return."
        : "Track whether the regime persists before changing candidate priorities.",
    },
    {
      title: `Volatility: ${titleCase(report.volatilityState)}`,
      state: `${(report.avgVolatility20d * 100).toFixed(0)}% annualized · ${report.volExpansion >= 1 ? "+" : ""}${((report.volExpansion - 1) * 100).toFixed(0)}% vs 60d`,
      tone: report.volatilityState === "expanding" ? "stress" : report.volatilityState === "elevated" ? "caution" : "stable",
      explanation: `Average 20-day realized volatility is ${(report.avgVolatility20d * 100).toFixed(0)}% and short-horizon volatility is ${report.volExpansion >= 1.05 ? "expanding above" : "near"} its 60-day baseline.`,
      confidence: clamp(baseConfidence + 4, 50, 95),
      dataQuality: dq,
      researchAction: "Review strategy drawdown and stop behavior before interpreting recent backtest strength.",
    },
    {
      title: "Factor Rotation: Momentum",
      state: report.momentumState === "under pressure" ? "Momentum Under Pressure" : `Momentum ${titleCase(report.momentumState)}`,
      tone: report.momentumState === "under pressure" ? "stress" : report.momentumState === "neutral" ? "caution" : "positive",
      explanation: `Average 20-day momentum is ${(report.avgMomentum20d * 100).toFixed(1)}%. ${report.momentumState === "under pressure" ? "Recent winners are reversing sharply — trailing-return rank is less reliable here." : "Momentum leadership is intact but should be confirmed by breadth."}`,
      confidence: clamp(baseConfidence, 50, 95),
      dataQuality: dq,
      researchAction: "Avoid over-ranking strategies solely by trailing returns while momentum is unstable.",
    },
    {
      title: "Defensive Factors: Low-Volatility",
      state: report.regime === "risk-off" ? "Relative Strength Improving" : "Neutral",
      tone: report.regime === "risk-off" ? "positive" : "stable",
      explanation: `In a ${report.regime} tape, lower-volatility and trend-holding names (${report.aboveTrend}/${report.symbolCount} above SMA200) tend to show improving relative strength as higher-beta leaders de-rate.`,
      confidence: clamp(baseConfidence - 4, 45, 92),
      dataQuality: dq,
      researchAction: "Compare defensive vs high-beta strategy drawdowns to confirm the rotation in your own backtests.",
    },
    {
      title: "Liquidity: Participation",
      state: report.liquidityState === "gap risk" ? "Watch for gap risk" : titleCase(report.liquidityState),
      tone: report.liquidityState === "gap risk" ? "stress" : report.liquidityState === "thinning" ? "caution" : "stable",
      explanation: `${report.avgVolumeSurge !== null ? `Average volume surge is ${report.avgVolumeSurge.toFixed(2)}x the 20-day baseline. ` : ""}${report.liquidityState === "gap risk" ? "Heavy down-volume raises overnight gap risk for tightly-stopped strategies." : "Participation looks orderly, but gap risk rises if volume spikes into weakness."}`,
      confidence: clamp(baseConfidence - 6, 45, 90),
      dataQuality: dq,
      researchAction: "Stress-test stop placement against overnight gaps rather than intraday fills.",
    },
    {
      title: `Breadth: ${titleCase(report.breadthState)} participation`,
      state: `${report.aboveTrend}/${report.symbolCount} above SMA200`,
      tone: report.breadthState === "weakening" ? "stress" : report.breadthState === "mixed" ? "caution" : "positive",
      explanation: `${Math.round(report.breadthPct * 100)}% of the watchlist holds its 200-day trend and ${Math.round(report.declinerShare * 100)}% is lower today. ${report.breadthState === "weakening" ? "Narrow participation makes index-level strength fragile." : "Participation is reasonably broad."}`,
      confidence: clamp(baseConfidence + 2, 50, 95),
      dataQuality: dq,
      researchAction: "Confirm whether candidate strategies depend on the few remaining leaders.",
    },
  ];
  return cards;
}

// ----------------------------------------------------------------------------
// Per-strategy stress diagnostics + drawdown-focused views.
// ----------------------------------------------------------------------------

function downsideVolatility(returns: number[]): number {
  const negatives = returns.filter((r) => r < 0);
  if (negatives.length < 2) return 0;
  const variance = negatives.reduce((sum, r) => sum + r * r, 0) / negatives.length;
  return Math.sqrt(variance) * ANNUALIZE;
}

function worstRollingReturn(values: number[], window: number): number {
  let worst = 0;
  for (let i = window; i < values.length; i += 1) {
    const ret = values[i - window] !== 0 ? values[i] / values[i - window] - 1 : 0;
    if (ret < worst) worst = ret;
  }
  return worst;
}

/** Current drawdown of the strategy-relative-to-benchmark (excess) curve. */
function benchmarkRelativeDrawdown(curve: EquityPoint[]): number {
  const ratio = curve
    .filter((p) => p.benchmarkEquity > 0)
    .map((p) => p.equity / p.benchmarkEquity);
  if (ratio.length === 0) return 0;
  let peak = ratio[0];
  for (const value of ratio) peak = Math.max(peak, value);
  const last = ratio[ratio.length - 1];
  return peak > 0 ? last / peak - 1 : 0;
}

/** Sessions since the equity curve last printed a fresh high (0 = at highs). */
function daysUnderwaterFrom(curve: EquityPoint[]): number {
  if (curve.length === 0) return 0;
  let peak = curve[0].equity;
  let lastPeakIndex = 0;
  curve.forEach((point, index) => {
    if (point.equity >= peak) {
      peak = point.equity;
      lastPeakIndex = index;
    }
  });
  return curve.length - 1 - lastPeakIndex;
}

export function buildStrategyStressDiagnostics(
  result: BacktestResult,
  report: MarketStressReport,
  baseScore: number,
): StrategyStressDiagnostics {
  const curve = result.equityCurve;
  const equity = curve.map((p) => p.equity);
  const returns = dailyReturns(equity);
  const metrics = result.metrics;

  const currentDrawdown = curve[curve.length - 1]?.drawdown ?? 0;
  const downsideVol = downsideVolatility(returns);
  const worstFiveDay = worstRollingReturn(equity, 5);
  const benchRelDd = benchmarkRelativeDrawdown(curve);
  const daysUnderwater = daysUnderwaterFrom(curve);
  const recoveryDays = currentDrawdown >= -0.001 ? 0 : null;
  const stopLossTriggers = result.trades.filter((t) => /stop/i.test(t.exitReason)).length;

  // Trailing 20-session strategy vs benchmark.
  const lookback = Math.min(20, curve.length - 1);
  const recentStrat = lookback > 0 && curve[curve.length - 1 - lookback].equity > 0
    ? curve[curve.length - 1].equity / curve[curve.length - 1 - lookback].equity - 1 : 0;
  const recentBench = lookback > 0 && curve[curve.length - 1 - lookback].benchmarkEquity > 0
    ? curve[curve.length - 1].benchmarkEquity / curve[curve.length - 1 - lookback].benchmarkEquity - 1 : 0;
  const recentReturnVsBenchmark = recentStrat - recentBench;

  const drawdownSensitivity = Math.round(clamp((-metrics.maxDrawdown / 0.4) * 100));
  const volatilitySensitivity = Math.round(clamp(((metrics.volatility - 0.1) / 0.4) * 70 + (downsideVol / 0.4) * 40));
  const riskFlagCount = result.riskFlags.length;
  const fallbackActive = result.dataStatus.isFallback;

  // Status — tightened automatically when the broad regime is stressed.
  const riskOff = report.regime === "risk-off";
  const underStress =
    metrics.maxDrawdown < -0.3 ||
    currentDrawdown < (riskOff ? -0.12 : -0.18) ||
    (riskOff && benchRelDd < -0.1 && downsideVol > 0.3);
  const watch =
    !underStress && (
      currentDrawdown < (riskOff ? -0.05 : -0.08) ||
      drawdownSensitivity > 55 ||
      riskFlagCount > 0 ||
      (riskOff && recentReturnVsBenchmark < 0)
    );
  const status: StrategyStressDiagnostics["status"] = underStress ? "under stress" : watch ? "watch" : "stable";
  const tone: StressTone = underStress ? "stress" : watch ? "caution" : "stable";

  const highDrawdownRisk = metrics.maxDrawdown < -0.25 || currentDrawdown < -0.15;
  const paperSuitable = status !== "under stress" && metrics.maxDrawdown > -0.25 && metrics.sharpe > 0 && !highDrawdownRisk;

  const badges: string[] = [];
  if (status === "stable") badges.push("Resilient");
  if (status === "watch") badges.push("Watch");
  if (status === "under stress") badges.push("Under Stress");
  if (highDrawdownRisk) badges.push("High Drawdown Risk");
  if (fallbackActive) badges.push("Fallback Data Active");

  // Stress-adjusted radar score. Intensity ties the penalty to the live regime —
  // in a calm tape the adjusted score barely moves from the base score; in a
  // stressed tape drawdown/volatility/fallback risk are penalized harder and
  // benchmark-relative resilience + smooth equity are rewarded.
  const intensity = clamp(report.stressScore, 0, 100) / 100;
  const penalty = (drawdownSensitivity * 0.3 + volatilitySensitivity * 0.2 + (fallbackActive ? 18 : 0)) * intensity;
  const reward = (clamp(recentReturnVsBenchmark * 300, 0, 18) + (downsideVol < 0.2 ? 8 : 0) + (benchRelDd > -0.03 ? 6 : 0)) * intensity;
  const stressAdjustedScore = Math.round(clamp(baseScore - penalty + reward, 0, 100));

  return {
    status, tone, badges,
    drawdownSensitivity, volatilitySensitivity, recentReturnVsBenchmark, riskFlagCount, paperSuitable,
    maxDrawdown: metrics.maxDrawdown, currentDrawdown, downsideVolatility: downsideVol, worstFiveDay,
    benchmarkRelativeDrawdown: benchRelDd, recoveryDays, daysUnderwater, stopLossTriggers,
    baseScore, stressAdjustedScore, fallbackActive,
  };
}

/**
 * Map of strategyId → diagnostics for the radar shortlist (one best-symbol run
 * per strategy). Detail pages recompute on the fly for switched symbols.
 */
export function buildStressDiagnosticsByStrategy(
  candidates: RadarCandidate[],
  report: MarketStressReport,
): Record<string, StrategyStressDiagnostics> {
  const map: Record<string, StrategyStressDiagnostics> = {};
  for (const candidate of candidates) {
    map[candidate.result.strategyId] = buildStrategyStressDiagnostics(candidate.result, report, candidate.score);
  }
  return map;
}

// ----------------------------------------------------------------------------
// Factor breakdown under stress.
// ----------------------------------------------------------------------------

export function buildFactorStressBreakdown(
  report: MarketStressReport,
  factors: FactorSnapshot[],
): FactorStressGroup[] {
  const conf = Math.round(58 + (report.realCount / Math.max(report.symbolCount, 1)) * 30);
  const riskOff = report.regime === "risk-off";

  const momDir = report.avgMomentum20d > 0.01 ? "improving" : report.avgMomentum20d < -0.01 ? "weakening" : "stable";
  const abovePct = Math.round(report.breadthPct * 100);

  return [
    {
      group: "Momentum",
      condition: `Avg 20-day momentum ${(report.avgMomentum20d * 100).toFixed(1)}%`,
      direction: momDir,
      stressImpact: report.momentumState === "under pressure" ? "elevated" : "moderate",
      confidence: conf,
      interpretation: report.momentumState === "under pressure"
        ? "Momentum factor strength is weakening as recent winners experience sharper reversals. Avoid over-ranking strategies solely by trailing returns."
        : "Momentum is holding, but confirm leadership with breadth before trusting trailing-return rank.",
    },
    {
      group: "Trend",
      condition: `${report.aboveTrend}/${report.symbolCount} names above SMA200 (${abovePct}%)`,
      direction: report.breadthState === "broad" ? "improving" : report.breadthState === "weakening" ? "weakening" : "stable",
      stressImpact: report.breadthState === "weakening" ? "elevated" : "moderate",
      confidence: conf,
      interpretation: report.breadthState === "weakening"
        ? "Trend participation is thinning, so index-level strength is carried by fewer names. Use trend status as an admission gate, not a ranking input."
        : "Trend breadth is reasonably intact and remains a useful long-horizon regime filter.",
    },
    {
      group: "Volatility",
      condition: `${(report.avgVolatility20d * 100).toFixed(0)}% annualized · ${report.volExpansion >= 1 ? "+" : ""}${((report.volExpansion - 1) * 100).toFixed(0)}% vs 60d`,
      direction: report.volExpansion >= 1.05 ? "weakening" : "stable",
      stressImpact: report.volatilityState === "expanding" ? "elevated" : report.volatilityState === "elevated" ? "moderate" : "low",
      confidence: conf,
      interpretation: report.volatilityState === "expanding"
        ? "Volatility expansion raises downside sensitivity across breakout and momentum rules. Tighten stop and position-sizing assumptions before reading backtest strength."
        : "Volatility is contained enough for continuation research, but keep stop assumptions explicit.",
    },
    {
      group: "Liquidity / Volume",
      condition: report.avgVolumeSurge !== null ? `Avg volume surge ${report.avgVolumeSurge.toFixed(2)}x baseline` : "Volume baseline unavailable",
      direction: report.liquidityState === "gap risk" ? "weakening" : "stable",
      stressImpact: report.liquidityState === "gap risk" ? "elevated" : "low",
      confidence: Math.round(conf - 4),
      interpretation: report.liquidityState === "gap risk"
        ? "Heavy down-volume participation increases overnight gap risk. Stress-test stops against gaps rather than assuming intraday fills."
        : "Participation looks orderly; watch for volume spikes into weakness as an early distribution tell.",
    },
    {
      group: "Defensive / Low Volatility",
      condition: riskOff ? "Relative strength improving" : "Neutral",
      direction: riskOff ? "improving" : "stable",
      stressImpact: "low",
      confidence: Math.round(conf - 2),
      interpretation: riskOff
        ? "Lower-volatility, trend-holding names tend to outperform on a relative basis as higher-beta leaders de-rate. Compare defensive vs high-beta drawdowns in your own backtests."
        : "Defensive leadership is not pronounced in the current tape; treat it as a hedge hypothesis to monitor.",
    },
    {
      group: "Quality Proxy",
      condition: `Stable trend + controlled volatility composite`,
      direction: report.regime === "risk-on" ? "improving" : "stable",
      stressImpact: report.regime === "risk-off" ? "moderate" : "low",
      confidence: Math.round(conf - 6),
      interpretation: "Quality is proxied by stable trend, controlled volatility, and healthy participation. In stress regimes it favors names that hold trend with smaller drawdowns rather than the highest trailing returns.",
    },
  ];
}

// ----------------------------------------------------------------------------
// AI-style selloff research memo (deterministic).
// ----------------------------------------------------------------------------

export function buildSelloffMemo(
  report: MarketStressReport,
  context: {
    radarCandidates: RadarCandidate[];
    diagnostics: Record<string, StrategyStressDiagnostics>;
    activeObservations: number;
  },
): SelloffMemo {
  const candidateCount = context.radarCandidates.filter((c) => c.status === "radar candidate").length;
  const diag = Object.values(context.diagnostics);
  const underStress = diag.filter((d) => d.status === "under stress").length;
  const resilient = diag.filter((d) => d.status === "stable").length;
  const reranked = diag.filter((d) => Math.abs(d.stressAdjustedScore - d.baseScore) >= 3).length;

  return {
    title: "AI Research Memo: Market Selloff Review",
    source: "deterministic",
    marketContext: `${report.headline} Composite stress score is ${report.stressScore}/100 (${report.regime}). ${report.interpretation}`,
    factorBehavior: `Breadth is ${report.breadthState} (${report.aboveTrend}/${report.symbolCount} above SMA200), momentum is ${report.momentumState} at ${(report.avgMomentum20d * 100).toFixed(1)}% avg 20-day, and volatility is ${report.volatilityState} (${(report.avgVolatility20d * 100).toFixed(0)}% annualized). ${report.regime === "risk-off" ? "Today's selloff increases the importance of drawdown control and benchmark-relative resilience." : "Factor signals are not flashing broad stress, but drawdown discipline still governs promotion."}`,
    strategyRisk: `${resilient} of ${diag.length} screened strategies read as resilient and ${underStress} as under stress. Strategies with positive historical returns but high downside sensitivity should be moved from "candidate" to "watch" until volatility normalizes.`,
    radarImpact: `Stress-adjusted scoring repriced ${reranked} of ${diag.length} strategies versus their base score, penalizing high drawdown and downside volatility while rewarding benchmark-relative resilience and smoother equity. ${candidateCount} strategies still clear the radar-candidate gate.`,
    paperObservation: context.activeObservations > 0
      ? `${context.activeObservations} simulated observation${context.activeObservations === 1 ? "" : "s"} remain live. Observation continues under stress so the desk can study how promoted rules behave through the drawdown — no orders are routed.`
      : "No strategy is currently live in paper observation, so there is no simulated book to stress-test this session.",
    nextExperiments: [
      "Re-run the radar shortlist with the stress-adjusted score as the primary sort key and compare promotions.",
      "Measure each candidate's worst 5-day return and benchmark-relative drawdown against the current regime.",
      "Stress-test stop placement against overnight gaps rather than intraday fills.",
      report.regime === "risk-off"
        ? "Compare defensive / low-volatility strategies against high-beta momentum rules to confirm the rotation."
        : "Track whether breadth broadens or volatility keeps expanding before changing candidate priorities.",
    ],
  };
}

// ----------------------------------------------------------------------------
// Paper observation under stress.
// ----------------------------------------------------------------------------

export function buildPaperStressObservation(
  report: MarketStressReport,
  observations: Array<{ simulatedReturn: number; status: string; result: BacktestResult; score: number }>,
): PaperStressObservation {
  const active = observations.filter((o) => o.status === "active" || o.status === "holding");
  const diags = observations.map((o) => buildStrategyStressDiagnostics(o.result, report, o.score));
  const resilientCount = diags.filter((d) => d.status === "stable").length;
  const underStressCount = diags.filter((d) => d.status === "under stress").length;

  // "Today" simulated move: average of each observation's latest daily equity move.
  const todayMoves = observations.map((o) => {
    const curve = o.result.equityCurve;
    const last = curve[curve.length - 1]?.equity;
    const prev = curve[curve.length - 2]?.equity;
    return prev && prev > 0 && last ? last / prev - 1 : 0;
  });
  const todaySimulatedReturn = todayMoves.length > 0
    ? todayMoves.reduce((sum, r) => sum + r, 0) / todayMoves.length : 0;
  const todaySimulatedPnl = observations.reduce((sum, o, i) => sum + todayMoves[i] * (o.result.equityCurve.at(-1)?.equity ?? 0), 0);

  const currentDrawdown = diags.length > 0 ? Math.min(...diags.map((d) => d.currentDrawdown)) : 0;
  const benchmarkRelative = diags.length > 0
    ? diags.reduce((sum, d) => sum + d.benchmarkRelativeDrawdown, 0) / diags.length : 0;

  const riskState: StressTone = underStressCount > 0 ? "stress" : report.regime === "risk-off" ? "caution" : "stable";
  const riskStateLabel = underStressCount > 0
    ? `${underStressCount} observation${underStressCount === 1 ? "" : "s"} under stress`
    : report.regime === "risk-off" ? "Holding under a risk-off tape" : "Within limits";

  const notes: string[] = [];
  if (observations.length === 0) {
    notes.push("No promoted strategy is live, so there is no simulated book to stress this session.");
  } else {
    notes.push(`${active.length} of ${observations.length} observation${observations.length === 1 ? "" : "s"} are actively holding through the current regime.`);
    notes.push(`${resilientCount} read as resilient and ${underStressCount} as under stress under stress-adjusted diagnostics.`);
    if (report.regime === "risk-off") notes.push("Observation continues so the desk can study drawdown behavior — no orders are routed.");
  }

  const timeline: PaperStressObservation["timeline"] = [
    { label: "Selloff detected", detail: `Stress score ${report.stressScore}/100 · ${report.regimeLabel}`, state: "done" },
    { label: "Radar candidates repriced", detail: "Stress-adjusted score applied to the shortlist", state: "done" },
    { label: "High-risk strategies flagged", detail: `${underStressCount} flagged under stress, ${resilientCount} resilient`, state: "done" },
    { label: "Paper observation continues", detail: `${active.length} live · simulation only, no orders routed`, state: "active" },
  ];

  return {
    riskState, riskStateLabel, activeCount: active.length,
    todaySimulatedPnl, todaySimulatedReturn, currentDrawdown, benchmarkRelative,
    resilientCount, underStressCount, notes, timeline,
  };
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
}
