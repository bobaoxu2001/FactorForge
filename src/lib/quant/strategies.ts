import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import type { BacktestResult } from "@/types/backtest";
import type { HistoricalPriceResult, MarketPrice } from "@/types/market";
import type { StrategyDefinition } from "@/types/strategy";
import { atr, ema, percentChange, realizedVolatility, rollingHigh, rsi, sma, volumeMovingAverage } from "./indicators";
import { runLongOnlyBacktest } from "./backtest";
import {
  buildBacktestCacheKey,
  readBacktestFromCache,
  writeBacktestToCache,
} from "@/lib/persistence/backtestCache";

interface SignalPlan {
  buy: boolean;
  sell?: boolean;
  reason: string;
}

export function buildSignalPlans(definition: StrategyDefinition, prices: MarketPrice[]): SignalPlan[] {
  const closes = prices.map((price) => price.close);
  const highs = prices.map((price) => price.high);
  const sma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const atr14 = atr(prices, 14);
  const rsi14 = rsi(closes, 14);
  const high60 = rollingHigh(highs, 60);
  const volume20 = volumeMovingAverage(prices, 20);
  const vol20 = realizedVolatility(closes, 20);
  const vol60 = realizedVolatility(closes, 60);

  return prices.map((price, index) => {
    if (index < 200 && definition.id !== "lowvol-rotation-proxy") return { buy: false, reason: "warmup" };
    const close = price.close;
    const previousClose = prices[index - 1]?.close;
    const previousRsi = rsi14[index - 1];
    const sell = sma200[index] !== null && close < (sma200[index] ?? 0);

    if (definition.id === "vcp-tight-breakout") {
      const nearHigh = high60[index] !== null && close >= (high60[index] ?? 0) * 0.97;
      const contraction = vol20[index] !== null && vol60[index] !== null && (vol20[index] ?? 0) < (vol60[index] ?? 0) * 0.85;
      const volumeHealthy = volume20[index] !== null && price.volume > (volume20[index] ?? 0) * 0.75;
      const breakout = previousClose !== undefined && high60[index - 1] !== null && close > (high60[index - 1] ?? Infinity);
      return {
        buy: Boolean(nearHigh && contraction && volumeHealthy && breakout),
        sell,
        reason: "near 60d high + volatility contraction + healthy volume breakout",
      };
    }

    if (definition.id === "keltner-atr-breakout") {
      const upper = ema20[index] !== null && atr14[index] !== null ? (ema20[index] ?? 0) + 1.5 * (atr14[index] ?? 0) : null;
      const trend = sma200[index] !== null && close > (sma200[index] ?? Infinity);
      const volumeConfirm = volume20[index] !== null && price.volume > (volume20[index] ?? 0);
      return {
        buy: Boolean(upper !== null && close > upper && volumeConfirm && trend),
        sell,
        reason: "close above EMA20 + 1.5 ATR with volume and SMA200 trend filter",
      };
    }

    if (definition.id === "sma200-rsi-pullback") {
      const trend = sma200[index] !== null && close > (sma200[index] ?? Infinity);
      const rebound = previousRsi !== null && rsi14[index] !== null && previousRsi < 38 && (rsi14[index] ?? 0) > previousRsi && (rsi14[index] ?? 0) < 55;
      return {
        buy: Boolean(trend && rebound),
        sell: Boolean(sma200[index] !== null && close < (sma200[index] ?? 0)) || Boolean(rsi14[index] !== null && (rsi14[index] ?? 0) > 68),
        reason: "SMA200 uptrend with RSI pullback rebound",
      };
    }

    if (definition.id === "ema-trend-pullback") {
      const trend = ema50[index] !== null && sma200[index] !== null && close > (ema50[index] ?? Infinity) && close > (sma200[index] ?? Infinity);
      const touched = prices[index - 1] && ema20[index - 1] !== null && prices[index - 1].low <= (ema20[index - 1] ?? 0) * 1.01;
      const reclaimed = ema20[index] !== null && close > (ema20[index] ?? Infinity);
      return {
        buy: Boolean(trend && touched && reclaimed),
        sell,
        reason: "trend above EMA50/SMA200 after EMA20 pullback reclaim",
      };
    }

    const momentum60 = percentChange(closes, 60)[index];
    const lowVol = vol60[index] !== null && (vol60[index] ?? 1) < 0.32;
    return {
      buy: Boolean(momentum60 !== null && momentum60 > 0 && lowVol && index % 21 === 0),
      sell: Boolean(momentum60 !== null && momentum60 < -0.03),
      reason: "low-volatility proxy rotation; dividend component not connected yet",
    };
  });
}

export function runStrategyOnMarket(
  definition: StrategyDefinition,
  market: HistoricalPriceResult,
  benchmark: HistoricalPriceResult,
): BacktestResult {
  return runLongOnlyBacktest(definition, market, benchmark, buildSignalPlans(definition, market.prices));
}

export function runStrategyOnMarketCached(
  definition: StrategyDefinition,
  market: HistoricalPriceResult,
  benchmark: HistoricalPriceResult,
): BacktestResult {
  const { cacheKey, fingerprint } = buildBacktestCacheKey({
    strategyId: definition.id,
    market,
    benchmark,
  });
  const cached = readBacktestFromCache(cacheKey);
  if (cached) return cached;
  const result = runStrategyOnMarket(definition, market, benchmark);
  writeBacktestToCache(cacheKey, fingerprint, result);
  return result;
}

