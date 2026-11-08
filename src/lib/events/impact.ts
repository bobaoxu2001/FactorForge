import type { EventStudy, WindowResult } from "./market";
import { parseInstant } from "./time";
import type { EpistemicClass } from "./types";

/**
 * Impact map: event → mechanism → industry → company → expectations →
 * valuation / risk premium → possible price response.
 *
 * Each link carries a sign, the mechanism in words, what kind of statement it
 * is, and the evidence cited for it. Citing evidence is not the same as
 * establishing the link, so every citation is checked on four counts before it
 * can count:
 *   1. Reference   — does the claim, market check or figure exist?
 *   2. Availability — was it published, from a source actually read, by the
 *                     assessment cutoff? Later evidence never improves an
 *                     earlier assessment.
 *   3. Verification — is the claim verified well enough (not a rumour, not
 *                     disputed; a market move beyond noise)?
 *   4. Relevance   — has an analyst, in a dated judgement, marked it as bearing
 *                     on this link's mechanism, company, geography, metric and
 *                     period? Unmarked citations are background: they can
 *                     establish that a policy exists without establishing
 *                     that a company's revenue changes.
 * What is left over is the link's assumption, stated in words.
 *
 * Signs multiplied along a path are a qualitative scenario aid ("this
 * mechanism would push the company's business down"), not an estimate of
 * earnings or returns. The net direction counts only paths whose every link
 * has direct, admissible evidence at the cutoff. A business hypothesis is not
 * tested by a one-day price move; see compareWithMarket.
 */

export type Layer = "event" | "mechanism" | "industry" | "company" | "expectations" | "valuation" | "price";
export const LAYERS: Layer[] = ["event", "mechanism", "industry", "company", "expectations", "valuation", "price"];

export type Sign = "+" | "-" | "±";

export interface ImpactNode {
  id: string;
  layer: Layer;
  label: string;
  detail?: string;
  ticker?: string;
}

/** A dated analyst judgement of which cited items bear directly on a link. */
export interface EdgeRelevance {
  /** Cannot support an assessment dated before this moment. */
  at: string;
  /** Citations that bear on this link's mechanism, company, geography, metric and period. */
  direct: string[];
  note?: string;
}

export interface ImpactEdge {
  from: string;
  to: string;
  sign: Sign;
  mechanism: string;
  epistemic: EpistemicClass;
  /** Claim ids, market checks (MKT:window:symbol), exposure entries (EXP:ticker:dimension) or disclosed figures (FIG:id). */
  evidence: string[];
  confidence: "high" | "medium" | "low";
  horizon: "near" | "medium" | "long";
  /** What the cited evidence establishes, in plain words. */
  establishes?: string;
  /** The assumption that carries the link from that evidence to the business effect. */
  assumption?: string;
  /** What would challenge the assumption. */
  wouldChallenge?: string;
  relevance?: EdgeRelevance;
}

export interface AlternativePath {
  id: string;
  label: string;
  description: string;
  epistemic: EpistemicClass;
  /** Which companies' direction it would flip or soften. */
  affects: string[];
  watch: string;
}

export interface ImpactGraph {
  eventNodeId: string;
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  alternatives: AlternativePath[];
}

// ── Evidence on a link ──────────────────────────────────────────────────────

export type EvidenceKind = "claim" | "market" | "exposure" | "figure" | "unknown";

export interface ResolvedEvidence {
  id: string;
  kind: EvidenceKind;
  /** The id refers to a record that exists. */
  exists: boolean;
  /** A few descriptive words, e.g. "Texas permit halt". */
  label: string;
  /** Published, from a source that was read, by the assessment cutoff. */
  available: boolean;
  /** Verification state or measured status, in words ("confirmed", "beyond noise", "unverified classification"). */
  status: string;
  /** Strong enough to count if relevant: not a rumour or disputed, a move beyond noise, a read primary figure. */
  admissible: boolean;
  note: string;
}

