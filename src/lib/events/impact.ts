import type { EventStudy } from "./market";
import type { EpistemicClass } from "./types";

/**
 * Causal impact map: event → mechanism → industry → company → expectations →
 * valuation / risk premium → possible price response.
 *
 * Every edge carries a sign, the mechanism in words, what kind of statement it
 * is, and the evidence behind it. A company's direction is never hard-coded;
 * it is the product of signs along each path from the event. Paths that
 * disagree make the net direction "ambiguous", which is the honest answer when
 * a restriction can both delay demand and raise the value of scarce capacity.
 *
 * Two guards:
 *   - Paths resting only on hypotheses (no evidence ids) are shown, but do not
 *     count toward the net direction.
 *   - The map's direction never overrides the measured market reaction. When a
 *     statistically clear abnormal return points the other way, the company is
 *     flagged "contradicted by market data" instead of being re-explained.
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

export interface ImpactEdge {
  from: string;
  to: string;
  sign: Sign;
  mechanism: string;
  epistemic: EpistemicClass;
  /** Claim ids or market-check ids. Empty means a hypothesis without evidence yet. */
  evidence: string[];
  confidence: "high" | "medium" | "low";
  horizon: "near" | "medium" | "long";
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

export interface PathTrace {
  nodes: string[];
  sign: "+" | "-" | "±";
  supported: boolean;
  weakest: "high" | "medium" | "low";
  horizons: Array<ImpactEdge["horizon"]>;
}

export interface CompanyImpact {
  nodeId: string;
  ticker: string | null;
  label: string;
  paths: PathTrace[];
  /** From evidence-backed paths only. */
  net: "positive" | "negative" | "ambiguous" | "unsupported";
  marketCheck: "consistent" | "contradicted" | "not-significant" | "no-data";
  marketNote: string;
}

const multiply = (a: Sign, b: Sign): Sign => (a === "±" || b === "±" ? "±" : a === b ? "+" : "-");
const RANK = { high: 2, medium: 1, low: 0 } as const;

