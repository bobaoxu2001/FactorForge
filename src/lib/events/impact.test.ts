// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AI_DATACENTER_CASE } from "@/data/events/cases/aiDatacenter";
import { BINANCE_CASE } from "@/data/events/cases/binance";
import { formatFigure } from "./figures";
import {
  assessLink,
  COMPARISON_LABEL,
  compareWithMarket,
  measuredMetrics,
  missingEvidence,
  netDirection,
  scenarioDirection,
  tracePaths,
  validateGraph,
  type EvidenceResolver,
  type ImpactEdge,
  type ImpactGraph,
  type MarketHypothesis,
} from "./impact";
import type { EventStudy } from "./market";
import { buildEventMemo } from "./memo";
import { parseInstant } from "./time";
import type { Claim, SourceRecord } from "./types";
import { caseAsOf, evidenceResolver, exposureRows, impacts, resolveClaimEvidence, testPriceCheck } from "./view";

const NOW = parseInstant("2026-11-08T12:00:00Z");
const good = (id: string) => ({ id, kind: "claim" as const, exists: true, label: id, available: true, status: "confirmed", admissible: true, note: "" });
const stub: EvidenceResolver = (id) => (id.startsWith("GHOST") ? missingEvidence(id) : good(id));
const judged = (direct: string[], at = "2026-11-08T00:00:00Z") => ({ at, direct });

const edge = (from: string, to: string, sign: ImpactEdge["sign"], evidence: string[], direct: string[] = evidence): ImpactEdge => ({
  from,
  to,
  sign,
  mechanism: "",
  epistemic: "CAUSAL_HYPOTHESIS",
  evidence,
  confidence: "medium",
  horizon: "near",
  relevance: judged(direct),
});

const tiny: ImpactGraph = {
  eventNodeId: "e",
  nodes: [
    { id: "e", layer: "event", label: "e" },
    { id: "m1", layer: "mechanism", label: "delay" },
    { id: "m2", layer: "mechanism", label: "scarcity" },
    { id: "c", layer: "company", label: "Gen", ticker: "GEN" },
  ],
  edges: [edge("e", "m1", "+", ["C1"]), edge("m1", "c", "-", ["C2"]), edge("e", "m2", "+", []), edge("m2", "c", "+", [])],
  alternatives: [],
};

const study = (abnormal: number, tStat: number): EventStudy => ({
  symbol: "GEN",
  benchmark: "SPY",
  calendar: "us-equity",
  day0: "2026-11-04",
  lastPreEventBar: "2026-11-03",
  model: { method: "market-model", alpha: 0, beta: 1, residualSd: 0.01, n: 120, meanBench: 0, sxx: 0.01, from: "2026-05-01", to: "2026-10-20" },
  windows: [{ label: "[0,0]", startDate: "2026-11-04", endDate: "2026-11-04", days: 1, complete: true, raw: abnormal, benchmark: 0, abnormal, tStat, placeboN: 500, placeboShare: Math.abs(tStat) >= 1.96 ? 0.01 : 0.4, significant: Math.abs(tStat) >= 1.96 }],
  volumeRatio: null,
  persistence: "insufficient-data",
  persistenceNote: "",
});

