import { describe, expect, it } from "vitest";
import { addDrawdown, percentChange, sma } from "./indicators";

describe("indicators", () => {
  it("calculates simple moving averages after the warmup period", () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  it("calculates percent changes with null warmup values", () => {
    const changes = percentChange([100, 110, 121], 1);
    expect(changes[0]).toBeNull();
    expect(changes[1]).toBeCloseTo(0.1);
    expect(changes[2]).toBeCloseTo(0.1);
  });

  it("adds drawdown from the running equity peak", () => {
    const curve = addDrawdown([
      { date: "2024-01-01", equity: 100, cash: 100, positionValue: 0, benchmarkEquity: 100 },
      { date: "2024-01-02", equity: 120, cash: 120, positionValue: 0, benchmarkEquity: 100 },
      { date: "2024-01-03", equity: 90, cash: 90, positionValue: 0, benchmarkEquity: 100 },
    ]);

    expect(curve.map((point) => point.drawdown)).toEqual([0, 0, -0.25]);
  });
});
