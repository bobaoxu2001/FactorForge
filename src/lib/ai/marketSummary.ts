import type { FactorSnapshot } from "@/types/market";
import { pct } from "@/lib/utils/format";

export function generateMarketSummary(factors: FactorSnapshot[]) {
  const realCount = factors.filter((factor) => !factor.isFallback).length;
  const aboveTrend = factors.filter((factor) => factor.aboveSma200).length;
  const momentum20 = factors
    .map((factor) => factor.momentum20d)
    .filter((value): value is number => value !== null);
  const avgMomentum20 = momentum20.reduce((sum, value) => sum + value, 0) / Math.max(momentum20.length, 1);
  const volatility = factors
    .map((factor) => factor.volatility20d)
    .filter((value): value is number => value !== null);
  const avgVol = volatility.reduce((sum, value) => sum + value, 0) / Math.max(volatility.length, 1);
  const tone = aboveTrend >= factors.length * 0.7 ? "risk-on" : aboveTrend <= factors.length * 0.4 ? "defensive" : "mixed";

  return {
    tone,
    summary: `${aboveTrend}/${factors.length} symbols in the default watchlist are above SMA200. Average 20-day return is ${pct(avgMomentum20)} and average annualized 20-day volatility is about ${pct(avgVol)}.`,
    risk: avgVol > 0.4 ? "Volatility is elevated; breakout strategies need stricter stops and position sizing." : "Volatility is within an observable range, but concentration and drawdown still need monitoring.",
    dataNote: realCount === factors.length ? "Market summary is generated from real Yahoo daily OHLCV data." : `Market summary includes ${factors.length - realCount} fallback/demo symbols.`,
  };
}