describe("evidence on a link", () => {
  it("never lets an id that does not resolve support a path", () => {
    const l = assessLink(edge("e", "m1", "+", ["GHOST-1"]), stub, NOW);
    expect(l.invalid).toEqual(["GHOST-1"]);
    expect(l.status).not.toBe("direct-evidence");
    const g: ImpactGraph = { ...tiny, edges: [edge("e", "m1", "+", ["GHOST-1"]), edge("m1", "c", "-", ["C2"])] };
    expect(tracePaths(g, "c", stub, NOW).every((p) => !p.evidenceBacked)).toBe(true);
  });

  it("treats a citation nobody has judged relevant as background, so the link stays an assumption", () => {
    const unjudged: ImpactEdge = { ...edge("e", "m1", "+", ["C1"]), relevance: undefined };
    expect(assessLink(unjudged, stub, NOW).status).toBe("background-only");
    expect(assessLink(edge("e", "m1", "+", ["C1"], []), stub, NOW).status).toBe("background-only");
    expect(assessLink(edge("e", "m1", "+", []), stub, NOW).status).toBe("no-evidence");
  });

  it("does not count a relevance judgement made after the cutoff", () => {
    const later = { ...edge("e", "m1", "+", ["C1"]), relevance: judged(["C1"], "2026-11-09T00:00:00Z") };
    expect(assessLink(later, stub, NOW).status).toBe("background-only");
    expect(assessLink(later, stub, parseInstant("2026-11-10T00:00:00Z")).status).toBe("direct-evidence");
  });

  it("does not let an unread source support a claim", () => {
    const blocked: SourceRecord = { id: "S-X", title: "t", publisher: "Wire", url: "https://example.com/x", tier: "primary-official", publishedAt: "2026-11-01T12:00:00Z", publishedPrecision: "minute", retrievedAt: "2026-11-02T00:00:00Z", retrieval: "blocked", retrievalNote: "refused" };
    const claim: Claim = { id: "C-X", eventId: "E", statement: "A ministry banned something.", epistemic: "REPORTED_CLAIM", topic: "t", citations: [{ sourceId: "S-X", says: "x" }], recordedAt: "2026-11-02T00:00:00Z" };
    const r = resolveClaimEvidence(claim, [blocked], NOW);
    expect(r.available).toBe(false);
    expect(r.admissible).toBe(false);
    expect(r.note).toMatch(/not read/);
    expect(resolveClaimEvidence(claim, [{ ...blocked, retrieval: "read" }], NOW).available).toBe(true);
  });

  it("does not let evidence published or judged after a cutoff support an earlier assessment", () => {
    const thesisCutoff = AI_DATACENTER_CASE.theses.find((t) => t.id === "T-AI-1")!.informationCutoff;
    const then = evidenceResolver(AI_DATACENTER_CASE, thesisCutoff);
    const now = evidenceResolver(AI_DATACENTER_CASE, caseAsOf(AI_DATACENTER_CASE));
    for (const id of ["A-C30", "FIG:VST-TX-SHARE-9M"]) {
      expect(then(id).available, id).toBe(false);
      expect(now(id).available, id).toBe(true);
    }
    const vstLink = AI_DATACENTER_CASE.graph.edges.find((e) => e.to === "c-vst")!;
    expect(assessLink(vstLink, then, parseInstant(thesisCutoff)).status).toBe("background-only");
    expect(assessLink(vstLink, now, parseInstant(caseAsOf(AI_DATACENTER_CASE))).status).toBe("direct-evidence");
  });

  it("keeps a confirmed policy fact from verifying the business mechanism downstream of it", () => {
    const vst = impacts(AI_DATACENTER_CASE).find((i) => i.ticker === "VST")!;
    const main = vst.paths.find((p) => p.nodes.join(">") === "ev>m-delay>i-capex>i-power>c-vst")!;
    expect(main.links[0].status).toBe("direct-evidence"); // the permit pauses exist
    expect(main.links[1].status).toBe("background-only"); // that they push capex out is still assumed
    expect(main.evidenceBacked).toBe(false);
    expect(vst.net).toBe("unsupported");
  });

  it("treats an unverified exposure classification as background, not evidence", () => {
    const r = evidenceResolver(AI_DATACENTER_CASE, caseAsOf(AI_DATACENTER_CASE))("EXP:NVDA:directRevenue");
    expect(r.exists).toBe(true);
    expect(r.admissible).toBe(false);
  });
});

