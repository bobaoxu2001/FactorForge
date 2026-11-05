import { describe, expect, it } from "vitest";
import type { CompanyView, QuarterRow } from "./companies";
import { findCommonQuarter, quarterEvidenceId } from "./comparability";
import { getResearchProject } from "./project";
import { evaluateTest, type ThesisContext } from "./thesis";

const view = getResearchProject("freight", new Date("2026-11-03T00:00:00Z"))!;
const base = view.companies.find((company) => company.ticker === "KNX")!;
const row = (end: string, margin: number | null): QuarterRow => ({ ...base.quarters.find((item) => item.end === "2026-06-30")!, end, operatingMarginYoYChange: margin });
const company = (ticker: string, rows: QuarterRow[]): CompanyView => ({ ...base, ticker, quarters: rows, latest: rows.at(-1)! });
const peerTest = { kind: "company-group-spread", id: "peer", description: "Asset versus broker margin change", metric: "operatingMarginYoYChange", groupA: ["AAA"], groupB: ["BBB"], threshold: 0 } as const;

function context(companies: CompanyView[]): ThesisContext {
  return { kpis: new Map(), residuals: new Map(), companies: new Map(companies.map((item) => [item.ticker, item])), evidenceIds: new Set(companies.flatMap((item) => item.quarters.map((quarter) => quarterEvidenceId(item.ticker, "OM", quarter.end)))) };
}

describe("matched reporting periods", () => {
  it("does not let a newer quarter reverse a comparison with an older peer", () => {
    const a = company("AAA", [row("2026-06-30", 0.01), row("2026-09-30", 0.30)]);
    const b = company("BBB", [row("2026-06-30", 0.02)]);
    const result = evaluateTest({ ...peerTest, groupA: [...peerTest.groupA], groupB: [...peerTest.groupB] }, context([a, b]));
    expect(result.outcome).toBe("contradicts");
    expect(result.period).toBe("Q2 2026");
    expect(result.detail).toContain("spread -1.0pp");
    expect(result.evidenceIds).toEqual(["EV-AAA-OM-2026-06-30", "EV-BBB-OM-2026-06-30"]);
    expect(result.evidenceIds.join(" ")).not.toContain("2026-09-30");
  });

  it("withholds a result when a peer or a common usable quarter is missing", () => {
    const a = company("AAA", [row("2026-06-30", 0.01)]);
    const b = company("BBB", [row("2026-09-30", 0.02)]);
    for (const companies of [[a, b], [a], [a, company("BBB", [row("2026-06-30", null)])]]) {
      const result = evaluateTest({ ...peerTest, groupA: ["AAA"], groupB: ["BBB"] }, context(companies));
      expect(result.outcome).toBe("insufficient-data");
      expect(result.evidenceIds).toEqual([]);
    }
  });

  it("requires the dated evidence rather than falling back to a latest-quarter alias", () => {
    const ctx = context([company("AAA", [row("2026-06-30", 0.01)]), company("BBB", [row("2026-06-30", 0.02)])]);
    ctx.evidenceIds = new Set(["EV-AAA-OM", "EV-BBB-OM"]);
    expect(evaluateTest({ ...peerTest, groupA: ["AAA"], groupB: ["BBB"] }, ctx).outcome).toBe("insufficient-data");
  });

  it("accepts comparable 52-week dates but rejects widely separated fiscal ends", () => {
    const a = company("AAA", [row("2026-06-30", 0.01)]);
    expect(findCommonQuarter([a, company("BBB", [row("2026-06-27", 0.02)])])?.label).toBe("Q2 2026");
    expect(findCommonQuarter([a, company("BBB", [row("2026-06-15", 0.02)])])).toBeNull();
  });

  it("uses matched Q2 observations and real dated source links for the freight peer test", () => {
    const test = view.hypotheses.find((item) => item.id === "H5")!.tests[0];
    expect(test.period).toBe("Q2 2026");
    expect(test.detail).toContain("spread -1.7pp");
    expect(test.evidenceIds).toHaveLength(5);
    for (const id of test.evidenceIds) {
      const evidence = view.evidence.find((item) => item.id === id)!;
      expect(evidence).toBeDefined();
      expect(evidence.observationPeriod!.end).toMatch(/^2026-06-/);
      expect(id).toContain(evidence.observationPeriod!.end);
      expect(evidence.source.url).toMatch(/sec\.gov\/Archives/);
    }
  });
});
