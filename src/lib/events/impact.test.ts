// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AI_DATACENTER_CASE } from "@/data/events/cases/aiDatacenter";
import { BINANCE_CASE } from "@/data/events/cases/binance";
import { netDirection, reconcileWithMarket, tracePaths, validateGraph, type ImpactGraph } from "./impact";
import type { EventStudy } from "./market";
import { impacts } from "./view";

const tiny: ImpactGraph = {
  eventNodeId: "e",
  nodes: [
    { id: "e", layer: "event", label: "e" },
    { id: "m1", layer: "mechanism", label: "delay" },
    { id: "m2", layer: "mechanism", label: "scarcity" },
    { id: "c", layer: "company", label: "Gen", ticker: "GEN" },
  ],
  edges: [
    { from: "e", to: "m1", sign: "+", mechanism: "", epistemic: "ANALYST_INTERPRETATION", evidence: ["C1"], confidence: "high", horizon: "near" },
    { from: "m1", to: "c", sign: "-", mechanism: "", epistemic: "CAUSAL_HYPOTHESIS", evidence: ["C2"], confidence: "medium", horizon: "near" },
    { from: "e", to: "m2", sign: "+", mechanism: "", epistemic: "CAUSAL_HYPOTHESIS", evidence: [], confidence: "low", horizon: "long" },
    { from: "m2", to: "c", sign: "+", mechanism: "", epistemic: "CAUSAL_HYPOTHESIS", evidence: [], confidence: "low", horizon: "long" },
  ],
  alternatives: [],
};

const study = (abnormal: number, tStat: number): EventStudy => ({
  symbol: "GEN",
  benchmark: "SPY",
  calendar: "us-equity",
  day0: "2026-11-04",
  lastPreEventBar: "2026-11-03",
  model: { method: "market-model", alpha: 0, beta: 1, residualSd: 0.01, n: 120 },
  windows: [{ label: "[0,0]", startDate: "2026-11-04", endDate: "2026-11-04", days: 1, complete: true, raw: abnormal, benchmark: 0, abnormal, tStat }],
  volumeRatio: null,
  persistence: "insufficient-data",
  persistenceNote: "",
});

describe("causal paths", () => {
  it("multiplies signs along each path", () => {
    const paths = tracePaths(tiny, "c");
    expect(paths.map((p) => p.sign).sort()).toEqual(["+", "-"]);
  });

  it("ignores hypothesis-only paths when setting the net direction", () => {
    expect(netDirection(tracePaths(tiny, "c"))).toBe("negative");
  });

  it("calls a company ambiguous when evidence-backed paths disagree", () => {
    const g = { ...tiny, edges: tiny.edges.map((e) => ({ ...e, evidence: e.evidence.length ? e.evidence : ["X"] })) };
    expect(netDirection(tracePaths(g, "c"))).toBe("ambiguous");
  });

  it("calls a company unsupported when no path has evidence", () => {
    const g = { ...tiny, edges: tiny.edges.map((e) => ({ ...e, evidence: [] })) };
    expect(netDirection(tracePaths(g, "c"))).toBe("unsupported");
  });

  it("does not hard-code every restriction as bearish for every AI stock", () => {
    const nets = impacts(AI_DATACENTER_CASE).map((i) => i.net);
    expect(new Set(nets).size).toBeGreaterThan(1);
    expect(impacts(AI_DATACENTER_CASE).find((i) => i.ticker === "CEG")!.net).toBe("ambiguous");
  });
});

describe("the map never overrides measured prices", () => {
  it("flags a clear market move against the map as a contradiction", () => {
    expect(reconcileWithMarket("negative", study(0.06, 3.2)).marketCheck).toBe("contradicted");
  });

  it("treats small moves as noise, not confirmation", () => {
    expect(reconcileWithMarket("negative", study(-0.01, -0.8)).marketCheck).toBe("not-significant");
  });

  it("reports missing data as missing", () => {
    expect(reconcileWithMarket("negative", undefined).marketCheck).toBe("no-data");
  });
});

describe("graph structure", () => {
  it("rejects edges that run backwards or call causation observed", () => {
    const bad: ImpactGraph = {
      ...tiny,
      edges: [
        { from: "c", to: "m1", sign: "+", mechanism: "", epistemic: "ANALYST_INTERPRETATION", evidence: [], confidence: "low", horizon: "near" },
        { from: "e", to: "m1", sign: "+", mechanism: "", epistemic: "OBSERVED_FACT", evidence: [], confidence: "low", horizon: "near" },
      ],
    };
    const problems = validateGraph(bad);
    expect(problems.some((p) => /backwards/.test(p))).toBe(true);
    expect(problems.some((p) => /never an observed fact/.test(p))).toBe(true);
  });

  it("validates both case graphs", () => {
    expect(validateGraph(AI_DATACENTER_CASE.graph)).toEqual([]);
    expect(validateGraph(BINANCE_CASE.graph)).toEqual([]);
  });
});