describe("paths and direction", () => {
  it("multiplies signs along each path as a scenario aid", () => {
    const paths = tracePaths(tiny, "c", stub, NOW);
    expect(paths.map((p) => p.sign).sort()).toEqual(["+", "-"]);
    expect(scenarioDirection(paths)).toBe("mixed");
  });

  it("sets the net direction from evidence-backed paths only", () => {
    expect(netDirection(tracePaths(tiny, "c", stub, NOW))).toBe("negative");
    const all = { ...tiny, edges: tiny.edges.map((e) => (e.evidence.length ? e : { ...e, evidence: ["X"], relevance: judged(["X"]) })) };
    expect(netDirection(tracePaths(all, "c", stub, NOW))).toBe("ambiguous");
    const none = { ...tiny, edges: tiny.edges.map((e) => ({ ...e, evidence: [] })) };
    expect(netDirection(tracePaths(none, "c", stub, NOW))).toBe("unsupported");
  });

  it("does not hard-code every restriction as bearish: the AI case's proposed mechanisms disagree for generators", () => {
    const imp = impacts(AI_DATACENTER_CASE);
    expect(imp.find((i) => i.ticker === "VST")!.scenario).toBe("mixed");
    expect(imp.find((i) => i.ticker === "CEG")!.scenario).toBe("mixed");
  });
});

describe("business hypotheses versus price moves", () => {
  const priceDown: MarketHypothesis = { direction: "down", target: "price", metric: "price", horizon: "event-window", windowLabel: "[0,0]" };

  it("does not call a move consistent when there is no directional hypothesis", () => {
    const r = compareWithMarket({ ...priceDown, direction: null }, study(-0.1, -5));
    expect(r.state).toBe("not-assessable");
    expect(r.note).toMatch(/no directional hypothesis/);
  });

  it("calls an operating hypothesis, or a different window, not comparable with a one-day move", () => {
    expect(compareWithMarket({ direction: "down", target: "operating", metric: "orders", horizon: "two-quarter" }, study(-0.1, -5)).state).toBe("not-comparable");
    expect(compareWithMarket({ ...priceDown, windowLabel: "[0,4]" }, study(-0.1, -5), "[0,0]").state).toBe("not-comparable");
  });

  it("keeps a move within noise inconclusive, not evidence of no effect", () => {
    const r = compareWithMarket(priceDown, study(-0.01, -0.8));
    expect(r.state).toBe("inconclusive");
    expect(r.note).not.toMatch(/no effect|disproves|wrong/i);
  });

  it("calls a same-direction move aligned without establishing the mechanism, and an opposite one a review prompt", () => {
    const same = compareWithMarket(priceDown, study(-0.1, -5));
    expect(same.state).toBe("aligned");
    expect(same.note).toMatch(/cannot show which mechanism/);
    expect(COMPARISON_LABEL[same.state]).toMatch(/mechanism not established/);
    const opposite = compareWithMarket(priceDown, study(0.08, 4));
    expect(opposite.state).toBe("review");
    expect(opposite.note).not.toMatch(/refut|contradict|falsif/i);
  });

  it("never reports a company's business hypothesis as confirmed by its day-0 price move", () => {
    for (const i of impacts(AI_DATACENTER_CASE)) expect(["not-assessable", "not-comparable", "no-data"], i.label).toContain(i.comparison.state);
  });

  it("compares a research test's price prediction with its own window", () => {
    const t = AI_DATACENTER_CASE.companyCases![0].tests.find((x) => x.id === "H-VST-3")!;
    expect(testPriceCheck(AI_DATACENTER_CASE, t)!.state).toBe("aligned");
  });
});

