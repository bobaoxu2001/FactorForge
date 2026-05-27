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
