import { describe, expect, it } from "vitest";
import prices from "@/__fixtures__/research/freight/prices.json";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { runStrategyOnMarket } from "@/lib/quant/strategies";
import { buildQuantLens, toHistoricalPriceResult } from "./quantLens";
import type { PriceFixture } from "./snapshot";

describe("company quant lens benchmark comparison", () => {
  it("reports the aligned engine excess return, rather than relabelling the benchmark's return", () => {
    const stock = prices.prices.KNX as unknown as PriceFixture;
    const benchmark = prices.prices.SPY as unknown as PriceFixture;
    const lens = buildQuantLens(stock, benchmark);
    expect(lens.runs.length).toBeGreaterThan(0);
    for (const run of lens.runs) {
      const definition = STRATEGY_CATALOG.find((item) => item.id === run.id)!;
      const result = runStrategyOnMarket(definition, toHistoricalPriceResult(stock), toHistoricalPriceResult(benchmark));
      const first = result.equityCurve[0];
      const last = result.equityCurve.at(-1)!;
      const expectedExcess = last.equity / first.equity - last.benchmarkEquity / first.benchmarkEquity;
      expect(run.excessReturn).toBeCloseTo(expectedExcess, 10);
      expect(run.excessReturn).not.toBeCloseTo(run.benchmarkReturn, 3);
    }
    expect(lens.period.start).toBe(toHistoricalPriceResult(stock).prices[0].date);
    expect(lens.period.end).toBe(stock.rows.at(-1)![0]);
  });
});
