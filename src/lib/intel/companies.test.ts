import { describe, expect, it } from "vitest";
import companiesFixture from "@/__fixtures__/research/freight/companies.json";
import pricesFixture from "@/__fixtures__/research/freight/prices.json";
import { BALANCE_METRICS, buildCompanyView, buildValuation, FLOW_METRICS } from "./companies";
import type { RawFact, RawMetric } from "./financials";
import type { CompanyFixture, PriceFixture } from "./snapshot";

const fact = (start: string | null, end: string, value: number, filed: string): RawFact => ({
  start, end, value, filed, form: "10-Q", accn: `${end}-${filed}`,
  fy: null, fp: null, latestValue: value, latestFiled: filed, latestAccn: `${end}-${filed}`,
});
const metric = (points: RawFact[], kind: RawMetric["kind"] = "duration", concept = "TestConcept"): RawMetric => ({
  concept, label: concept, unit: "USD", kind, points,
});
const periods = [
  ["2025-01-01", "2025-03-31", "2025-05-01"],
  ["2025-04-01", "2025-06-30", "2025-08-01"],
  ["2025-07-01", "2025-09-30", "2025-11-01"],
  ["2025-10-01", "2025-12-31", "2026-02-10"],
];
function inputs(): CompanyFixture["metrics"] {
  const raw: CompanyFixture["metrics"] = Object.fromEntries(
    [...FLOW_METRICS, ...BALANCE_METRICS].map((key) => [key, metric([], BALANCE_METRICS.includes(key as typeof BALANCE_METRICS[number]) ? "instant" : "duration")]),
  );
  for (const [key, value] of Object.entries({ revenue: 100, operatingIncome: 20, depreciationAmortization: 5, netIncome: 10, operatingCashFlow: 20, capex: 5 })) {
    raw[key] = metric(periods.map(([start, end, filed]) => fact(start, end, value, filed)));
  }
  raw.cash = metric([fact(null, "2025-12-31", 50, "2026-02-10")], "instant", "Cash");
  raw.equity = metric([fact(null, "2025-12-31", 500, "2026-02-10")], "instant", "Equity");
  raw.longTermDebt = metric([fact(null, "2025-12-31", 200, "2026-02-10")], "instant", "LongTermDebt");
  raw.sharesOutstandingCover = metric([fact(null, "2025-12-31", 10, "2026-02-10")], "instant", "CoverShares");
  return raw;
}
const prices = (dates = ["2026-02-27", "2026-03-31"]): PriceFixture => ({
  symbol: "TEST", provider: "test", url: "https://example.test", retrievedAt: "2026-04-01T00:00:00Z",
  note: "Synthetic regression-test inputs", columns: [], splits: [],
  rows: dates.map((date) => [date, 100, 100, 100, 100, 100, 1]),
});
const history = (raw: CompanyFixture["metrics"]) => buildValuation(raw, prices())!.history;