export type EvidenceResolver = (id: string) => ResolvedEvidence;

export const missingEvidence = (id: string): ResolvedEvidence => ({
  id,
  kind: "unknown",
  exists: false,
  label: id,
  available: false,
  status: "unknown reference",
  admissible: false,
  note: "No claim, market check, exposure entry or figure has this id.",
});

export type LinkStatus = "no-evidence" | "background-only" | "direct-evidence";

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  "no-evidence": "Assumption: no evidence cited",
  "background-only": "Assumption: cited evidence establishes background facts, not this link",
  "direct-evidence": "Direct evidence at the cutoff; the link is still an inference",
};

export interface LinkAssessment {
  edge: ImpactEdge;
  status: LinkStatus;
  evidence: Array<ResolvedEvidence & { relevance: "direct" | "background" }>;
  /** Cited ids that do not resolve. They never count. */
  invalid: string[];
}

export function assessLink(edge: ImpactEdge, resolve: EvidenceResolver, asOfMs: number): LinkAssessment {
  const judged = edge.relevance && parseInstant(edge.relevance.at, "relevance.at") <= asOfMs;
  const direct = new Set(judged ? edge.relevance!.direct : []);
  const evidence = edge.evidence.map((id) => ({ ...resolve(id), relevance: direct.has(id) ? ("direct" as const) : ("background" as const) }));
  const counts = evidence.some((e) => e.exists && e.available && e.admissible && e.relevance === "direct");
  return {
    edge,
    status: edge.evidence.length === 0 ? "no-evidence" : counts ? "direct-evidence" : "background-only",
    evidence,
    invalid: evidence.filter((e) => !e.exists).map((e) => e.id),
  };
}

// ── Paths and direction ─────────────────────────────────────────────────────

export interface PathTrace {
  nodes: string[];
  /** Product of link signs: a qualitative scenario aid, not an estimate. */
  sign: Sign;
  links: LinkAssessment[];
  /** Every link has direct, admissible evidence at the cutoff. */
  evidenceBacked: boolean;
  /** Links that rest on an assumption (no evidence, or background only). */
  assumptions: number;
  weakest: "high" | "medium" | "low";
  horizons: Array<ImpactEdge["horizon"]>;
}

export type ScenarioDirection = "raises" | "lowers" | "mixed" | "none";

export interface MarketHypothesis {
  direction: "up" | "down" | null;
  /** "operating" hypotheses concern revenue, orders or earnings; only "price" ones meet a price window. */
  target: "price" | "operating";
  metric: string;
  horizon: string;
  /** For price hypotheses: the window the prediction is about. */
  windowLabel?: string;
}

export type ComparisonState = "no-data" | "not-assessable" | "not-comparable" | "inconclusive" | "aligned" | "review";

export const COMPARISON_LABEL: Record<ComparisonState, string> = {
  "no-data": "No measurement",
  "not-assessable": "Not assessable: no directional hypothesis specified",
  "not-comparable": "Not comparable: different metric or horizon",
  inconclusive: "Inconclusive: within noise",
  aligned: "Directionally aligned in this window; mechanism not established",
  review: "Moved against the hypothesis: review, not refutation",
};

export interface MarketComparison {
  state: ComparisonState;
  note: string;
}

export interface ObservedResponse {
  windowLabel: string;
  day0: string | null;
  benchmark: string | null;
  raw: number | null;
  abnormal: number | null;
  tStat: number | null;
  placeboShare: number | null;
  significant: boolean;
}

export interface CompanyImpact {
  nodeId: string;
  ticker: string | null;
  label: string;
  paths: PathTrace[];
  /** From evidence-backed paths only. */
  net: "positive" | "negative" | "ambiguous" | "unsupported";
  /** Signs over every proposed path, evidence or not: what the mechanisms would do if they held. */
  scenario: ScenarioDirection;
  hypothesis: MarketHypothesis;
  observed: ObservedResponse | null;
  comparison: MarketComparison;
}

