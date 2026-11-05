import { describe, expect, it } from "vitest";
import { getResearchProject } from "./project";
import { buildWritingSample } from "./writingSample";

const view = getResearchProject("freight")!;

describe("public writing sample", () => {
  it("connects every observation to its original source and includes both residual inputs", () => {
    const sample = buildWritingSample(view);
    for (const observation of sample.observations) {
      expect(observation.references.length).toBeGreaterThan(0);
      for (const number of observation.references) expect(sample.sources.find((source) => source.number === number)?.url).toMatch(/^https:\/\//);
    }
    expect(sample.sources.some((source) => source.url.endsWith("/GASDESW"))).toBe(true);
    expect(sample.sources.some((source) => source.url.endsWith("/PCU484121484121"))).toBe(true);
    expect(new Set(sample.sources.map((source) => source.url)).size).toBe(sample.sources.length);
    expect(sample.scope).toContain("No primary interviews");
    expect(sample.nextChecks.at(-1)!.test).toContain("planned, not completed");
  });

  it("does not retain quantitative findings when their evidence is removed", () => {
    const sample = buildWritingSample({ ...view, evidence: [] });
    expect(sample.observations).toEqual([]);
    expect(sample.sources).toEqual([]);
    expect(sample.conclusion).toContain("More public evidence");
  });

  it("places each company's filing beside its value and the adjusted disclosure beside its interpretation", () => {
    const sample = buildWritingSample(view);
    const company = sample.observations.find((observation) => observation.label.includes("Company conversion"))!;
    expect(company.findingParts!.map((part) => part.text).join("")).toBe(company.finding);
    expect(company.interpretationParts!.map((part) => part.text).join("")).toBe(company.interpretation);
    for (const ticker of ["KNX", "SNDR", "WERN"]) {
      const part = company.findingParts!.find((part) => part.text.includes(`${ticker} `) && part.references.length)!;
      expect(part.references).toHaveLength(1);
      const url = sample.sources.find((source) => source.number === part.references[0])!.url;
      expect(url).toBe(view.evidence.find((item) => item.id === `EV-${ticker}-OM-2026-06-30`)!.source.url);
    }
    const disclosure = company.interpretationParts!.find((part) => part.references.length)!;
    expect(sample.sources.find((source) => source.number === disclosure.references[0])!.url).toBe(view.evidence.find((item) => item.id === "EV-WERN-Q2-RECONCILIATION")!.source.url);
    expect(new Set([...company.findingParts!, ...company.interpretationParts!].flatMap((part) => part.references))).toEqual(new Set(company.references));
    expect(company.references).toHaveLength(4);
  });
});
