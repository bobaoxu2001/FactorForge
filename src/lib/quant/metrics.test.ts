import { describe, expect, it } from "vitest";
import type { EquityPoint, Trade } from "@/types/backtest";
import { calculateMetrics } from "./metrics";

const curve: EquityPoint[] = [
  { date: "2024-01-01", equity: 100_000, cash: 100_000, positionValue: 0, drawdown: 0, benchmarkEquity: 100_000 },
  { date: "2024-01-02", equity: 101_000, cash: 101_000, positionValue: 0, drawdown: 0, benchmarkEquity: 100_500 },
  { date: "2024-01-03", equity: 102_340, cash: 102_340, positionValue: 0, drawdown: 0, benchmarkEquity: 100_800 },
];

function trade(pnl: number): Trade {
  return {
    entryDate: "2024-01-01",
    exitDate: "2024-01-03",
    entryPrice: 100,
    exitPrice: 100 + pnl / 100,
    shares: 100,
    fees: 2,
    slippage: 0,
    pnl,
    returnPct: pnl / 10_000,
    holdingDays: 2,
    exitReason: "test",
  };
}

describe("calculateMetrics — profit factor", () => {
  it("is undefined (null), not a dollar amount, when there are no losing trades", () => {
    const metrics = calculateMetrics(curve, [trade(2_340)], "2024-01-03");
    expect(metrics.profitFactor).toBeNull();
  });

  it("is gross profit ÷ gross loss when both exist", () => {
    const metrics = calculateMetrics(curve, [trade(300), trade(-100)], "2024-01-03");
    expect(metrics.profitFactor).toBeCloseTo(3, 10);
  });

  it("is 0 when there are no trades or only scratch trades", () => {
    expect(calculateMetrics(curve, [], null).profitFactor).toBe(0);
    expect(calculateMetrics(curve, [trade(0)], null).profitFactor).toBe(0);
  });
});
