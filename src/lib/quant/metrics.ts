import type { BacktestMetrics, EquityPoint, Trade } from "@/types/backtest";
import { dailyReturns, maxDrawdownFromSeries } from "./indicators";

const annualization = 252;

export function calculateMetrics(
  equityCurve: EquityPoint[],
  trades: Trade[],
  lastSignalDate: string | null,
): BacktestMetrics {
  const first = equityCurve[0];
  const last = equityCurve[equityCurve.length - 1];
  if (!first || !last) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      benchmarkReturn: 0,
      excessReturn: 0,
      maxDrawdown: 0,
      sharpe: 0,
      winRate: 0,
      profitFactor: 0,
      tradeCount: 0,
      averageHoldingDays: 0,
      volatility: 0,
      currentPosition: "flat",
      lastSignalDate,
    };
  }

  const totalReturn = last.equity / first.equity - 1;
  const benchmarkReturn = last.benchmarkEquity / first.benchmarkEquity - 1;
  const years = Math.max(equityCurve.length / annualization, 1 / annualization);
  const annualizedReturn = (1 + totalReturn) ** (1 / years) - 1;
  const returns = dailyReturns(equityCurve.map((point) => point.equity));
  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(returns.length, 1);
  const dailyVol = Math.sqrt(variance);
  const volatility = dailyVol * Math.sqrt(annualization);
  const sharpe = dailyVol === 0 ? 0 : (mean / dailyVol) * Math.sqrt(annualization);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));

  return {
    totalReturn,
    annualizedReturn,
    benchmarkReturn,
    excessReturn: totalReturn - benchmarkReturn,
    maxDrawdown: maxDrawdownFromSeries(equityCurve.map((point) => point.equity)),
    sharpe,
    winRate: trades.length === 0 ? 0 : wins.length / trades.length,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? grossProfit : 0) : grossProfit / grossLoss,
    tradeCount: trades.length,
    averageHoldingDays: trades.length === 0 ? 0 : trades.reduce((sum, trade) => sum + trade.holdingDays, 0) / trades.length,
    volatility,
    currentPosition: last.positionValue > 0 ? "long" : "flat",
    lastSignalDate,
  };
}
