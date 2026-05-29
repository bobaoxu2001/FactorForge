import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the DeepSeek client so we exercise the LLM branch without network or key.
vi.mock("./deepseek", () => ({
  isDeepseekConfigured: vi.fn(() => true),
  callDeepseekJson: vi.fn(),
}));

import { generateConcentrationNote } from "./concentrationNote";
import { callDeepseekJson } from "./deepseek";
import type { SignalConcentrationReport } from "@/lib/quant/signalConcentration";

const mockedCall = vi.mocked(callDeepseekJson);

// Vary numbers per test so the module-level note cache key differs each time.
function report(overrides: Partial<SignalConcentrationReport> = {}): SignalConcentrationReport {
  return {
    strategyCount: 4,
    correlation: [],
    pairCorrelations: [],
    averagePairwiseCorrelation: 0.71,
    maxPair: { a: "K · JPM", b: "V · BAC", correlation: 0.9 },
    effectiveStrategies: 1.4,
    level: "high",
    factorRows: [],
    sharedDominantFactor: { factor: "vol", count: 3 },
    verdict: "High overlap.",
    ...overrides,
  };
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("generateConcentrationNote — DeepSeek branch", () => {
  it("adopts LLM prose and marks the source as deepseek", async () => {
    mockedCall.mockResolvedValue({
      headline: "LLM: four strategies, one bet.",
      assessment: "LLM: they all ride the same financials factor.",
      recommendation: "LLM: keep only the strongest.",
    });

    const note = await generateConcentrationNote(report({ strategyCount: 4, averagePairwiseCorrelation: 0.701 }));
    expect(note!.source).toBe("deepseek");
    expect(note!.headline).toBe("LLM: four strategies, one bet.");
    expect(note!.assessment).toBe("LLM: they all ride the same financials factor.");
    expect(note!.recommendation).toBe("LLM: keep only the strongest.");
  });

  it("falls back to the template for blank LLM fields (pickString guard)", async () => {
    mockedCall.mockResolvedValue({
      headline: "   ",
      assessment: "",
      recommendation: "LLM: only this field is valid.",
    });

    const note = await generateConcentrationNote(report({ strategyCount: 5, averagePairwiseCorrelation: 0.702, effectiveStrategies: 1.6 }));
    expect(note!.source).toBe("deepseek");
    // blank fields fall back to the deterministic template prose...
    expect(note!.headline).toContain("1.6");
    expect(note!.headline).toContain("high overlap");
    expect(note!.assessment).toContain("Low-vol");
    // ...while the one valid field is adopted verbatim.
    expect(note!.recommendation).toBe("LLM: only this field is valid.");
  });

  it("falls back fully to template when the LLM call returns null", async () => {
    mockedCall.mockResolvedValue(null);
    const note = await generateConcentrationNote(report({ strategyCount: 6, averagePairwiseCorrelation: 0.703 }));
    expect(note!.source).toBe("template");
  });
});