describe("historical valuation uses only facts public on each price date", () => {
  it.each([0, 3])("withholds P/E until net income quarter %i is filed, while retaining independent EV multiples", (quarter) => {
    const raw = inputs();
    raw.netIncome.points[quarter].filed = "2026-03-15";
    const [before, after] = history(raw);
    expect(before.fundamentalsThrough).toBe("2025-12-31");
    expect(before.pe).toBeNull();
    expect(before.evToEbitda).toBeCloseTo(11.5);
    expect(before.evToSales).toBeCloseTo(2.875);
    expect(after.pe).toBeCloseTo(25);
  });

  it("waits for both YTD inputs of a derived cash-flow quarter", () => {
    const raw = inputs();
    raw.operatingCashFlow = metric([
      fact("2025-01-01", "2025-03-31", 20, "2025-05-01"),
      fact("2025-01-01", "2025-06-30", 40, "2025-08-01"),
      fact("2025-01-01", "2025-09-30", 60, "2026-03-15"),
      fact("2025-01-01", "2025-12-31", 80, "2026-02-10"),
    ]);
    const [before, after] = history(raw);
    expect(before.fcfYield).toBeNull();
    expect(before.pe).toBeCloseTo(25);
    expect(after.fcfYield).toBeCloseTo(0.06);
  });

  it("uses the then-available YTD derivation before a later direct quarterly tag arrives", () => {
    const raw = inputs();
    raw.operatingCashFlow = metric([
      fact("2025-01-01", "2025-03-31", 20, "2025-05-01"),
      fact("2025-01-01", "2025-06-30", 40, "2025-08-01"),
      fact("2025-04-01", "2025-06-30", 21, "2026-03-15"),
      fact("2025-01-01", "2025-09-30", 60, "2025-11-01"),
      fact("2025-01-01", "2025-12-31", 80, "2026-02-10"),
    ]);
    const [before, after] = history(raw);
    expect(before.fcfYield).toBeCloseTo(0.06);
    expect(after.fcfYield).toBeCloseTo(0.061);
  });

  it("recomposes debt from the components known at the date without importing a late lease", () => {
    const raw = inputs();
    raw.financeLease = metric([fact(null, "2025-12-31", 100, "2026-03-15")], "instant", "FinanceLeaseLiability");
    const [before, after] = history(raw);
    expect(before.evToEbitda).toBeCloseTo(11.5);
    expect(after.evToEbitda).toBeCloseTo(12.5);
    expect(before.pe).toBe(after.pe);
  });

  it("gates cash, equity, and share counts on their own public filing dates", () => {
    const raw = inputs();
    raw.cash.points[0].filed = "2026-03-15";
    raw.equity.points[0].filed = "2026-03-15";
    raw.sharesOutstandingCover.points = [
      fact(null, "2025-09-30", 10, "2025-11-01"),
      fact(null, "2025-12-31", 20, "2026-03-15"),
    ];
    const [before, after] = history(raw);
    expect(before.evToSales).toBeNull();
    expect(before.pe).toBeCloseTo(25);
    expect(after.evToSales).toBeCloseTo(5.375);
    expect(after.pe).toBeCloseTo(50);
    expect(buildValuation(raw, prices(["2026-02-27"]))!.current.priceToBook).toBeNull();
    expect(buildValuation(raw, prices())!.current.priceToBook).toBeCloseTo(4);
  });
});

describe("row filing provenance", () => {
  it("includes a late TTM constituent, net income and debt component in the displayed row's release date", () => {
    const raw = inputs();
    raw.netIncome.points[0].filed = "2026-03-15";
    raw.financeLease = metric([fact(null, "2025-12-31", 100, "2026-03-20")], "instant", "FinanceLeaseLiability");
    const fixture: CompanyFixture = {
      ticker: "TEST", cik: 1, name: "Test company", sic: null, sicDescription: null, fiscalYearEnd: "1231",
      exchanges: [], retrievedAt: "2026-04-01T00:00:00Z", sources: { companyFacts: "", submissions: "", browse: "" },
      metrics: raw, filings: [], annualReport: null,
    };
    const company = buildCompanyView(fixture, { ticker: "TEST", displayName: "Test", focus: true, businessModel: "asset-based truckload", researchAngle: "Test", group: "asset-based" }, undefined, undefined, undefined, "2026-04-01");
    expect(company.latest!.ttmNetIncome).toBe(40);
    expect(company.latest!.availableFrom).toBe("2026-03-20");
    const earlier = buildCompanyView(fixture, company.coverage, undefined, undefined, undefined, "2026-02-27");
    expect(earlier.latest!.ttmNetIncome).toBeNull();
    expect(earlier.latest!.debt!.total).toBe(200);
  });
});

describe("committed snapshot late-tag regression", () => {
  it.each(["ODFL", "WERN"])("does not rewrite %s's earlier historical multiples when later facts are supplied", (ticker) => {
    const raw = (companiesFixture.companies as unknown as Record<string, CompanyFixture>)[ticker].metrics;
    const price = (pricesFixture.prices as unknown as Record<string, PriceFixture>)[ticker];
    const full = buildValuation(raw, price)!;
    for (const date of ["2022-03-31", "2022-06-30", "2022-08-31", "2022-09-30"]) {
      const thenRaw = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, { ...value, points: value.points.filter((p) => p.filed <= date) }]));
      const thenPrices = { ...price, rows: price.rows.filter((r) => r[0] <= date) };
      const then = buildValuation(thenRaw, thenPrices)!;
      const actual = full.history.find((h) => h.date === date)!;
      expect(actual, `${ticker} ${date}`).toBeDefined();
      expect(actual.pe).toBe(then.current.pe);
      expect(actual.evToEbitda).toBe(then.current.evToEbitda);
      expect(actual.evToSales).toBe(then.current.evToSales);
      expect(actual.fcfYield).toBe(then.current.fcfYield);
    }
  });
});
