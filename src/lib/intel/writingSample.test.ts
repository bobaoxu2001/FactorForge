import { describe, expect, it } from "vitest";
import { getResearchProject } from "./project";
import { buildWritingSample } from "./writingSample";

const view = getResearchProject("freight", new Date("2026-11-03T00:00:00Z"))!;

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
});
