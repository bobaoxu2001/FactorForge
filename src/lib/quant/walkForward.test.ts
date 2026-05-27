import { describe, expect, it } from "vitest";
import type { BacktestResult, EquityPoint, Trade } from "@/types/backtest";
import { evaluateWalkForward } from "./walkForward";

function dates(n: number): string[] {
  const out: string[] = [];
  const start = new Date("2023-01-02T00:00:00Z").getTime();
  for (let i = 0; i < n; i += 1) {
    out.push(new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

function buildResult(
  options: {
    equityFn: (i: number) => number;
    benchEquityFn?: (i: number) => number;
    trades?: Trade[];
    days?: number;
  },
): BacktestResult {
  const days = options.days ?? 400;
  const calendar = dates(days);
  const equityCurve: EquityPoint[] = calendar.map((date, idx) => ({
    date,
    equity: options.equityFn(idx),
    cash: options.equityFn(idx) / 2,
    positionValue: options.equityFn(idx) / 2,
    drawdown: 0,
    benchmarkEquity: options.benchEquityFn ? options.benchEquityFn(idx) : 100_000,
  }));
  return {
    symbol: "AAPL",
    strategyId: "test",
    strategyName: "Test",
    description: "test",
    type: "breakout",
    signals: [],
    trades: options.trades ?? [],
    equityCurve,
    metrics: {} as BacktestResult["metrics"],
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
      updatedAt: "",
      adjusted: true,
    },
  };
}

describe("walk-forward evaluation", () => {
  it("returns null for too-short curves", () => {
    const result = buildResult({ equityFn: (i) => 100_000 + i, days: 30 });
    expect(evaluateWalkForward(result)).toBeNull();
  });

  it("splits at the default 0.7 ratio and reports symmetric metrics for a steady curve", () => {
    const result = buildResult({
      equityFn: (i) => 100_000 * (1 + 0.0003 * i + Math.sin(i * 0.21) * 0.01),
      trades: Array.from({ length: 10 }, (_, k) => ({
        entryDate: dates(400)[k * 30],
        exitDate: dates(400)[k * 30 + 10],
        entryPrice: 100,
        exitPrice: 102,
        shares: 100,
        fees: 2,
        slippage: 1,
        pnl: 150,
        returnPct: 0.02,
        holdingDays: 10,
        exitReason: "trailing stop",
      })),
    });
    const split = evaluateWalkForward(result);
    expect(split).not.toBeNull();
    if (!split) return;
    expect(split.inSample.bars + split.outOfSample.bars).toBeGreaterThanOrEqual(400);
    expect(split.inSample.bars).toBeGreaterThan(split.outOfSample.bars);
    expect(["robust", "mild degradation"]).toContain(split.verdict);
  });

  it("flags severe degradation when OOS performance collapses", () => {
    // First 280 bars: steady uptrend, last 120 bars: drawdown
    const days = 400;
    const result = buildResult({
      equityFn: (i) => {
        if (i < 280) return 100_000 * (1 + 0.0008 * i);
        const peak = 100_000 * (1 + 0.0008 * 280);
        return peak * (1 - 0.002 * (i - 280));
      },
      trades: Array.from({ length: 12 }, (_, k) => ({
        entryDate: dates(days)[k * 30],
        exitDate: dates(days)[k * 30 + 8],
        entryPrice: 100,
        exitPrice: k < 9 ? 104 : 96,
        shares: 100,
        fees: 2,
        slippage: 1,
        pnl: k < 9 ? 400 : -400,
        returnPct: k < 9 ? 0.04 : -0.04,
        holdingDays: 8,
        exitReason: "stop loss",
      })),
      days,
    });
    const split = evaluateWalkForward(result);
    expect(split).not.toBeNull();
    if (!split) return;
    expect(split.outOfSample.annualizedReturn).toBeLessThan(split.inSample.annualizedReturn);
    expect(split.verdict === "severe degradation" || split.verdict === "mild degradation").toBe(true);
  });

  it("honors an explicit split date", () => {
    const days = 400;
    const calendar = dates(days);
    const target = calendar[200];
    const result = buildResult({ equityFn: (i) => 100_000 + i * 10, days });
    const split = evaluateWalkForward(result, { splitDate: target });
    expect(split?.splitDate).toBe(target);
    expect(split?.inSample.endDate).toBe(target);
    expect(split?.outOfSample.startDate).toBe(target);
  });
});
