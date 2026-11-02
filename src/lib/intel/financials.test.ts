import { describe, expect, it } from "vitest";
import { composeDebt, knownAt, quarterizeDuration, quarterLabel, toMetricSeries, ttm, type RawFact } from "./financials";
import type { MetricSeries } from "./types";

const fact = (start: string | null, end: string, value: number, filed: string, extra: Partial<RawFact> = {}): RawFact => ({
  start,
  end,
  value,
  filed,
  form: "10-Q",
  accn: `acc-${end}-${filed}`,
  fy: null,
  fp: null,
  latestValue: value,
  latestFiled: filed,
  latestAccn: `acc-${end}-${filed}`,
  ...extra,
});

describe("quarterizeDuration", () => {
  // Cash-flow style: only YTD values are filed in 10-Qs, FY in the 10-K.
  const ytd = [
    fact("2025-01-01", "2025-03-31", 100, "2025-05-01"),
    fact("2025-01-01", "2025-06-30", 250, "2025-08-01"),
    fact("2025-01-01", "2025-09-30", 420, "2025-11-01"),
    fact("2025-01-01", "2025-12-31", 600, "2026-02-20", { form: "10-K" }),
  ];

  it("derives Q2/Q3 by YTD differencing and Q4 as FY − 9M, labelled", () => {
    const q = quarterizeDuration(ytd);
    expect(q.map((x) => [x.end, x.value, x.derivation])).toEqual([
      ["2025-03-31", 100, "reported-3m"],
      ["2025-06-30", 150, "ytd-difference"],
      ["2025-09-30", 170, "ytd-difference"],
      ["2025-12-31", 180, "fy-minus-9m"],
    ]);
    expect(q[1].start).toBe("2025-04-01");
  });

  it("dates a derived quarter by the LATEST filing it depends on (point-in-time)", () => {
    const q4 = quarterizeDuration(ytd).find((x) => x.end === "2025-12-31");
    expect(q4?.filed).toBe("2026-02-20");
  });

  it("prefers a directly reported 3-month fact over a derived one", () => {
    const q = quarterizeDuration([...ytd, fact("2025-04-01", "2025-06-30", 149, "2025-08-01")]);
    const q2 = q.find((x) => x.end === "2025-06-30");
    expect(q2?.value).toBe(149);
    expect(q2?.derivation).toBe("reported-3m");
  });

  it("flags restatements and keeps the latest value separately", () => {
    const q = quarterizeDuration([fact("2025-04-01", "2025-06-30", 150, "2025-08-01", { latestValue: 155, latestFiled: "2026-08-01" })]);
    expect(q[0].revised).toBe(true);
    expect(q[0].value).toBe(150);
    expect(q[0].latestValue).toBe(155);
  });
});

describe("ttm / knownAt / labels", () => {
  const series = toMetricSeries("revenue", {
    concept: "Revenues",
    label: "Revenues",
    unit: "USD",
    kind: "duration",
    points: [
      fact("2025-01-01", "2025-03-31", 10, "2025-05-01"),
      fact("2025-04-01", "2025-06-30", 11, "2025-08-01"),
      fact("2025-07-01", "2025-09-30", 12, "2025-11-01"),
      fact("2025-01-01", "2025-12-31", 46, "2026-02-20"),
      fact("2025-01-01", "2025-09-30", 33, "2025-11-01"),
    ],
  });
  it("sums four consecutive quarters and refuses gaps", () => {
    expect(ttm(series.quarters, "2025-12-31")).toBe(46);
    expect(ttm(series.quarters, "2025-09-30")).toBeNull();
  });
  it("filters to what was filed by a date", () => {
    expect(knownAt(series.quarters, "2026-01-15").map((q) => q.end)).toEqual(["2025-03-31", "2025-06-30", "2025-09-30"]);
  });
  it("labels 52/53-week period ends correctly", () => {
    expect(quarterLabel("2026-09-26")).toBe("Q3 2026");
    expect(quarterLabel("2026-01-02")).toBe("Q4 2025");
  });
});

describe("composeDebt", () => {
  const inst = (concept: string, value: number, end = "2026-09-30"): MetricSeries => ({
    key: concept,
    concept,
    label: concept,
    unit: "USD",
    quarters: [{ end, start: null, value, derivation: "instant", filed: "2026-10-30", accession: "a", form: "10-Q", revised: false, latestValue: null }],
  });
  it("uses LongTermDebt and adds a larger convertible plus finance leases", () => {
    const d = composeDebt(
      { longTermDebt: inst("LongTermDebt", 232), convertibleDebt: inst("ConvertibleDebt", 1467), financeLeaseNoncurrent: inst("FinanceLeaseLiabilityNoncurrent", 508) },
      "2026-09-30",
    );
    expect(d?.total).toBe(232 + 1467 + 508);
    expect(d?.notes.join(" ")).toMatch(/current portion is excluded/);
  });
  it("does not double count a convertible that LongTermDebt already includes", () => {
    const d = composeDebt({ longTermDebt: inst("LongTermDebt", 2000), convertibleDebt: inst("ConvertibleDebt", 1500) }, "2026-09-30");
    expect(d?.total).toBe(2000);
  });
  it("falls back to noncurrent + current and prefers a combined tag", () => {
    expect(composeDebt({ longTermDebtNoncurrent: inst("LongTermDebtNoncurrent", 100), longTermDebtCurrent: inst("LongTermDebtCurrent", 20) }, "2026-09-30")?.total).toBe(120);
    expect(composeDebt({ debtCombined: inst("DebtLongtermAndShorttermCombinedAmount", 390), longTermDebtNoncurrent: inst("LongTermDebtNoncurrent", 380) }, "2026-09-30")?.total).toBe(390);
  });
  it("returns null when nothing is tagged", () => {
    expect(composeDebt({}, "2026-09-30")).toBeNull();
  });
});