const multiply = (a: Sign, b: Sign): Sign => (a === "±" || b === "±" ? "±" : a === b ? "+" : "-");
const RANK = { high: 2, medium: 1, low: 0 } as const;
const HORIZON_WORD = { near: "near", medium: "medium", long: "long" } as const;

/** All simple paths from the event node to `target` (graphs here are small DAGs). */
export function tracePaths(graph: ImpactGraph, target: string, resolve: EvidenceResolver, asOfMs: number, maxDepth = 8): PathTrace[] {
  const out: PathTrace[] = [];
  const outgoing = new Map<string, ImpactEdge[]>();
  for (const e of graph.edges) outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
  const walk = (node: string, path: string[], edges: ImpactEdge[]) => {
    if (path.length > maxDepth) return;
    if (node === target) {
      const links = edges.map((e) => assessLink(e, resolve, asOfMs));
      out.push({
        nodes: path,
        sign: edges.reduce<Sign>((s, e) => multiply(s, e.sign), "+"),
        links,
        evidenceBacked: links.every((l) => l.status === "direct-evidence"),
        assumptions: links.filter((l) => l.status !== "direct-evidence").length,
        weakest: edges.reduce<"high" | "medium" | "low">((w, e) => (RANK[e.confidence] < RANK[w] ? e.confidence : w), "high"),
        horizons: [...new Set(edges.map((e) => e.horizon))],
      });
      return;
    }
    for (const e of outgoing.get(node) ?? []) {
      if (path.includes(e.to)) continue;
      walk(e.to, [...path, e.to], [...edges, e]);
    }
  };
  walk(graph.eventNodeId, [graph.eventNodeId], []);
  return out;
}

export function netDirection(paths: PathTrace[]): CompanyImpact["net"] {
  const backed = paths.filter((p) => p.evidenceBacked);
  if (backed.length === 0) return "unsupported";
  const signs = new Set(backed.map((p) => p.sign));
  if (signs.size === 1 && signs.has("+")) return "positive";
  if (signs.size === 1 && signs.has("-")) return "negative";
  return "ambiguous";
}

export function scenarioDirection(paths: PathTrace[]): ScenarioDirection {
  if (paths.length === 0) return "none";
  const signs = new Set(paths.map((p) => p.sign));
  if (signs.size === 1 && signs.has("+")) return "raises";
  if (signs.size === 1 && signs.has("-")) return "lowers";
  return "mixed";
}

export function observedResponse(study: EventStudy | undefined, windowLabel = "[0,0]"): ObservedResponse | null {
  const w: WindowResult | undefined = study?.windows.find((x) => x.label === windowLabel);
  if (!study || !w) return null;
  return { windowLabel, day0: study.day0, benchmark: study.benchmark, raw: w.raw, abnormal: w.abnormal, tStat: w.tStat, placeboShare: w.placeboShare, significant: w.significant };
}

const signed = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

/**
 * Compare a hypothesis with a measured price response, keeping the two apart:
 *   - no direction → not assessable (absence of a prediction is not agreement);
 *   - an operating hypothesis, or a different window → not comparable;
 *   - a move within noise → inconclusive (not "no effect");
 *   - same direction → aligned in this window, mechanism not established;
 *   - opposite direction → a prompt to review, not a refutation.
 */
