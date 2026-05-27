import type { BacktestResult, EquityPoint } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import { dailyReturns, maxDrawdownFromSeries } from "./indicators";

const TRADING_DAYS = 252;

export interface PortfolioLeg {
  result: BacktestResult;
  weight: number;
}

export interface PortfolioCurvePoint {
  date: string;
  equity: number;
  benchmarkEquity: number;
  drawdown: number;
}

export interface PortfolioMetrics {
  totalReturn: number;
  annualizedReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  tradingDays: number;
}

export interface PortfolioLegContribution {
  symbol: string;
  strategyId: string;
  strategyName: string;
  weight: number;
  legAnnualizedReturn: number;
  legSharpe: number;
  legMaxDrawdown: number;
  contributionReturn: number; // weighted total return contribution
}

export interface CorrelationCell {
  rowSymbol: string;
  rowStrategy: string;
  colSymbol: string;
  colStrategy: string;
  correlation: number;
}

export interface PortfolioBacktest {
  legs: PortfolioLegContribution[];
  curve: PortfolioCurvePoint[];
  metrics: PortfolioMetrics;
  correlation: CorrelationCell[];
  averagePairwiseCorrelation: number;
  benchmarkSymbol: string;
  benchmarkProvider: string;
  rebalance: "buy-and-hold within legs";
  weightScheme: "score-weighted" | "equal-weight";
}

export interface WeightedCandidate {
  result: BacktestResult;
  score: number;
}

export function chooseWeights(
  candidates: WeightedCandidate[],
  scheme: PortfolioBacktest["weightScheme"] = "score-weighted",
): PortfolioLeg[] {
  if (candidates.length === 0) return [];
  if (scheme === "equal-weight" || candidates.every((item) => item.score <= 0)) {
    const w = 1 / candidates.length;
    return candidates.map((item) => ({ result: item.result, weight: w }));
  }
  const positive = candidates.map((item) => ({
    result: item.result,
    weight: Math.max(item.score, 0),
  }));
  const total = positive.reduce((sum, item) => sum + item.weight, 0);
  if (total === 0) {
    const w = 1 / positive.length;
    return positive.map((item) => ({ result: item.result, weight: w }));
  }
  return positive.map((item) => ({ result: item.result, weight: item.weight / total }));
}

/**
 * Combine independent leg backtests into a single buy-and-hold portfolio.
 * Each leg keeps its own internal entries/exits; we blend the per-leg equity
 * curves on the calendar shared across all legs.
 */
