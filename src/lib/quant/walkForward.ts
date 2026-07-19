import type { BacktestResult, EquityPoint, Trade } from "@/types/backtest";
import { dailyReturns, maxDrawdownFromSeries } from "./indicators";

const TRADING_DAYS = 252;

export interface WindowMetrics {
  startDate: string;
  endDate: string;
  bars: number;
  totalReturn: number;
  annualizedReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  sharpe: number;
  volatility: number;
  maxDrawdown: number;
  tradeCount: number;
  winRate: number;
}

export interface WalkForwardSplit {
  inSample: WindowMetrics;
  outOfSample: WindowMetrics;
  /** Difference OOS − IS for each metric. Negative = degradation. */
  degradation: {
    sharpe: number;
    annualizedReturn: number;
    maxDrawdown: number;
    winRate: number;
  };
  /** Verdict heuristic on whether the strategy generalized to unseen data. */
  verdict: "robust" | "mild degradation" | "severe degradation" | "insufficient sample";
  splitDate: string;
  splitRatio: number;
}

export interface WalkForwardConfig {
  /** Fraction of bars used as in-sample. Default 0.7. Used when splitDate is not provided. */
  splitRatio?: number;
  /** Explicit boundary date (YYYY-MM-DD). Takes precedence over splitRatio. */
  splitDate?: string;
}

export function evaluateWalkForward(
  result: BacktestResult,
  config: WalkForwardConfig = {},
): WalkForwardSplit | null {
  const { equityCurve, trades } = result;
  if (equityCurve.length < 60) return null;

  const splitRatio = config.splitRatio ?? 0.7;
  const splitIdx = pickSplitIndex(equityCurve, config.splitDate, splitRatio);
  if (splitIdx < 20 || splitIdx >= equityCurve.length - 20) return null;

  const inWindow = equityCurve.slice(0, splitIdx + 1);
  const outWindow = equityCurve.slice(splitIdx);
  const splitDate = equityCurve[splitIdx].date;
  const inTrades = trades.filter((trade) => trade.entryDate <= splitDate);
  const outTrades = trades.filter((trade) => trade.entryDate > splitDate);

  const inSample = summarizeWindow(inWindow, inTrades);
  const outOfSample = summarizeWindow(outWindow, outTrades);

  const degradation = {
    sharpe: outOfSample.sharpe - inSample.sharpe,
    annualizedReturn: outOfSample.annualizedReturn - inSample.annualizedReturn,
    maxDrawdown: outOfSample.maxDrawdown - inSample.maxDrawdown,
    winRate: outOfSample.winRate - inSample.winRate,
  };

  return {
    inSample,
    outOfSample,
    degradation,
    verdict: classify(inSample, outOfSample, degradation),
    splitDate,
    splitRatio: splitRatio,
  };
}

export interface RollingWindowResult {
  /** 1-based window number, chronological. */
  index: number;
  inSample: WindowMetrics;
  outOfSample: WindowMetrics;
  degradation: WalkForwardSplit["degradation"];
  verdict: WalkForwardSplit["verdict"];
}

export interface RollingWalkForwardReport {
  windows: RollingWindowResult[];
  /** Share of usable windows whose OOS total return is positive. */
  oosPositiveShare: number;
  /** Share of usable windows whose OOS return beats the benchmark. */
  oosBeatBenchmarkShare: number;
  avgOosSharpe: number;
  /** Population std-dev of OOS Sharpe across windows — lower = steadier. */
  oosSharpeStd: number;
  worstOosDrawdown: number;
  /**
   * Overall read across windows. "consistent" needs a majority of healthy
   * windows and no severe blow-up; "fragile" means the edge disappears out of
   * sample more often than not.
   */
  verdict: "consistent" | "mixed" | "fragile" | "insufficient sample";
  /** Fraction of the curve reserved as burn-in before the first OOS window. */
  burnInRatio: number;
}

export interface RollingWalkForwardConfig {
  /** Number of sequential OOS windows. Default 4. */
  windows?: number;
  /** Fraction of the curve used as burn-in before the first OOS window. Default 0.4. */
  burnInRatio?: number;
}

/**
 * Anchored rolling walk-forward: after a burn-in stretch, the remaining curve
 * is cut into N sequential out-of-sample windows, and each window's in-sample
 * is EVERYTHING before it (anchored, expanding). Like the single split, this
 * re-derives metrics from the one existing equity curve — no refitting, no
 * parameter search — so it is an honesty check on consistency, not an
 * optimization procedure.
 */