export function compareWithMarket(h: MarketHypothesis, study: EventStudy | undefined, windowLabel = "[0,0]"): MarketComparison {
  if (!h.direction) return { state: "not-assessable", note: "With no directional hypothesis, a price move can neither agree nor disagree with it." };
  if (h.target !== "price" || (h.windowLabel && h.windowLabel !== windowLabel)) {
    return { state: "not-comparable", note: `The hypothesis concerns ${h.metric} over the ${h.horizon} term; a ${windowLabel === "[0,0]" ? "one-day" : windowLabel} price move cannot confirm or disprove it.` };
  }
  const obs = observedResponse(study, windowLabel);
  if (!obs || obs.abnormal === null || obs.tStat === null) return { state: "no-data", note: "No measured response for this window." };
  const move = `Abnormal ${signed(obs.abnormal)} (t = ${obs.tStat.toFixed(1)}${obs.placeboShare === null ? "" : `; ${(obs.placeboShare * 100).toFixed(1)}% of the previous sessions moved as much`})`;
  if (!obs.significant) return { state: "inconclusive", note: `${move}: no statistically distinguishable move. This neither supports nor refutes the hypothesis.` };
  const agrees = (h.direction === "up") === obs.abnormal > 0;
  return agrees
    ? { state: "aligned", note: `${move}, in the predicted direction. A price move cannot show which mechanism produced it.` }
    : { state: "review", note: `${move}, against the hypothesis. A prompt to review: prices can reflect other information, prior expectations or a different horizon.` };
}

export function companyImpacts(graph: ImpactGraph, studies: Map<string, EventStudy>, resolve: EvidenceResolver, asOfMs: number, windowLabel = "[0,0]"): CompanyImpact[] {
  return graph.nodes
    .filter((n) => n.layer === "company")
    .map((n) => {
      const paths = tracePaths(graph, n.id, resolve, asOfMs);
      const net = netDirection(paths);
      const study = n.ticker ? studies.get(n.ticker) : undefined;
      const longest = paths.flatMap((p) => p.horizons).sort((a, b) => ["near", "medium", "long"].indexOf(b) - ["near", "medium", "long"].indexOf(a))[0] ?? "medium";
      const hypothesis: MarketHypothesis = {
        direction: net === "positive" ? "up" : net === "negative" ? "down" : null,
        target: "operating",
        metric: "revenue and earnings",
        horizon: HORIZON_WORD[longest],
      };
      return {
        nodeId: n.id,
        ticker: n.ticker ?? null,
        label: n.label,
        paths,
        net,
        scenario: scenarioDirection(paths),
        hypothesis,
        observed: observedResponse(study, windowLabel),
        comparison: compareWithMarket(hypothesis, study, windowLabel),
      };
    });
}

/** Structural checks: dangling edges, wrong layer order, causation called observed, relevance outside the citations. */
export function validateGraph(graph: ImpactGraph): string[] {
  const problems: string[] = [];
  const ids = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!ids.has(graph.eventNodeId)) problems.push(`event node ${graph.eventNodeId} missing`);
  for (const e of graph.edges) {
    const a = ids.get(e.from);
    const b = ids.get(e.to);
    if (!a || !b) {
      problems.push(`edge ${e.from}→${e.to} references a missing node`);
      continue;
    }
    if (LAYERS.indexOf(b.layer) < LAYERS.indexOf(a.layer)) problems.push(`edge ${e.from}→${e.to} runs backwards (${a.layer} → ${b.layer})`);
    if (e.epistemic === "OBSERVED_FACT") problems.push(`edge ${e.from}→${e.to}: a causal link is never an observed fact`);
    for (const id of e.relevance?.direct ?? []) if (!e.evidence.includes(id)) problems.push(`edge ${e.from}→${e.to}: relevance names ${id}, which the link does not cite`);
  }
  return problems;
}

// ── Exposure profiles ───────────────────────────────────────────────────────

export type ExposureLevel = "high" | "medium" | "low" | "none" | "unknown";

/** Business exposure, classified by an analyst from public descriptions. */
export const EXPOSURE_DIMENSIONS = [
  { key: "directRevenue", label: "Direct revenue" },
  { key: "supplyChain", label: "Indirect / supply chain" },
  { key: "costSensitivity", label: "Cost sensitivity" },
  { key: "geographic", label: "Geographic" },
] as const;

