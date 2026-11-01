import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { percentChange, realizedVolatility, rsi, sma } from "@/lib/quant/indicators";
import { runStrategyOnMarket } from "@/lib/quant/strategies";
import type { HistoricalPriceResult } from "@/types/market";
import { expectedMaxSharpe } from "./attribution";
import type { PriceFixture } from "./snapshot";

/**
 * Quant lens for a coverage company: the existing FactorForge factor snapshot
 * and rule-based strategies, run on the research snapshot's prices. Results
 * are BACKTESTS (in-sample, no live trading) and are shown with a multiple-
 * testing haircut, because picking the best of N strategies inflates Sharpe.
 */

/** Convert the research price fixture to the quant engine's input (dividend-adjusted OHLC). */
export function toHistoricalPriceResult(fixture: PriceFixture, years = 3): HistoricalPriceResult {
  const cutoff = fixture.rows.length ? `${Number(fixture.rows.at(-1)![0].slice(0, 4)) - years}${fixture.rows.at(-1)![0].slice(4)}` : "";
  const prices = fixture.rows
    .filter((r) => r[0] >= cutoff)
    .map(([date, open, high, low, close, adjclose, volume]) => {
      const ratio = close > 0 ? adjclose / close : 1;
      return { date, open: open * ratio, high: high * ratio, low: low * ratio, close: adjclose, volume };
    });
  return {
    symbol: fixture.symbol,
    range: "3y",
    prices,
    provider: `${fixture.provider} (research snapshot)`,
    isFallback: false,
    status: "ok",
    message: `Research snapshot retrieved ${fixture.retrievedAt.slice(0, 10)}; dividend- and split-adjusted.`,
    updatedAt: fixture.retrievedAt,
    quality: { adjusted: true, source: "yahoo", fetchedAt: fixture.retrievedAt, rows: prices.length, firstDate: prices[0]?.date ?? null, lastDate: prices.at(-1)?.date ?? null },
  };
}

export interface StrategyRunSummary {
  id: string;
  name: string;
  type: string;
  totalReturn: number;
  benchmarkReturn: number;
  sharpe: number;
  maxDrawdown: number;
  tradeCount: number;
  winRate: number;
  currentPosition: string;
}

export interface QuantLens {
  factors: { momentum20d: number | null; momentum60d: number | null; volatility20d: number | null; rsi14: number | null; aboveSma200: boolean; asOf: string };
  runs: StrategyRunSummary[];
  best: StrategyRunSummary | null;
  years: number;
  nullExpectedMaxSharpe: number;
  bestSharpeAfterHaircut: number | null;
  notes: string[];
}

export function buildQuantLens(stock: PriceFixture, benchmark: PriceFixture): QuantLens {
  const market = toHistoricalPriceResult(stock);
  const bench = toHistoricalPriceResult(benchmark);
  const closes = market.prices.map((p) => p.close);
  const last = closes.length - 1;
  const sma200 = sma(closes, 200)[last];
  const runs = STRATEGY_CATALOG.filter((d) => d.type !== "rotation").map((definition) => {
    const r = runStrategyOnMarket(definition, market, bench);
    return {
      id: definition.id,
      name: definition.name,
      type: definition.type,
      totalReturn: r.metrics.totalReturn,
      benchmarkReturn: r.metrics.benchmarkReturn,
      sharpe: r.metrics.sharpe,
      maxDrawdown: r.metrics.maxDrawdown,
      tradeCount: r.metrics.tradeCount,
      winRate: r.metrics.winRate,
      currentPosition: r.metrics.currentPosition,
    };
  });
  const best = runs.length ? runs.reduce((a, b) => (b.sharpe > a.sharpe ? b : a)) : null;
  const years = market.prices.length / 252;
  const nullMax = expectedMaxSharpe(runs.length, years);
  return {
    factors: {
      momentum20d: percentChange(closes, 20)[last],
      momentum60d: percentChange(closes, 60)[last],
      volatility20d: realizedVolatility(closes, 20)[last],
      rsi14: rsi(closes, 14)[last],
      aboveSma200: sma200 !== null && closes[last] > sma200,
      asOf: market.prices[last]?.date ?? "",
    },
    runs,
    best,
    years,
    nullExpectedMaxSharpe: nullMax,
    bestSharpeAfterHaircut: best ? best.sharpe - nullMax : null,
    notes: [
      "Backtested on the research snapshot (in-sample). These are not live or simulated-forward results.",
      `Best of ${runs.length} strategies tested on this name. Under the null of no skill, the best Sharpe among ${runs.length} independent tries over ${years.toFixed(1)} years would be about ${nullMax.toFixed(2)} by luck alone (strategies are correlated, so this is approximate).`,
      "The rotation strategy is excluded: it ranks across a universe and is not defined for a single name.",
    ],
  };
}