/** All simple paths from the event node to `target` (graphs here are small DAGs). */
export function tracePaths(graph: ImpactGraph, target: string, maxDepth = 8): PathTrace[] {
  const out: PathTrace[] = [];
  const outgoing = new Map<string, ImpactEdge[]>();
  for (const e of graph.edges) outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
  const walk = (node: string, path: string[], edges: ImpactEdge[]) => {
    if (path.length > maxDepth) return;
    if (node === target) {
      out.push({
        nodes: path,
        sign: edges.reduce<Sign>((s, e) => multiply(s, e.sign), "+"),
        supported: edges.every((e) => e.evidence.length > 0),
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
  const supported = paths.filter((p) => p.supported);
  if (supported.length === 0) return "unsupported";
  const signs = new Set(supported.map((p) => p.sign));
  if (signs.size === 1 && signs.has("+")) return "positive";
  if (signs.size === 1 && signs.has("-")) return "negative";
  return "ambiguous";
}

/** Compare the map's net direction with a measured abnormal return; data wins. */
export function reconcileWithMarket(net: CompanyImpact["net"], study: EventStudy | undefined, windowLabel = "[0,0]"): Pick<CompanyImpact, "marketCheck" | "marketNote"> {
  const w = study?.windows.find((x) => x.label === windowLabel);
  if (!w || w.abnormal === null || w.tStat === null) return { marketCheck: "no-data", marketNote: "No measured reaction for this window." };
  const pct = `${w.abnormal >= 0 ? "+" : ""}${(w.abnormal * 100).toFixed(1)}%`;
  if (Math.abs(w.tStat) < 1.96) return { marketCheck: "not-significant", marketNote: `Abnormal ${pct} (t = ${w.tStat.toFixed(1)}) is within normal noise.` };
  if (net === "ambiguous" || net === "unsupported") return { marketCheck: "consistent", marketNote: `Abnormal ${pct} (t = ${w.tStat.toFixed(1)}); the map takes no net side, so the data cannot contradict it.` };
  const agrees = (net === "positive") === w.abnormal > 0;
  return agrees
    ? { marketCheck: "consistent", marketNote: `Abnormal ${pct} (t = ${w.tStat.toFixed(1)}) points the same way as the map.` }
    : { marketCheck: "contradicted", marketNote: `Abnormal ${pct} (t = ${w.tStat.toFixed(1)}) points against the map. The map does not override the data; revisit the mechanism.` };
}

export function companyImpacts(graph: ImpactGraph, studies: Map<string, EventStudy>, windowLabel = "[0,0]"): CompanyImpact[] {
  return graph.nodes
    .filter((n) => n.layer === "company")
    .map((n) => {
      const paths = tracePaths(graph, n.id);
      const net = netDirection(paths);
      const study = n.ticker ? studies.get(n.ticker) : undefined;
      return { nodeId: n.id, ticker: n.ticker ?? null, label: n.label, paths, net, ...reconcileWithMarket(net, study, windowLabel) };
    });
}

/** Structural checks: dangling edges, wrong layer order, cycles through the event node. */
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
  }
  return problems;
}

// ── Exposure profiles ───────────────────────────────────────────────────────

export type ExposureLevel = "high" | "medium" | "low" | "none" | "unknown";

export const EXPOSURE_DIMENSIONS = [
  { key: "directRevenue", label: "Direct revenue" },
  { key: "supplyChain", label: "Indirect / supply chain" },
  { key: "costSensitivity", label: "Cost sensitivity" },
  { key: "geographic", label: "Geographic" },
  { key: "valuation", label: "Valuation sensitivity" },
  { key: "leverage", label: "Financial leverage" },
  { key: "sentiment", label: "Sentiment / positioning" },
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
  momentum60: number | null;
  volumeRatio: number | null;
}

const level3 = (v: number | null, lo: number, hi: number): ExposureLevel => (v === null || !Number.isFinite(v) ? "unknown" : v >= hi ? "high" : v >= lo ? "medium" : "low");

/** Dimensions measured from data rather than classified by an analyst. */
export function measuredCells(m: MeasuredExposure): Partial<Record<ExposureKey, ExposureCell>> {
  return {
    valuation: {
      level: level3(m.forwardPE ?? (m.evToRevenue !== null ? m.evToRevenue * 4 : null), 20, 35),
      basis: m.forwardPE !== null ? `Forward P/E ${m.forwardPE.toFixed(1)}× (vendor snapshot). Higher multiples move more when long-run growth expectations change.` : m.evToRevenue !== null ? `EV/sales ${m.evToRevenue.toFixed(1)}× (vendor snapshot); no forward P/E.` : "No valuation fields in the snapshot.",
      epistemic: "MODEL_ESTIMATE",
      verified: false,
    },
    leverage: {
      level: m.netDebtToMarketCap === null ? "unknown" : m.netDebtToMarketCap > 0.3 ? "high" : m.netDebtToMarketCap > 0.1 ? "medium" : "low",
      basis: m.netDebtToMarketCap === null ? "Debt or cash missing from the snapshot." : `Net debt ${(m.netDebtToMarketCap * 100).toFixed(0)}% of market value (vendor snapshot; negative means net cash).`,
      epistemic: "MODEL_ESTIMATE",
      verified: false,
    },
    sentiment: {
      level: level3(m.beta === null ? null : Math.abs(m.beta), 1.1, 1.6),
      basis:
        m.beta === null
          ? "Not enough history for a beta."
          : `Beta ${m.beta.toFixed(2)} to its benchmark before the event; 60-day return ${m.momentum60 === null ? "n/a" : `${(m.momentum60 * 100).toFixed(0)}%`}${m.volumeRatio ? `; day-0 volume ${m.volumeRatio.toFixed(1)}× its 20-day average` : ""}. Crowded, high-beta names move most on sentiment.`,
      epistemic: "OBSERVED_FACT",
      verified: true,
    },
  };
}
