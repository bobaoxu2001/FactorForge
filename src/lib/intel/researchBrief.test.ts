import { describe, expect, it } from "vitest";
import { getResearchProject } from "./project";
import { buildCompanyBrief, buildResearchBrief } from "./researchBrief";

const view = getResearchProject("freight", new Date("2026-11-03T00:00:00Z"))!;

describe("research brief evidence boundaries", () => {
  it("retains observed periods and traces every quantitative observation to existing evidence", () => {
    const brief = buildResearchBrief(view);
    const known = new Set(view.evidence.map((item) => item.id));
    expect(brief.observations).toHaveLength(3);
    for (const item of brief.observations) {
      expect(item.evidenceIds.length).toBeGreaterThan(0);
      expect(item.evidenceIds.every((id) => known.has(id))).toBe(true);
    }
    const pricing = brief.observations.find((item) => item.label.includes("Pricing"))!;
    const residual = view.residuals.find((item) => item.kpiId === "ppi-truckload")!.latest!;
    expect(pricing.finding).toContain(`${(residual.residual * 100).toFixed(1)}pp`);
    expect(pricing.finding).toContain(residual.date.slice(0, 7));
    expect(pricing.interpretation).toMatch(/not a direct measure.*causal/);
  });

  it("does not manufacture findings when the source evidence is missing", () => {
    const brief = buildResearchBrief({ ...view, evidence: [] });
    expect(brief.observations).toEqual([]);
    expect(brief.conclusion).toMatch(/More public evidence/);
    expect(buildCompanyBrief(view.companies[0], { ...view, evidence: [] })).toEqual([]);
  });

  it("keeps reported changes separate from mechanism and market-expectation claims", () => {
    const brief = buildResearchBrief(view);
    expect(brief.nextChecks.map((item) => item.test).join(" ")).toMatch(/same period.*common quarter.*cannot reveal market expectations/);
    const company = view.companies.find((item) => item.ticker === "KNX")!;
    const reading = buildCompanyBrief(company, view);
    expect(reading[0].finding).toContain(company.latest!.label);
    expect(reading[0].interpretation).toMatch(/do not isolate/);
    expect(reading.find((item) => item.label.includes("valuation"))!.interpretation).toMatch(/does not establish fair value/);
  });
});
