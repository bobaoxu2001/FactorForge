import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import type { BacktestResult } from "@/types/backtest";
import type { FactorSnapshot, HistoricalPriceResult } from "@/types/market";
import { generateMarketSummary, type MarketSummary } from "@/lib/ai/marketSummary";
import { getWatchlistPrices } from "@/lib/data/marketData";
import { percentChange, realizedVolatility, rsi, sma, volumeMovingAverage } from "@/lib/quant/indicators";
import { buildPaperAccountSummary, buildPaperObservations } from "@/lib/quant/paperTrading";
import { buildRadar } from "@/lib/quant/radar";
import { chooseBenchmark, runStrategyOnMarket } from "@/lib/quant/strategies";

export const RESEARCH_REVALIDATE_SECONDS = 60 * 60;

export interface ResearchDataset {
  pricesBySymbol: Record<string, HistoricalPriceResult>;
  factors: FactorSnapshot[];
  strategyResults: BacktestResult[];
  radarCandidates: ReturnType<typeof buildRadar>;
  paperObservations: ReturnType<typeof buildPaperObservations>;
  paperAccount: ReturnType<typeof buildPaperAccountSummary>;
  marketSummary: MarketSummary;
  metadata: {
    generatedAt: string;
    revalidateSeconds: number;
    realDataCount: number;
    fallbackCount: number;
    adjustedCount: number;
    symbolCount: number;
  };
}

export async function getResearchDataset(): Promise<ResearchDataset> {
  const pricesBySymbol = await getWatchlistPrices("3y");
  const strategyResults = STRATEGY_CATALOG.map((definition) => {
    const runs = DEFAULT_SYMBOLS
      .map((symbol) => {
        const market = pricesBySymbol[symbol];
        const benchmark = chooseBenchmark(symbol, pricesBySymbol);
        if (!market || !benchmark || market.prices.length === 0 || benchmark.prices.length === 0) return null;
        return runStrategyOnMarket(definition, market, benchmark);
      })
      .filter((result): result is BacktestResult => result !== null);
    if (runs.length === 0) {
      throw new Error(`No usable market data for strategy ${definition.id}`);
    }
    return runs.sort((a, b) => quickResearchScore(b) - quickResearchScore(a))[0];
  });
  const factors = DEFAULT_SYMBOLS
    .map((symbol) => pricesBySymbol[symbol])
    .filter((result): result is HistoricalPriceResult => Boolean(result && result.prices.length > 0))
    .map((result) => buildFactorSnapshot(result));
  const radarCandidates = buildRadar(strategyResults);
  const paperObservations = buildPaperObservations(radarCandidates);
  const paperAccount = buildPaperAccountSummary(paperObservations);
  const marketSummary = await generateMarketSummary(factors);
  const priceResults = Object.values(pricesBySymbol);
  return {
    pricesBySymbol,
    factors,
    strategyResults,
    radarCandidates,
    paperObservations,
    paperAccount,
    marketSummary,
    metadata: {
      generatedAt: new Date().toISOString(),
      revalidateSeconds: RESEARCH_REVALIDATE_SECONDS,
      realDataCount: priceResults.filter((result) => !result.isFallback).length,
      fallbackCount: priceResults.filter((result) => result.isFallback).length,
      adjustedCount: priceResults.filter((result) => result.quality.adjusted).length,
      symbolCount: priceResults.length,
    },
  };
}

function quickResearchScore(result: BacktestResult): number {
  return (
    result.metrics.annualizedReturn * 120 +
    result.metrics.sharpe * 18 +
    result.metrics.maxDrawdown * 35 +
    Math.min(result.metrics.tradeCount, 20) * 0.8
  );
}

function buildFactorSnapshot(result: HistoricalPriceResult): FactorSnapshot {
  const closes = result.prices.map((price) => price.close);
  const last = result.prices[result.prices.length - 1];
  const vol20 = realizedVolatility(closes, 20);
  const rsi14 = rsi(closes, 14);
  const sma200 = sma(closes, 200);
  const volume20 = volumeMovingAverage(result.prices, 20);
  const lastIndex = result.prices.length - 1;
  const lastVolumeAverage = volume20[lastIndex];

  return {
    symbol: result.symbol,
    date: last?.date ?? "",
    momentum20d: percentChange(closes, 20)[lastIndex],
    momentum60d: percentChange(closes, 60)[lastIndex],
    volatility20d: vol20[lastIndex],
    volumeSurge: last && lastVolumeAverage ? last.volume / lastVolumeAverage : null,
    aboveSma200: sma200[lastIndex] !== null && last ? last.close > (sma200[lastIndex] ?? Infinity) : false,
    rsi14: rsi14[lastIndex],
    provider: result.provider,
    isFallback: result.isFallback,
    adjusted: result.quality.adjusted,
  };
}

export async function getStrategyResult(id: string): Promise<BacktestResult | null> {
  const dataset = await getResearchDataset();
  return dataset.strategyResults.find((result) => result.strategyId === id) ?? null;
}
