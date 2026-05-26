import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import type { BacktestResult } from "@/types/backtest";
import type { HistoricalPriceResult, MarketPrice } from "@/types/market";
import type { StrategyDefinition } from "@/types/strategy";
import { atr, ema, percentChange, realizedVolatility, rollingHigh, rsi, sma, volumeMovingAverage } from "./indicators";
import { runLongOnlyBacktest } from "./backtest";

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

export function chooseBenchmark(symbol: string, pricesBySymbol: Record<string, HistoricalPriceResult>): HistoricalPriceResult {
  const preferred = symbol === "SPY" ? pricesBySymbol.QQQ : pricesBySymbol.SPY;
  if (preferred) return preferred;
  const firstAvailable = Object.values(pricesBySymbol).find((result) => result.prices.length > 0);
  if (!firstAvailable) throw new Error("No benchmark data available");
  return firstAvailable;
}

export function selectMarketsForStrategies(pricesBySymbol: Record<string, HistoricalPriceResult>) {
  return STRATEGY_CATALOG.map((definition) => ({
    definition,
    market: pricesBySymbol[definition.defaultSymbol] ?? pricesBySymbol[DEFAULT_SYMBOLS[0]],
    benchmark: chooseBenchmark(definition.defaultSymbol, pricesBySymbol),
  }));
}
