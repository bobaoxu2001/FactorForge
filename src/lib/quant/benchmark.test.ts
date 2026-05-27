import { describe, expect, it } from "vitest";
import type { HistoricalPriceResult } from "@/types/market";
import { chooseBenchmark } from "./strategies";

function priceResult(symbol: string, base = 100, days = 100): HistoricalPriceResult {
  const prices = Array.from({ length: days }, (_, i) => {
    const close = base * (1 + i * 0.001);
    return {
      date: new Date(2023, 0, 2 + i).toISOString().slice(0, 10),
      open: close,
      high: close,
      low: close,
      close,
      volume: 1_000_000,
    };
  });
  return {
    symbol,
    range: "3y",
    prices,
    provider: "test",
    isFallback: false,
    status: "ok",
    message: "test",
    updatedAt: "",
    quality: {
      adjusted: true,
      source: "yahoo",
      fetchedAt: "",
      rows: days,
      firstDate: prices[0].date,
      lastDate: prices[days - 1].date,
    },
  };
}

const universe: Record<string, HistoricalPriceResult> = {
  SPY: priceResult("SPY"),
  QQQ: priceResult("QQQ", 200),
  AAPL: priceResult("AAPL", 150),
  MSFT: priceResult("MSFT", 300),
  NVDA: priceResult("NVDA", 400),
  JPM: priceResult("JPM", 120),
};

describe("chooseBenchmark — type-aware benchmark selection", () => {
  it("picks QQQ for momentum strategies", () => {
    const bench = chooseBenchmark("AAPL", universe, { strategyType: "momentum", selfSymbol: "AAPL" });
    expect(bench.symbol).toBe("QQQ");
  });

  it("picks QQQ for breakout strategies", () => {
    const bench = chooseBenchmark("NVDA", universe, { strategyType: "breakout", selfSymbol: "NVDA" });
    expect(bench.symbol).toBe("QQQ");
  });

  it("picks SPY for mean reversion strategies", () => {
    const bench = chooseBenchmark("AAPL", universe, { strategyType: "mean reversion", selfSymbol: "AAPL" });
    expect(bench.symbol).toBe("SPY");
  });

  it("synthesizes an equal-weight basket for rotation strategies", () => {
    const bench = chooseBenchmark("SPY", universe, { strategyType: "rotation", selfSymbol: "SPY" });
    expect(bench.symbol).toBe("EW-BASKET");
    expect(bench.prices.length).toBeGreaterThan(50);
    expect(bench.prices[0].close).toBeCloseTo(100, 6); // basket normalized to 100 at t=0
    expect(bench.provider).toContain("equal-weight");
  });

  it("excludes the strategy's own symbol from a fallback selection", () => {
    const onlySelf: Record<string, HistoricalPriceResult> = {
      AAPL: priceResult("AAPL"),
      MSFT: priceResult("MSFT"),
    };
    const bench = chooseBenchmark("AAPL", onlySelf, { strategyType: "momentum", selfSymbol: "AAPL" });
    expect(bench.symbol).not.toBe("AAPL");
  });

  it("legacy two-arg form still resolves to SPY for non-SPY input", () => {
    const bench = chooseBenchmark("AAPL", universe);
    expect(bench.symbol).toBe("SPY");
  });
});
