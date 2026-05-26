import type { EquityPoint, StrategySignal } from "@/types/backtest";
import type { MarketPrice } from "@/types/market";

export function sma(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = values.slice(index + 1 - period, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / period;
  });
}

export function ema(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previous: number | null = null;
  values.forEach((value, index) => {
    if (index + 1 < period) return;
    if (previous === null) {
      previous = values.slice(index + 1 - period, index + 1).reduce((sum, item) => sum + item, 0) / period;
    } else {
      previous = value * multiplier + previous * (1 - multiplier);
    }
    result[index] = previous;
  });
  return result;
}

export function rsi(values: number[], period = 14): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  for (let index = period; index < values.length; index += 1) {
    let gain = 0;
    let loss = 0;
    for (let offset = index - period + 1; offset <= index; offset += 1) {
      const change = values[offset] - values[offset - 1];
      if (change >= 0) gain += change;
      else loss += Math.abs(change);
    }
    if (loss === 0) result[index] = 100;
    else {
      const rs = gain / period / (loss / period);
      result[index] = 100 - 100 / (1 + rs);
    }
  }
  return result;
}

export function atr(prices: MarketPrice[], period = 14): Array<number | null> {
  const trueRanges = prices.map((price, index) => {
    if (index === 0) return price.high - price.low;
    const previousClose = prices[index - 1].close;
    return Math.max(
      price.high - price.low,
      Math.abs(price.high - previousClose),
      Math.abs(price.low - previousClose),
    );
  });
  return sma(trueRanges, period);
}

export function rollingHigh(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    return Math.max(...values.slice(index + 1 - period, index + 1));
  });
}

export function rollingLow(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    return Math.min(...values.slice(index + 1 - period, index + 1));
  });
}

export function volumeMovingAverage(prices: MarketPrice[], period = 20): Array<number | null> {
  return sma(prices.map((price) => price.volume), period);
}

export function percentChange(values: number[], period = 1): Array<number | null> {
  return values.map((value, index) => {
    if (index < period || values[index - period] === 0) return null;
    return value / values[index - period] - 1;
  });
}

export function dailyReturns(values: number[]): number[] {
  return values.slice(1).map((value, index) => value / values[index] - 1);
}

export function realizedVolatility(values: number[], period: number): Array<number | null> {
  const changes = percentChange(values);
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = changes.slice(index + 1 - period, index + 1).filter((value): value is number => value !== null);
    if (window.length < period - 1) return null;
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance) * Math.sqrt(252);
  });
}

export function maxDrawdownFromSeries(values: number[]): number {
  let peak = values[0] ?? 0;
  let maxDrawdown = 0;
  values.forEach((value) => {
    peak = Math.max(peak, value);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
  });
  return maxDrawdown;
}

export function addDrawdown(curve: Omit<EquityPoint, "drawdown">[]): EquityPoint[] {
  let peak = curve[0]?.equity ?? 0;
  return curve.map((point) => {
    peak = Math.max(peak, point.equity);
    return { ...point, drawdown: peak > 0 ? point.equity / peak - 1 : 0 };
  });
}

export function latestSignal(signals: StrategySignal[]): StrategySignal | null {
  return signals.length > 0 ? signals[signals.length - 1] : null;
}