export function runPortfolioBacktest(
  legs: PortfolioLeg[],
  benchmark: HistoricalPriceResult,
  weightScheme: PortfolioBacktest["weightScheme"] = "score-weighted",
): PortfolioBacktest {
  if (legs.length === 0) {
    throw new Error("Portfolio requires at least one leg");
  }

  const calendar = intersectDates(legs.map((leg) => leg.result.equityCurve.map((point) => point.date)));
  if (calendar.length < 30) {
    throw new Error(`Portfolio calendar too short (${calendar.length} bars after intersection)`);
  }

  const legSeries = legs.map((leg) => ({
    leg,
    equity: alignSeries(leg.result.equityCurve, calendar, (point) => point.equity),
  }));
  const benchmarkSeries = alignSeries(benchmark.prices, calendar, (price) => price.close);
  if (benchmarkSeries[0] === 0) benchmarkSeries[0] = 1;

  // Normalize leg equities to a $1 starting unit so weights compose linearly.
  const normalizedLegs = legSeries.map(({ leg, equity }) => {
    const start = equity[0] || 1;
    return { leg, normalized: equity.map((value) => value / start) };
  });

  // Compose portfolio equity in $1 units, then scale to initial capital.
  const initialCapital = legs[0]?.result.assumptions.initialCapital ?? 100_000;
  const portfolioEquity = calendar.map((_, idx) => {
    return normalizedLegs.reduce((sum, { leg, normalized }) => sum + leg.weight * normalized[idx], 0) * initialCapital;
  });

  const benchStart = benchmarkSeries[0] || 1;
  const benchmarkEquity = benchmarkSeries.map((value) => (value / benchStart) * initialCapital);

  const drawdowns = drawdownSeries(portfolioEquity);
  const curve: PortfolioCurvePoint[] = calendar.map((date, idx) => ({
    date,
    equity: portfolioEquity[idx],
    benchmarkEquity: benchmarkEquity[idx],
    drawdown: drawdowns[idx],
  }));

  const portReturns = dailyReturns(portfolioEquity);
  const meanDaily = portReturns.reduce((sum, value) => sum + value, 0) / Math.max(portReturns.length, 1);
  const variance = portReturns.reduce((sum, value) => sum + (value - meanDaily) ** 2, 0) / Math.max(portReturns.length, 1);
  const dailyVol = Math.sqrt(variance);
  const totalReturn = portfolioEquity[portfolioEquity.length - 1] / portfolioEquity[0] - 1;
  const years = Math.max(calendar.length / TRADING_DAYS, 1 / TRADING_DAYS);
  const annualizedReturn = (1 + totalReturn) ** (1 / years) - 1;
  const benchmarkReturn = benchmarkEquity[benchmarkEquity.length - 1] / benchmarkEquity[0] - 1;
  const volatility = dailyVol * Math.sqrt(TRADING_DAYS);
  const sharpe = dailyVol === 0 ? 0 : (meanDaily / dailyVol) * Math.sqrt(TRADING_DAYS);
  const maxDrawdown = maxDrawdownFromSeries(portfolioEquity);

  // Per-leg contributions
  const legContributions: PortfolioLegContribution[] = normalizedLegs.map(({ leg, normalized }) => {
    const legTotalReturn = normalized[normalized.length - 1] - 1;
    const legReturns = dailyReturns(normalized);
    const legMean = legReturns.reduce((sum, value) => sum + value, 0) / Math.max(legReturns.length, 1);
    const legVar = legReturns.reduce((sum, value) => sum + (value - legMean) ** 2, 0) / Math.max(legReturns.length, 1);
    const legDailyVol = Math.sqrt(legVar);
    const legYears = Math.max(calendar.length / TRADING_DAYS, 1 / TRADING_DAYS);
    return {
      symbol: leg.result.symbol,
      strategyId: leg.result.strategyId,
      strategyName: leg.result.strategyName,
      weight: leg.weight,
      legAnnualizedReturn: (1 + legTotalReturn) ** (1 / legYears) - 1,
      legSharpe: legDailyVol === 0 ? 0 : (legMean / legDailyVol) * Math.sqrt(TRADING_DAYS),
      legMaxDrawdown: maxDrawdownFromSeries(normalized),
      contributionReturn: leg.weight * legTotalReturn,
    };
  });

  // Pairwise correlation of daily returns across legs
  const legReturnSeries = normalizedLegs.map(({ leg, normalized }) => ({
    leg,
    returns: dailyReturns(normalized),
  }));
  const correlation: CorrelationCell[] = [];
  for (let i = 0; i < legReturnSeries.length; i += 1) {
    for (let j = 0; j < legReturnSeries.length; j += 1) {
      const a = legReturnSeries[i];
      const b = legReturnSeries[j];
      const value = i === j ? 1 : pearson(a.returns, b.returns);
      correlation.push({
        rowSymbol: a.leg.result.symbol,
        rowStrategy: a.leg.result.strategyName,
        colSymbol: b.leg.result.symbol,
        colStrategy: b.leg.result.strategyName,
        correlation: Number.isFinite(value) ? value : 0,
      });
    }
  }

  const offDiagonal = correlation.filter((cell) => cell.rowSymbol !== cell.colSymbol || cell.rowStrategy !== cell.colStrategy);
  const averagePairwiseCorrelation = offDiagonal.length === 0
    ? 0
    : offDiagonal.reduce((sum, cell) => sum + cell.correlation, 0) / offDiagonal.length;

  return {
    legs: legContributions,
    curve,
    metrics: {
      totalReturn,
      annualizedReturn,
      benchmarkReturn,
      excessReturn: totalReturn - benchmarkReturn,
      volatility,
      sharpe,
      maxDrawdown,
      tradingDays: calendar.length,
    },
    correlation,
    averagePairwiseCorrelation,
    benchmarkSymbol: benchmark.symbol,
    benchmarkProvider: benchmark.provider,
    rebalance: "buy-and-hold within legs",
    weightScheme,
  };
}

function intersectDates(seriesList: string[][]): string[] {
  if (seriesList.length === 0) return [];
  const sorted = [...seriesList].sort((a, b) => a.length - b.length);
  const shortest = sorted[0];
  const others = sorted.slice(1).map((list) => new Set(list));
  return shortest.filter((date) => others.every((set) => set.has(date)));
}

function alignSeries<T>(
  source: T[],
  calendar: string[],
  read: (item: T) => number,
): number[] {
  const dateField = (item: T): string => (item as unknown as { date: string }).date;
  const map = new Map<string, number>();
  source.forEach((item) => map.set(dateField(item), read(item)));
  const result: number[] = [];
  let lastValue: number | null = null;
  calendar.forEach((date) => {
    const value = map.get(date);
    if (typeof value === "number" && Number.isFinite(value)) {
      lastValue = value;
      result.push(value);
    } else if (lastValue !== null) {
      result.push(lastValue);
    } else {
      result.push(0);
    }
  });
  return result;
}

function drawdownSeries(equity: number[]): number[] {
  let peak = -Infinity;
  return equity.map((value) => {
    peak = Math.max(peak, value);
    return peak === 0 ? 0 : value / peak - 1;
  });
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const x = a.slice(0, n);
  const y = b.slice(0, n);
  const meanX = x.reduce((sum, value) => sum + value, 0) / n;
  const meanY = y.reduce((sum, value) => sum + value, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;
  return num / denom;
}

export const __testing = { intersectDates, alignSeries, pearson, drawdownSeries };
