import { describe, expect, it } from "vitest";
import { computeMultiples, discountedCashFlow, distribution, percentileOf, rawPrice, sensitivityGrid, sharesOnDate, valueScenario, weightScenarios } from "./valuation";

const split = [{ date: "2024-03-28", numerator: 2, denominator: 1 }];

describe("split handling", () => {
  it("reconstructs the traded price before a split", () => {
    expect(rawPrice(100, "2024-01-02", split)).toBe(200);
    expect(rawPrice(100, "2024-06-01", split)).toBe(100);
  });
  it("restates an old share count to the post-split basis", () => {
    expect(sharesOnDate(1_000, "2023-12-31", "2024-06-01", split)).toBe(2_000);
    expect(sharesOnDate(1_000, "2023-12-31", "2024-01-15", split)).toBe(1_000);
  });
});

describe("computeMultiples", () => {
  it("never shows a negative-earnings P/E as cheap", () => {
    const m = computeMultiples({ marketCap: 1000, debt: 200, cash: 50, ttmRevenue: 2000, ttmEbitda: 100, ttmNetIncome: -10, ttmFcf: 30, equity: 500 });
    expect(m.pe).toBeNull();
    expect(m.enterpriseValue).toBe(1150);
    expect(m.evToEbitda).toBeCloseTo(11.5, 12);
    expect(m.fcfYield).toBeCloseTo(0.03, 12);
  });
  it("leaves EV multiples undefined without debt and cash", () => {
    const m = computeMultiples({ marketCap: 1000, debt: null, cash: null, ttmRevenue: 2000, ttmEbitda: 100, ttmNetIncome: 50, ttmFcf: null, equity: null });
    expect(m.evToEbitda).toBeNull();
    expect(m.pe).toBe(20);
  });
});

describe("distribution & percentile", () => {
  it("computes quantiles and ignores nulls", () => {
    const d = distribution([1, 2, 3, 4, 5, null]);
    expect(d?.median).toBe(3);
    expect(d?.p25).toBe(2);
    expect(percentileOf([1, 2, 3, 4], 3)).toBe(0.75);
  });
});

describe("scenario valuation", () => {
  const base = { ttmRevenue: 1000, daToRevenue: 0.1, netDebt: 200, shares: 100, price: 10 };
  it("bridges NTM EBITDA × multiple to equity per share", () => {
    const v = valueScenario({ ...base, revenueGrowth: 0.1, operatingMargin: 0.05, evToEbitda: 8 });
    expect(v.revenue).toBeCloseTo(1100, 9);
    expect(v.ebitda).toBeCloseTo(165, 9);
    expect(v.perShare).toBeCloseTo((165 * 8 - 200) / 100, 9);
    expect(v.impliedReturn).toBeCloseTo(v.perShare! / 10 - 1, 12);
  });
  it("returns null per-share value when equity is wiped out", () => {
    expect(valueScenario({ ...base, revenueGrowth: 0, operatingMargin: -0.1, evToEbitda: 5 }).perShare).toBeNull();
  });
  it("sensitivity rises with margin and multiple", () => {
    const grid = sensitivityGrid({ ...base, revenueGrowth: 0 }, [0.05, 0.1], [6, 8]);
    expect(grid[1][1]! > grid[0][1]!).toBe(true);
    expect(grid[0][1]! > grid[0][0]!).toBe(true);
  });
  it("computes expected return only for a complete, valid distribution", () => {
    expect(weightScenarios([{ impliedReturn: 0.2, probability: 0.5 }, { impliedReturn: -0.1, probability: null }]).expectedReturn).toBeNull();
    const w = weightScenarios([{ impliedReturn: 0.2, probability: 0.25 }, { impliedReturn: 0.05, probability: 0.5 }, { impliedReturn: -0.2, probability: 0.25 }]);
    expect(w.complete).toBe(true);
    expect(w.expectedReturn).toBeCloseTo(0.025, 12);
  });
});

describe("discountedCashFlow", () => {
  it("matches a hand-computed one-year case", () => {
    const r = discountedCashFlow({ baseRevenue: 100, initialGrowth: 0, terminalGrowth: 0, years: 1, ebitMargin: 0.2, taxRate: 0.25, reinvestmentRate: 0.05, wacc: 0.1, netDebt: 0, shares: 10 });
    // FCFF = 100*0.2*0.75 − 5 = 10; PV = 10/1.1; TV = 10/0.1 = 100; PV(TV) = 100/1.1
    expect(r.enterpriseValue).toBeCloseTo(110 / 1.1, 9);
    expect(r.perShare).toBeCloseTo(10, 9);
    expect(r.warnings.join(" ")).toMatch(/Terminal value is more than 75%/);
  });
  it("flags WACC ≤ terminal growth", () => {
    const r = discountedCashFlow({ baseRevenue: 100, initialGrowth: 0.05, terminalGrowth: 0.08, years: 5, ebitMargin: 0.1, taxRate: 0.21, reinvestmentRate: 0.02, wacc: 0.07, netDebt: 0, shares: 1 });
    expect(r.warnings[0]).toMatch(/WACC must exceed terminal growth/);
    expect(r.perShare).toBeNull();
  });
});
