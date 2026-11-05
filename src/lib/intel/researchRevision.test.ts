import { afterEach, describe, expect, it, vi } from "vitest";
import cass from "@/__fixtures__/research/freight/cass-linehaul.json";
import { deterministicAnswer } from "./copilot";
import { buildProjectView, getResearchProject, getSnapshot } from "./project";
import { buildWritingSample, sampleExportMatches } from "./writingSample";

const view = getResearchProject("freight")!;
afterEach(() => vi.useRealTimers());

describe("November research revision", () => {
  it("recomputes Cass changes from observed levels, with direct-source provenance and no fabricated history", () => {
    const index = view.kpis.find((k) => k.kpi.id === "cass-linehaul")!;
    expect(cass.observations).toHaveLength(13);
    expect(cass.observations[0]).toEqual(["2025-09-01", 140.6]);
    expect(index.latest!.value).toBe(154.8);
    expect(index.latest!.yoy).toBeCloseTo(154.8 / 140.6 - 1, 12);
    expect(index.latest!.change).toBeCloseTo(154.8 / 153.9 - 1, 12);
    expect(index.source.publisher).not.toContain("FRED");
    expect(index.source.url).toContain("cassinfo.com");
    expect(view.residuals.some((r) => r.kpiId === "cass-linehaul")).toBe(false);
  });

  it("allows observed ex-fuel growth to coexist with a negative diesel residual", () => {
    const h2 = view.hypotheses.find((h) => h.id === "H2")!;
    expect(view.residuals.find((r) => r.kpiId === "ppi-truckload")!.latest!.residual).toBeLessThan(0);
    expect(h2.overall).toBe("supports");
    expect(h2.supportingEvidenceIds).toContain("EV-KPI-cass-linehaul");
    expect(h2.contradictingEvidenceIds).not.toContain("EV-CALC-ppi-truckload-FUEL");
    expect(view.evidence.find((e) => e.id === "EV-CALC-ppi-truckload-FUEL")!.stance.H2).toBe("context");
  });

  it("describes a failing demand indicator as directionally against its screen", () => {
    const tsi = view.evidence.find((e) => e.id === "EV-KPI-freight-tsi-3M")!;
    expect(tsi.stance.H1).toBe("contradicts");
    expect(tsi.stanceReasons!.H1).toContain("Directionally against");
  });

  it("assigns Werner's margin decline its own direction, without claiming a fuel mechanism", () => {
    const id = "EV-WERN-OM-2026-06-30";
    const wern = view.evidence.find((e) => e.id === id)!;
    const h4 = view.hypotheses.find((h) => h.id === "H4")!;
    expect(wern.stance.H4).toBe("supports");
    expect(wern.stance.H5).toBe("context");
    expect(wern.stanceReasons!.H4).toContain("Cause unassigned");
    expect(h4.supportingEvidenceIds).toContain(id);
    expect(h4.contradictingEvidenceIds).not.toContain(id);
    const answer = deterministicAnswer(view, { projectId: "freight", task: "evidence-check", hypothesisId: "H4" });
    expect(answer.facts.some((s) => s.evidenceIds.includes(id) && s.text.includes("Direction consistent with H4"))).toBe(true);
    expect(answer.facts.some((s) => s.evidenceIds.includes(id) && /Direction against|Contradicts/.test(s.text))).toBe(false);
    expect(view.evidence.find((e) => e.id === "EV-WERN-Q2-RECONCILIATION")!.source.sourceType).toBe("company-release");
  });

  it("retains the failed full-sample mean rule while showing the median and every leave-one-out check", () => {
    const h5 = view.hypotheses.find((h) => h.id === "H5")!;
    const test = h5.tests[0];
    const s = test.sensitivity!;
    expect(test.outcome).toBe("contradicts");
    expect(h5.overall).toBe("mixed");
    expect(s.groupA.members.map((r) => r.ticker)).toEqual(["KNX", "SNDR", "WERN"]);
    expect(s.groupA.mean * 100).toBeCloseTo(-1.737, 2);
    expect(s.groupA.median * 100).toBeCloseTo(0.6797, 2);
    expect(s.leaveOneOut).toHaveLength(5);
    expect(s.leaveOneOut.find((r) => r.omitted === "WERN")!.meanA * 100).toBeCloseTo(0.8914, 2);
    expect(s.leaveOneOut.find((r) => r.omitted === "WERN")!.passes).toBe(true);
    expect(s.unstable).toBe(true);
  });

  it("pins the edition across visitor dates and rejects a stale PDF when content changes", () => {
    const original = buildWritingSample(view);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-10T12:00:00Z"));
    expect(buildWritingSample(getResearchProject("freight")!).contentHash).toBe(original.contentHash);
    expect(original.asOfUtc).toBe("2026-11-03");
    expect(sampleExportMatches(original, { researchVersion: original.researchVersion, contentHash: original.contentHash })).toBe(true);
    expect(sampleExportMatches({ ...original, contentHash: "changed-conclusion" }, { researchVersion: original.researchVersion, contentHash: original.contentHash })).toBe(false);
    expect(sampleExportMatches(original, { researchVersion: "old", contentHash: original.contentHash })).toBe(false);
  });

  it("prevents a later source refresh from silently entering an older research edition", () => {
    const snapshot = getSnapshot("freight")!;
    expect(() => buildProjectView(view.config, { ...snapshot, macro: { ...snapshot.macro, retrievedAt: "2026-11-04T12:00:00Z" } }, new Date(view.revision!.informationCutoff))).toThrow(/newer than the fixed edition cutoff/);
  });
});
