import { describe, expect, it } from "vitest";
import type { BacktestResult } from "@/types/backtest";
import { buildRadar } from "./radar";

function result(overrides: Partial<BacktestResult["metrics"]>): BacktestResult {
  return {
    symbol: "TST",
    strategyId: `test-${overrides.sharpe ?? overrides.maxDrawdown ?? "base"}`,
    strategyName: "Test Strategy",
    description: "test",
    type: "momentum",
    signals: [],
    trades: [],
    equityCurve: [],
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
      adjusted: false,
    },
    metrics: {
      totalReturn: 0.2,
      annualizedReturn: 0.16,
      benchmarkReturn: 0.05,
      excessReturn: 0.15,
      maxDrawdown: -0.12,
      sharpe: 1.3,
      winRate: 0.6,
      profitFactor: 1.6,
      tradeCount: 12,
      averageHoldingDays: 10,
      volatility: 0.18,
      currentPosition: "flat",
      lastSignalDate: null,
      ...overrides,
    },
  };
}

describe("buildRadar", () => {
  it("promotes strategies that meet all admission rules", () => {
    expect(buildRadar([result({})])[0].status).toBe("radar candidate");
  });

  it("hard rejects negative sharpe or deep drawdown", () => {
    expect(buildRadar([result({ sharpe: -0.1 })])[0].status).toBe("rejected");
    expect(buildRadar([result({ maxDrawdown: -0.4 })])[0].status).toBe("rejected");
  });
});