describe("measured metrics are labelled for what they measure", () => {
  const base = { forwardPE: null, evToRevenue: 3, netDebtToMarketCap: null, beta: 1.4, benchmark: "SPY", momentum60: null, volumeRatio: null };

  it("calls beta an estimated market sensitivity, and positioning not measured", () => {
    const m = measuredMetrics(base);
    const beta = m.find((x) => x.key === "marketSensitivity")!;
    expect(beta.label).toMatch(/market sensitivity/i);
    expect(beta.label).toMatch(/estimated/i);
    expect(beta.epistemic).toBe("MODEL_ESTIMATE");
    expect(m.some((x) => /sentiment/i.test(x.label))).toBe(false);
    expect(m.find((x) => x.key === "positioning")!.state).toBe("not-measured");
  });

  it("never converts EV/sales into a P/E", () => {
    const m = measuredMetrics(base);
    expect(m.find((x) => x.key === "forwardPE")!.state).toBe("missing");
    expect(m.find((x) => x.key === "evToSales")!.display).toBe("3.0×");
    expect(m.some((x) => x.display.includes("12"))).toBe(false);
  });

  it("shows missing and undisclosed values as such, never as zero", () => {
    const m = measuredMetrics(base);
    expect(m.find((x) => x.key === "netDebtToMarketValue")!.display).not.toMatch(/^0/);
    expect(formatFigure({ value: null, unit: "USD m" })).toBe("Not disclosed");
    expect(formatFigure({ value: 0, unit: "USD m" })).toBe("$0m");
    const vst = exposureRows(AI_DATACENTER_CASE).find((r) => r.ticker === "VST")!;
    expect(vst.metrics.find((x) => x.key === "netDebtToMarketValue")!.state).toBe("missing");
    const txMw = AI_DATACENTER_CASE.companyCases![0].figures.find((f) => f.id === "VST-TX-MW")!;
    expect(formatFigure(txMw)).toBe("Not disclosed");
  });
});

describe("one current assessment feeds every summary", () => {
  const a = AI_DATACENTER_CASE.currentAssessment!;

  it("renders the memo's assessment from the case record", () => {
    const memo = buildEventMemo(AI_DATACENTER_CASE).find((s) => s.title === "Current assessment")!;
    expect(memo.paragraphs[0]).toContain(a.view);
    expect(memo.paragraphs.join(" ")).toContain(a.nextStep);
  });

  it("keeps the assessment text out of page code, so the brief cannot carry its own copy", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) files.push(p);
      }
    };
    walk(path.join(process.cwd(), "src/app"));
    for (const f of files) expect(readFileSync(f, "utf8").includes(a.view.slice(0, 60)), f).toBe(false);
  });

  it("keeps fact verification and interpretation strength apart", () => {
    expect(["weak", "tentative", "moderate", "strong"]).toContain(a.interpretation.strength);
    expect(a.interpretation.reason.length).toBeGreaterThan(40);
    expect(a.strongest.length).toBeGreaterThan(0);
    expect(a.uncertainty.length).toBeGreaterThan(0);
  });
});

describe("graph structure", () => {
  it("rejects edges that run backwards, call causation observed, or judge evidence they do not cite", () => {
    const bad: ImpactGraph = {
      ...tiny,
      edges: [
        { ...edge("c", "m1", "+", []), epistemic: "ANALYST_INTERPRETATION" },
        { ...edge("e", "m1", "+", []), epistemic: "OBSERVED_FACT" },
        { ...edge("e", "m2", "+", ["C1"]), relevance: judged(["C9"]) },
      ],
    };
    const problems = validateGraph(bad);
    expect(problems.some((p) => /backwards/.test(p))).toBe(true);
    expect(problems.some((p) => /never an observed fact/.test(p))).toBe(true);
    expect(problems.some((p) => /does not cite/.test(p))).toBe(true);
  });

  it("validates both case graphs, and every cited id resolves", () => {
    expect(validateGraph(AI_DATACENTER_CASE.graph)).toEqual([]);
    expect(validateGraph(BINANCE_CASE.graph)).toEqual([]);
    for (const c of [AI_DATACENTER_CASE, BINANCE_CASE]) {
      const resolve = evidenceResolver(c, caseAsOf(c));
      for (const e of c.graph.edges) for (const id of e.evidence) expect(resolve(id).exists, `${c.id} ${e.from}→${e.to} ${id}`).toBe(true);
    }
  });
});
