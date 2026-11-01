import { describe, expect, it } from "vitest";
import type { HistoricalPriceResult, MarketPrice } from "@/types/market";
import type { StrategyDefinition } from "@/types/strategy";
import { runLongOnlyBacktest } from "./backtest";

const strategy: StrategyDefinition = {
  id: "test-strategy",
  name: "Test Strategy",
  description: "Used for engine tests",
  type: "momentum",
  defaultSymbol: "TST",
};

function market(prices: MarketPrice[]): HistoricalPriceResult {
  return {
    symbol: "TST",
    range: "1y",
    prices,
    provider: "test",
    isFallback: false,
    status: "ok",
    message: "test data",
    updatedAt: "2024-01-01T00:00:00.000Z",
    quality: {
      adjusted: false,
      source: "fallback",
      fetchedAt: "2024-01-01T00:00:00.000Z",
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}

describe("runLongOnlyBacktest", () => {
  it("executes buy signals on the next bar open", () => {
    const prices = market([
      { date: "2024-01-01", open: 100, high: 110, low: 95, close: 110, volume: 1000 },
      { date: "2024-01-02", open: 120, high: 125, low: 115, close: 124, volume: 1000 },
      { date: "2024-01-03", open: 130, high: 132, low: 128, close: 131, volume: 1000 },
    ]);

    const result = runLongOnlyBacktest(
      strategy,
      prices,
      prices,
      [
        { buy: true, reason: "day one signal" },
        { buy: false, reason: "no signal" },
        { buy: false, reason: "no signal" },
      ],
      { initialCapital: 1_000, positionFraction: 1, slippageBps: 0, feePerTrade: 0 },
    );

    expect(result.signals[0]).toMatchObject({ date: "2024-01-02", type: "buy", price: 120 });
    expect(result.equityCurve[0].positionValue).toBe(0);
    expect(result.equityCurve[1].positionValue).toBe(8 * 124);
  });

  it("records fees and slippage in completed trades", () => {
    const prices = market([
      { date: "2024-01-01", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { date: "2024-01-02", open: 100, high: 103, low: 99, close: 102, volume: 1000 },
      { date: "2024-01-03", open: 110, high: 111, low: 100, close: 105, volume: 1000 },
    ]);

    const result = runLongOnlyBacktest(
      strategy,
      prices,
      prices,
      [
        { buy: true, reason: "entry" },
        { buy: false, sell: true, reason: "exit" },
        { buy: false, reason: "no signal" },
      ],
      { initialCapital: 1_000, positionFraction: 1, slippageBps: 10, feePerTrade: 1 },
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(100.1);
    expect(result.trades[0].exitPrice).toBe(109.89);
    expect(result.trades[0].fees).toBe(2);
    expect(result.trades[0].pnl).toBeGreaterThan(0);
  });

  it("fills a stop at the next open, paying an overnight gap through the stop", () => {
    const prices = market([
      { date: "2024-01-01", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { date: "2024-01-02", open: 100, high: 101, low: 94, close: 95, volume: 1000 },
      { date: "2024-01-03", open: 95, high: 96, low: 89, close: 90, volume: 1000 },
      { date: "2024-01-04", open: 80, high: 82, low: 78, close: 81, volume: 1000 },
    ]);
    const plans = [{ buy: true, reason: "entry" }, ...Array.from({ length: 3 }, () => ({ buy: false, reason: "no signal" }))];

    const result = runLongOnlyBacktest(strategy, prices, prices, plans, {
      initialCapital: 1_000,
      positionFraction: 1,
      slippageBps: 0,
      feePerTrade: 0,
      stopLossPct: 0.08,
    });

    // Close 90 on Jan 3 breaches the 92 stop; the decision can only be acted on at Jan 4's open (80).
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({ exitDate: "2024-01-04", exitPrice: 80, exitReason: "stop loss" });
    expect(result.signals.at(-1)?.reason).toContain("executed next open");
  });

  it("checks the entry bar's own close and leaves a final-bar breach open", () => {
    const entryBreach = market([
      { date: "2024-01-01", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { date: "2024-01-02", open: 100, high: 100, low: 88, close: 90, volume: 1000 },
      { date: "2024-01-03", open: 91, high: 92, low: 90, close: 91, volume: 1000 },
    ]);
    const plans = [{ buy: true, reason: "entry" }, { buy: false, reason: "no signal" }, { buy: false, reason: "no signal" }];
    const config = { initialCapital: 1_000, positionFraction: 1, slippageBps: 0, feePerTrade: 0, stopLossPct: 0.08 };

    const stopped = runLongOnlyBacktest(strategy, entryBreach, entryBreach, plans, config);
    expect(stopped.trades[0]).toMatchObject({ entryDate: "2024-01-02", exitDate: "2024-01-03", exitPrice: 91, exitReason: "stop loss" });

    const lastBarBreach = market(entryBreach.prices.slice(0, 2));
    const open = runLongOnlyBacktest(strategy, lastBarBreach, lastBarBreach, plans.slice(0, 2), config);
    expect(open.trades).toHaveLength(0);
    expect(open.equityCurve.at(-1)?.positionValue).toBe(10 * 90);
  });
});
