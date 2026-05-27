import { describe, expect, it } from "vitest";
import type { BacktestResult, EquityPoint } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import { chooseWeights, runPortfolioBacktest, __testing } from "./portfolio";

function dates(n: number): string[] {
  const out: string[] = [];
  const start = new Date("2023-01-02T00:00:00Z").getTime();
  for (let i = 0; i < n; i += 1) {
    out.push(new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

function makeResult(symbol: string, strategyId: string, growth: number, days: number, phase = 0): BacktestResult {
  const calendar = dates(days);
  const equityCurve: EquityPoint[] = calendar.map((date, idx) => {
    // Add a deterministic oscillation so daily returns aren't degenerate (constant returns → undefined correlation).
    const noise = Math.sin((idx + phase) * 0.31) * 0.012;
    const equity = 100_000 * (1 + growth) ** (idx / 252) * (1 + noise);
    return {
      date,
      equity,
      cash: equity / 2,
      positionValue: equity / 2,
      drawdown: 0,
      benchmarkEquity: 100_000,
    };
  });
  return {
    symbol,
    strategyId,
    strategyName: `Strategy ${strategyId}`,
    description: "test",
    type: "breakout",
    signals: [],
    trades: [],
    equityCurve,
    riskFlags: [],
    recommendation: "test",
    assumptions: {
      initialCapital: 100_000,
      positionFraction: 0.2,
      stopLossPct: 0.08,
      trailingStopPct: 0.12,
      maxHoldingDays: 45,
      execution: "next_open",
      slippageBps: 5,
      feePerTrade: 1,
    },
    dataStatus: {
      provider: "test",
      isFallback: false,
      message: "test",
      updatedAt: "2024-01-01T00:00:00.000Z",
      adjusted: true,
    },
    metrics: {
      totalReturn: growth,
      annualizedReturn: growth,
      benchmarkReturn: 0.08,
      excessReturn: growth - 0.08,
      maxDrawdown: -0.1,
      sharpe: 1,
      winRate: 0.5,
      profitFactor: 1.5,
      tradeCount: 10,
      averageHoldingDays: 12,
      volatility: 0.18,
      currentPosition: "flat",
      lastSignalDate: calendar[calendar.length - 1],
    },
  };
}

function makeBenchmark(days: number, growth: number): HistoricalPriceResult {
  const calendar = dates(days);
  return {
    symbol: "SPY",
    range: "3y",
    prices: calendar.map((date, idx) => {
      const close = 400 * (1 + growth) ** (idx / 252);
      return { date, open: close, high: close, low: close, close, volume: 1_000_000 };
    }),
    provider: "test",
    isFallback: false,
    status: "ok",
    message: "test",
    updatedAt: "2024-01-01T00:00:00.000Z",
    quality: {
      adjusted: true,
      source: "yahoo",
      fetchedAt: "2024-01-01T00:00:00.000Z",
      rows: days,
      firstDate: calendar[0],
      lastDate: calendar[calendar.length - 1],
    },
  };
}

describe("portfolio engine", () => {
  it("computes pearson correlation of 1 for identical return series", () => {
    expect(__testing.pearson([0.01, 0.02, -0.01, 0.03], [0.01, 0.02, -0.01, 0.03])).toBeCloseTo(1, 6);
  });

  it("intersects calendars across legs and returns sorted dates", () => {
    const out = __testing.intersectDates([
      ["2024-01-02", "2024-01-03", "2024-01-04"],
      ["2024-01-03", "2024-01-04", "2024-01-05"],
    ]);
    expect(out).toEqual(["2024-01-03", "2024-01-04"]);
  });

  it("blends two leg backtests buy-and-hold and reports metrics + correlation", () => {
    const days = 300;
    const legA = makeResult("AAPL", "vcp-tight-breakout", 0.2, days, 0);
    const legB = makeResult("MSFT", "keltner-atr-breakout", 0.1, days, 0);
    const legs = chooseWeights([
      { result: legA, score: 80 },
      { result: legB, score: 60 },
    ]);
    const bench = makeBenchmark(days, 0.08);

    const portfolio = runPortfolioBacktest(legs, bench);

    expect(portfolio.legs).toHaveLength(2);
    expect(portfolio.legs[0].weight + portfolio.legs[1].weight).toBeCloseTo(1, 6);
    expect(portfolio.metrics.totalReturn).toBeGreaterThan(0);
    expect(portfolio.metrics.tradingDays).toBe(days);
    // In-phase oscillations on top of similar drifts → highly positively correlated.
    expect(portfolio.averagePairwiseCorrelation).toBeGreaterThan(0.9);
    expect(portfolio.correlation).toHaveLength(4);
  });

  it("reports low correlation when one leg is phase-shifted half a cycle", () => {
    const days = 300;
    const legA = makeResult("AAPL", "vcp-tight-breakout", 0.15, days, 0);
    const legB = makeResult("MSFT", "keltner-atr-breakout", 0.15, days, Math.PI / 0.31); // ~half-cycle shift
    const legs = chooseWeights([
      { result: legA, score: 70 },
      { result: legB, score: 70 },
    ]);
    const portfolio = runPortfolioBacktest(legs, makeBenchmark(days, 0.08));
    expect(portfolio.averagePairwiseCorrelation).toBeLessThan(0.5);
  });

  it("falls back to equal-weight when all scores are non-positive", () => {
    const days = 60;
    const legA = makeResult("AAPL", "vcp-tight-breakout", 0.05, days);
    const legB = makeResult("MSFT", "keltner-atr-breakout", 0.04, days);
    const legs = chooseWeights([
      { result: legA, score: 0 },
      { result: legB, score: -5 },
    ]);
    expect(legs[0].weight).toBeCloseTo(0.5);
    expect(legs[1].weight).toBeCloseTo(0.5);
  });
});
