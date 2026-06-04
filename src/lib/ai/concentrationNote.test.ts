import { describe, expect, it } from "vitest";
import { generateConcentrationNote } from "./concentrationNote";
import type { SignalConcentrationReport } from "@/lib/quant/signalConcentration";

function report(overrides: Partial<SignalConcentrationReport> = {}): SignalConcentrationReport {
  return {
    strategyCount: 4,
    correlation: [],
    pairCorrelations: [],
    averagePairwiseCorrelation: 0.72,
    maxPair: { a: "K · JPM", b: "V · BAC", correlation: 0.91 },
    effectiveStrategies: 1.4,
    level: "high",
    factorRows: [],
    sharedDominantFactor: { factor: "vol", count: 3 },
    verdict: "High overlap.",
    ...overrides,
  };
}

describe("generateConcentrationNote", () => {
  it("returns null when there is no concentration report", async () => {
    expect(await generateConcentrationNote(null)).toBeNull();
  });

  it("builds a template note that cites N_eff and the shared factor (no API key)", async () => {
    const note = await generateConcentrationNote(report(), { demotedCount: 1 });
    expect(note).not.toBeNull();
    expect(note!.source).toBe("template");
    expect(note!.headline).toContain("1.4");
    expect(note!.headline).toContain("high overlap");
    expect(note!.assessment).toContain("Low-vol"); // shared dominant factor label
    expect(note!.assessment).toMatch(/demoted by the concentration gate/);
    expect(note!.researchAction).toMatch(/strongest strategy within each correlated cluster/);
  });

  it("gives a diversified research action when overlap is low", async () => {
    const note = await generateConcentrationNote(
      report({ level: "low", averagePairwiseCorrelation: 0.1, effectiveStrategies: 3.6, sharedDominantFactor: null }),
    );
    expect(note!.researchAction).toMatch(/lower overlap/);
  });
});