/**
 * Type-aware benchmark selection.
 *
 *  - momentum / breakout       → QQQ (growth-heavy, the right yardstick for
 *                                     mega-cap tech-tilted trend strategies)
 *  - mean reversion            → SPY (broad-market, the natural comparison
 *                                     for pullback strategies in large caps)
 *  - rotation                  → synthesized equal-weight basket from the
 *                                     non-ETF universe (the strategy IS
 *                                     market beta-ish, so SPY/QQQ would
 *                                     understate diversification value)
 *
 * Falls back to SPY → QQQ → first usable symbol if the preferred symbol
 * isn't loaded.
 */
export function chooseBenchmark(
  symbolOrType: string,
  pricesBySymbol: Record<string, HistoricalPriceResult>,
  options: { strategyType?: StrategyDefinition["type"]; selfSymbol?: string } = {},
): HistoricalPriceResult {
  const { strategyType, selfSymbol } = options;
  const tryGet = (sym: string) => (sym !== selfSymbol ? pricesBySymbol[sym] : null);

  if (strategyType === "rotation") {
    const basket = buildEqualWeightBasket(pricesBySymbol, selfSymbol);
    if (basket) return basket;
  }

  if (strategyType === "momentum" || strategyType === "breakout") {
    const qqq = tryGet("QQQ");
    if (qqq && qqq.prices.length > 0) return qqq;
  }

  // mean reversion default + safe fallback path
  // First arg may legacy-be a symbol — keep that compatible.
  if (!strategyType) {
    const preferred = symbolOrType === "SPY" ? tryGet("QQQ") : tryGet("SPY");
    if (preferred && preferred.prices.length > 0) return preferred;
  }

  const spy = tryGet("SPY");
  if (spy && spy.prices.length > 0) return spy;
  const qqq = tryGet("QQQ");
  if (qqq && qqq.prices.length > 0) return qqq;

  const firstAvailable = Object.values(pricesBySymbol).find(
    (result) => result.prices.length > 0 && result.symbol !== selfSymbol,
  );
  if (!firstAvailable) throw new Error("No benchmark data available");
  return firstAvailable;
}

/**
 * Build a synthetic equal-weight benchmark from the watchlist's non-ETF
 * components. Returned object satisfies HistoricalPriceResult so downstream
 * code is unchanged.
 */
function buildEqualWeightBasket(
  pricesBySymbol: Record<string, HistoricalPriceResult>,
  excludeSymbol: string | undefined,
): HistoricalPriceResult | null {
  const ETFS = new Set(["SPY", "QQQ", "IWM", "DIA", "VTI"]);
  const constituents = Object.values(pricesBySymbol).filter(
    (result) =>
      !ETFS.has(result.symbol) &&
      result.symbol !== excludeSymbol &&
      result.prices.length > 0,
  );
  if (constituents.length < 3) return null;

  // Calendar intersection
  const calendars = constituents.map((c) => c.prices.map((p) => p.date));
  const calendar = calendars[0].filter((date) =>
    calendars.slice(1).every((other) => other.includes(date)),
  );
  if (calendar.length < 60) return null;

  const closesBySymbol: Record<string, Map<string, number>> = {};
  constituents.forEach((c) => {
    const map = new Map<string, number>();
    c.prices.forEach((p) => map.set(p.date, p.close));
    closesBySymbol[c.symbol] = map;
  });

  // Track first close per symbol so we equal-weight in return space.
  const firstByDate: Record<string, number | null> = {};
  constituents.forEach((c) => {
    firstByDate[c.symbol] = closesBySymbol[c.symbol].get(calendar[0]) ?? null;
  });

  const prices = calendar.map((date) => {
    const ratios = constituents
      .map((c) => {
        const close = closesBySymbol[c.symbol].get(date);
        const first = firstByDate[c.symbol];
        if (close === undefined || first === null || first === 0) return null;
        return close / first;
      })
      .filter((value): value is number => value !== null);
    const indexValue = 100 * (ratios.reduce((sum, value) => sum + value, 0) / Math.max(ratios.length, 1));
    return {
      date,
      open: indexValue,
      high: indexValue,
      low: indexValue,
      close: indexValue,
      volume: 0,
    };
  });

  const generatedAt = new Date().toISOString();
  return {
    symbol: "EW-BASKET",
    range: constituents[0].range,
    prices,
    provider: "synthetic equal-weight basket",
    isFallback: false,
    status: "ok",
    message: `Equal-weight basket of ${constituents.length} non-ETF symbols`,
    updatedAt: generatedAt,
    quality: {
      adjusted: constituents.every((c) => c.quality.adjusted),
      source: "yahoo",
      fetchedAt: generatedAt,
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}

export function selectMarketsForStrategies(pricesBySymbol: Record<string, HistoricalPriceResult>) {
  return STRATEGY_CATALOG.map((definition) => ({
    definition,
    market: pricesBySymbol[definition.defaultSymbol] ?? pricesBySymbol[DEFAULT_SYMBOLS[0]],
    benchmark: chooseBenchmark(definition.defaultSymbol, pricesBySymbol, {
      strategyType: definition.type,
      selfSymbol: definition.defaultSymbol,
    }),
  }));
}
