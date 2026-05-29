import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import type { BacktestResult } from "@/types/backtest";
import type { StrategyDefinition } from "@/types/strategy";
import type { FactorSnapshot, HistoricalPriceResult } from "@/types/market";
import { generateMarketSummary, type MarketSummary } from "@/lib/ai/marketSummary";
import { getWatchlistPrices } from "@/lib/data/marketData";
import { percentChange, realizedVolatility, rsi, sma, volumeMovingAverage } from "@/lib/quant/indicators";
import { buildPaperAccountSummary, buildPaperObservations } from "@/lib/quant/paperTrading";
import { buildRadar } from "@/lib/quant/radar";
import { chooseBenchmark, runStrategyOnMarketCached } from "@/lib/quant/strategies";
import { chooseWeights, runPortfolioBacktest, type PortfolioBacktest } from "@/lib/quant/portfolio";
import { buildFactorReturns, type FactorReturnsRow } from "@/lib/quant/factorAttribution";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("research");

export const RESEARCH_REVALIDATE_SECONDS = 60 * 60;

export interface ResearchDataset {
  pricesBySymbol: Record<string, HistoricalPriceResult>;
  factors: FactorSnapshot[];
  strategyResults: BacktestResult[];
  radarCandidates: ReturnType<typeof buildRadar>;
  paperObservations: ReturnType<typeof buildPaperObservations>;
  paperAccount: ReturnType<typeof buildPaperAccountSummary>;
  marketSummary: MarketSummary;
  portfolio: PortfolioBacktest | null;
  factorReturns: FactorReturnsRow[];
  factorBenchmarkSymbol: string;
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
  return buildResearchDatasetFromPrices(pricesBySymbol);
}

/**
 * Pure compute over a price map. Exposed so tests and offline scripts can
 * exercise the full research pipeline against a fixture without hitting Yahoo.
 */
export async function buildResearchDatasetFromPrices(
  pricesBySymbol: Record<string, HistoricalPriceResult>,
): Promise<ResearchDataset> {
  const strategyResults = STRATEGY_CATALOG.map((definition) =>
    runStrategyBestSymbol(definition, pricesBySymbol),
  );
  const factors = DEFAULT_SYMBOLS
    .map((symbol) => pricesBySymbol[symbol])
    .filter((result): result is HistoricalPriceResult => Boolean(result && result.prices.length > 0))
    .map((result) => buildFactorSnapshot(result));
  const radarCandidates = buildRadar(strategyResults);
  const paperObservations = buildPaperObservations(radarCandidates);
  const paperAccount = buildPaperAccountSummary(paperObservations);
  const marketSummary = await generateMarketSummary(factors);
  const portfolio = buildPortfolio(radarCandidates, pricesBySymbol);
  const factorReturns = buildFactorReturns(pricesBySymbol);
  const factorBenchmarkSymbol = chooseFactorBenchmarkSymbol(pricesBySymbol);
  const priceResults = Object.values(pricesBySymbol);
  return {
    pricesBySymbol,
    factors,
    strategyResults,
    radarCandidates,
    paperObservations,
    paperAccount,
    marketSummary,
    portfolio,
    factorReturns,
    factorBenchmarkSymbol,
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

/**
 * Run a single strategy definition against every symbol in the watchlist and
 * return the single best-scoring run.
 *
 * NOTE — this is a deliberate "best symbol per strategy" showcase, not a
 * realistic backtest of trading every symbol. Each catalog strategy is matched
 * to the symbol where it historically looked strongest (per {@link quickResearchScore}).
 * It surfaces what a strategy *can* do, and is explicitly not survivorship-bias
 * free. The radar/portfolio layers downstream apply their own gating.
 */
export function runStrategyBestSymbol(
  definition: StrategyDefinition,
  pricesBySymbol: Record<string, HistoricalPriceResult>,
): BacktestResult {
  const runs = DEFAULT_SYMBOLS
    .map((symbol) => {
      const market = pricesBySymbol[symbol];
      const benchmark = chooseBenchmark(symbol, pricesBySymbol, {
        strategyType: definition.type,
        selfSymbol: symbol,
      });
      if (!market || !benchmark || market.prices.length === 0 || benchmark.prices.length === 0) return null;
      return runStrategyOnMarketCached(definition, market, benchmark);
    })
    .filter((result): result is BacktestResult => result !== null);
  if (runs.length === 0) {
    throw new Error(`No usable market data for strategy ${definition.id}`);
  }
  return runs.sort((a, b) => quickResearchScore(b) - quickResearchScore(a))[0];
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

/**
 * Pick the benchmark used for factor-return regressions. Prefers SPY, then QQQ,
 * then falls back to the alphabetically-first available symbol so the choice is
 * deterministic across runs (plain `Object.keys()[0]` depends on insertion order).
 */
function chooseFactorBenchmarkSymbol(pricesBySymbol: Record<string, HistoricalPriceResult>): string {
  if (pricesBySymbol.SPY) return "SPY";
  if (pricesBySymbol.QQQ) return "QQQ";
  return Object.keys(pricesBySymbol).sort()[0] ?? "";
}

function buildPortfolio(
  radarCandidates: ReturnType<typeof buildRadar>,
  pricesBySymbol: Record<string, HistoricalPriceResult>,
): PortfolioBacktest | null {
  // Eligible legs: radar candidates + continue-observing with positive Sharpe.
  const eligible = radarCandidates
    .filter((candidate) =>
      candidate.status === "radar candidate" ||
      (candidate.status === "continue observing" && candidate.result.metrics.sharpe > 0.5),
    )
    .slice(0, 4);
  if (eligible.length < 2) return null;

  const benchmark = pricesBySymbol.SPY ?? pricesBySymbol.QQQ ?? Object.values(pricesBySymbol)[0];
  if (!benchmark || benchmark.prices.length === 0) return null;

  try {
    const weights = chooseWeights(
      eligible.map((candidate) => ({ result: candidate.result, score: candidate.score })),
    );
    return runPortfolioBacktest(weights, benchmark);
  } catch (error) {
    // Don't fail the whole research page if the portfolio optimizer rejects the
    // inputs (e.g. singular covariance) — degrade to "no portfolio" but record why.
    log.warn("portfolio backtest skipped", {
      reason: error instanceof Error ? error.message : String(error),
      legs: eligible.length,
    });
    return null;
  }
}

export async function getStrategyResult(id: string): Promise<BacktestResult | null> {
  const definition = STRATEGY_CATALOG.find((entry) => entry.id === id);
  if (!definition) return null;
  // Only fetch prices and run the one requested strategy instead of building the
  // entire research dataset (LLM summary, portfolio, factor attribution, …) just
  // to discard all but one result.
  const pricesBySymbol = await getWatchlistPrices("3y");
  try {
    return runStrategyBestSymbol(definition, pricesBySymbol);
  } catch {
    return null;
  }
}