export function evaluateRollingWalkForward(
  result: BacktestResult,
  config: RollingWalkForwardConfig = {},
): RollingWalkForwardReport | null {
  const { equityCurve, trades } = result;
  const windowCount = Math.max(2, Math.floor(config.windows ?? 4));
  const burnInRatio = Math.min(Math.max(config.burnInRatio ?? 0.4, 0.2), 0.6);

  // Every OOS window needs enough bars for its metrics to mean anything.
  const burnIn = Math.floor(equityCurve.length * burnInRatio);
  const oosSpan = equityCurve.length - burnIn;
  const oosBars = Math.floor(oosSpan / windowCount);
  if (equityCurve.length < 120 || burnIn < 40 || oosBars < 30) return null;

  const windows: RollingWindowResult[] = [];
  for (let i = 0; i < windowCount; i += 1) {
    const oosStart = burnIn + i * oosBars;
    const oosEnd = i === windowCount - 1 ? equityCurve.length - 1 : oosStart + oosBars;
    const splitDate = equityCurve[oosStart].date;
    const endDate = equityCurve[oosEnd].date;

    const inWindow = equityCurve.slice(0, oosStart + 1);
    const outWindow = equityCurve.slice(oosStart, oosEnd + 1);
    const inTrades = trades.filter((trade) => trade.entryDate <= splitDate);
    const outTrades = trades.filter((trade) => trade.entryDate > splitDate && trade.entryDate <= endDate);

    const inSample = summarizeWindow(inWindow, inTrades);
    const outOfSample = summarizeWindow(outWindow, outTrades);
    const degradation = {
      sharpe: outOfSample.sharpe - inSample.sharpe,
      annualizedReturn: outOfSample.annualizedReturn - inSample.annualizedReturn,
      maxDrawdown: outOfSample.maxDrawdown - inSample.maxDrawdown,
      winRate: outOfSample.winRate - inSample.winRate,
    };

    windows.push({
      index: i + 1,
      inSample,
      outOfSample,
      degradation,
      verdict: classify(inSample, outOfSample, degradation),
    });
  }

  const usable = windows.filter((window) => window.verdict !== "insufficient sample");
  if (usable.length < 2) {
    return {
      windows,
      oosPositiveShare: 0,
      oosBeatBenchmarkShare: 0,
      avgOosSharpe: 0,
      oosSharpeStd: 0,
      worstOosDrawdown: 0,
      verdict: "insufficient sample",
      burnInRatio,
    };
  }

  const oosSharpes = usable.map((window) => window.outOfSample.sharpe);
  const avgOosSharpe = oosSharpes.reduce((sum, value) => sum + value, 0) / usable.length;
  const sharpeVariance =
    oosSharpes.reduce((sum, value) => sum + (value - avgOosSharpe) ** 2, 0) / usable.length;
  const oosPositiveShare = usable.filter((window) => window.outOfSample.totalReturn > 0).length / usable.length;
  const oosBeatBenchmarkShare = usable.filter((window) => window.outOfSample.excessReturn > 0).length / usable.length;
  const worstOosDrawdown = Math.min(...usable.map((window) => window.outOfSample.maxDrawdown));
  const severeCount = usable.filter((window) => window.verdict === "severe degradation").length;
  const healthyCount = usable.filter(
    (window) => window.verdict === "robust" || window.verdict === "mild degradation",
  ).length;

  const verdict: RollingWalkForwardReport["verdict"] =
    severeCount * 2 >= usable.length || avgOosSharpe < 0
      ? "fragile"
      : severeCount === 0 && healthyCount / usable.length >= 0.75 && oosPositiveShare >= 0.6
        ? "consistent"
        : "mixed";

  return {
    windows,
    oosPositiveShare,
    oosBeatBenchmarkShare,
    avgOosSharpe,
    oosSharpeStd: Math.sqrt(sharpeVariance),
    worstOosDrawdown,
    verdict,
    burnInRatio,
  };
}

function pickSplitIndex(
  curve: EquityPoint[],
  splitDate: string | undefined,
  splitRatio: number,
): number {
  if (splitDate) {
    const idx = curve.findIndex((point) => point.date >= splitDate);
    if (idx > 0) return idx;
  }
  return Math.floor(curve.length * Math.min(Math.max(splitRatio, 0.2), 0.8));
}

function summarizeWindow(curve: EquityPoint[], trades: Trade[]): WindowMetrics {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) {
    return {
      startDate: "",
      endDate: "",
      bars: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      benchmarkReturn: 0,
      excessReturn: 0,
      sharpe: 0,
      volatility: 0,
      maxDrawdown: 0,
      tradeCount: 0,
      winRate: 0,
    };
  }

  const equity = curve.map((p) => p.equity);
  const bench = curve.map((p) => p.benchmarkEquity);
  const totalReturn = equity[equity.length - 1] / equity[0] - 1;
  const benchmarkReturn = bench[bench.length - 1] / bench[0] - 1;
  const years = Math.max(curve.length / TRADING_DAYS, 1 / TRADING_DAYS);
  const annualizedReturn = (1 + totalReturn) ** (1 / years) - 1;
  const returns = dailyReturns(equity);
  const meanDaily = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + (value - meanDaily) ** 2, 0) / Math.max(returns.length, 1);
  const dailyVol = Math.sqrt(variance);
  const sharpe = dailyVol === 0 ? 0 : (meanDaily / dailyVol) * Math.sqrt(TRADING_DAYS);
  const volatility = dailyVol * Math.sqrt(TRADING_DAYS);
  const maxDrawdown = maxDrawdownFromSeries(equity);
  const wins = trades.filter((trade) => trade.pnl > 0).length;
  const winRate = trades.length === 0 ? 0 : wins / trades.length;

  return {
    startDate: first.date,
    endDate: last.date,
    bars: curve.length,
    totalReturn,
    annualizedReturn,
    benchmarkReturn,
    excessReturn: totalReturn - benchmarkReturn,
    sharpe,
    volatility,
    maxDrawdown,
    tradeCount: trades.length,
    winRate,
  };
}

function classify(
  inSample: WindowMetrics,
  outOfSample: WindowMetrics,
  degradation: WalkForwardSplit["degradation"],
): WalkForwardSplit["verdict"] {
  if (inSample.tradeCount < 3 || outOfSample.bars < 30) return "insufficient sample";
  // Severe: Sharpe collapsed by more than 1.0 OR OOS Sharpe turned negative while IS was healthy.
  if (degradation.sharpe < -1 || (inSample.sharpe > 0.5 && outOfSample.sharpe < 0)) {
    return "severe degradation";
  }
  // Robust: OOS Sharpe within 0.3 of IS AND OOS annualized return retains at least 60% of IS.
  if (
    Math.abs(degradation.sharpe) <= 0.3 &&
    (inSample.annualizedReturn <= 0 || outOfSample.annualizedReturn >= inSample.annualizedReturn * 0.6)
  ) {
    return "robust";
  }
  return "mild degradation";
}