export type ExposureKey = (typeof EXPOSURE_DIMENSIONS)[number]["key"];

export interface ExposureCell {
  level: ExposureLevel;
  basis: string;
  epistemic: EpistemicClass;
  /** Has this been checked against the company's own filing? */
  verified: boolean;
}

export interface ExposureProfile {
  ticker: string;
  role: string;
  cells: Partial<Record<ExposureKey, ExposureCell>>;
}

export interface MeasuredExposure {
  forwardPE: number | null;
  evToRevenue: number | null;
  netDebtToMarketCap: number | null;
  beta: number | null;
  benchmark: string | null;
  momentum60: number | null;
  volumeRatio: number | null;
}

export type MetricKey = "forwardPE" | "evToSales" | "netDebtToMarketValue" | "marketSensitivity" | "momentum60" | "positioning";

export interface MeasuredMetric {
  key: MetricKey;
  label: string;
  value: number | null;
  /** "missing": the field is absent from the snapshot. "not-measured": no data for it is loaded at all. Neither is zero. */
  state: "measured" | "missing" | "not-measured";
  display: string;
  basis: string;
  epistemic: EpistemicClass;
}

const fin = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * Raw market and balance-sheet metrics, each with what it does and does not
 * measure. None is turned into a "high / medium / low" sensitivity: there is
 * no model here that maps a multiple or a beta onto exposure to this event,
 * and P/E and EV/sales are never converted into each other.
 */
export function measuredMetrics(m: MeasuredExposure): MeasuredMetric[] {
  const metric = (key: MetricKey, label: string, v: number | null, show: (x: number) => string, basis: string, epistemic: EpistemicClass, missing = "Not in the snapshot"): MeasuredMetric =>
    fin(v) ? { key, label, value: v, state: "measured", display: show(v), basis, epistemic } : { key, label, value: null, state: "missing", display: missing, basis, epistemic };
  return [
    metric("forwardPE", "Forward P/E", m.forwardPE, (x) => `${x.toFixed(1)}×`, "Vendor snapshot field (Yahoo quoteSummary); the earnings estimate behind it is the vendor's.", "MODEL_ESTIMATE"),
    metric("evToSales", "EV / sales", m.evToRevenue, (x) => `${x.toFixed(1)}×`, "Vendor snapshot field, trailing revenue. Shown as reported, not converted to a P/E.", "REPORTED_CLAIM"),
    metric(
      "netDebtToMarketValue",
      "Net debt ÷ market value",
      m.netDebtToMarketCap,
      (x) => `${(x * 100).toFixed(0)}%`,
      "(Total debt − cash) ÷ market capitalisation, vendor snapshot, at one date. Negative means net cash. It ignores debt maturities, interest cost, lease and off-balance-sheet obligations and cash-flow coverage, so it is not a full measure of financial risk.",
      "REPORTED_CLAIM",
      "Debt or cash not in the snapshot",
    ),
    metric(
      "marketSensitivity",
      "Market sensitivity (estimated beta)",
      m.beta,
      (x) => `β ${x.toFixed(2)}`,
      `Estimated slope of daily returns on ${m.benchmark ?? "the benchmark"} over 120 sessions ending ten before day 0. An estimate with sampling error; it measures co-movement with the benchmark, not sentiment or positioning.`,
      "MODEL_ESTIMATE",
      "Not enough history, or no benchmark",
    ),
    metric("momentum60", "60-session return before day 0", m.momentum60, (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(0)}%`, "Adjusted closes. A description of the recent move, not of who holds the stock.", "OBSERVED_FACT", "Not enough history"),
    {
      key: "positioning",
      label: "Positioning",
      value: null,
      state: "not-measured",
      display: "Not measured",
      basis: "No holdings, short-interest or fund-flow data are loaded. Beta and past returns do not measure how crowded a stock is.",
      epistemic: "UNKNOWN",
    },
  ];
}
