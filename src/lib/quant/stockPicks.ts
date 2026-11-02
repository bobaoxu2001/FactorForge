import type { FactorSnapshot } from "@/types/market";
import type { StressTone } from "@/lib/quant/marketStress";
import type { SignalConsensusReport } from "@/lib/quant/signalConsensus";
import type { FundamentalSnapshot, FundamentalsMap } from "@/lib/data/fundamentals";
import { constituentOf, type Sector } from "@/data/watchlist";

/**
 * Cross-sectional stock selection — "which universe names look most promising
 * right now, and why". Same contract as every other engine in the lab:
 *
 *  - Every score is deterministic and computed here, from the same factor
 *    snapshots, consensus grid, and stress regime the rest of the platform
 *    already shows. The optional LLM layer (stockPickNote) writes prose ON TOP
 *    of this report and never changes a number.
 *  - Evidence spans technicals (momentum, trend, volatility, volume,
 *    multi-strategy confirmation) AND fundamentals (valuation multiples,
 *    profitability, growth) when a fundamentals map is provided. Value and
 *    quality are CROSS-SECTIONAL percentiles vs the universe — cheap/profitable
 *    relative to peers — never an intrinsic-value appraisal or price target.
 *    Names without fundamentals score neutral there, with a visible caveat.
 *  - Benchmarks (SPY/QQQ) are excluded: an index ETF is a measuring stick,
 *    not a pick.
 */

export type PickTier = "prime watch" | "constructive" | "monitor";

export type PickComponentKey =
  | "momentum"
  | "trend"
  | "stability"
  | "overheat"
  | "volume"
  | "evidence"
  | "value"
  | "quality";

export interface PickComponent {
  key: PickComponentKey;
  label: string;
  /** 0–100, cross-sectional where applicable. */
  score: number;
  /** Regime-dependent weight; all six weights sum to 1. */
  weight: number;
  /** Plain-English one-liner of what the score is based on. */
  detail: string;
}

export interface StockPick {
  symbol: string;
  name: string;
  sector: Sector;
  rank: number;
  /** Weighted blend of the six components, 0–100. */
  compositeScore: number;
  tier: PickTier;
  components: PickComponent[];
  /** How many independent strategies currently hold this name. */
  heldByStrategies: number;
  strategyTypes: string[];
  isFallbackData: boolean;
  caveats: string[];
  /** Valuation/quality snapshot backing the value + quality components, if available. */
  fundamentals: FundamentalSnapshot | null;
}

export interface StockPickReport {
  asOf: string;
  regime: StressTone;
  /** Why the weights look the way they do under this regime. */
  regimeNote: string;
  weights: Record<PickComponentKey, number>;
  /** Ranked picks, best first. Stocks only — never benchmark ETFs. */
  picks: StockPick[];
  coverage: {
    scanned: number;
    scored: number;
    excluded: number;
    realData: number;
    fallbackData: number;
    /** Scored names with a fundamentals row backing value/quality. */
    withFundamentals: number;
  };
  /** Provenance of the fundamentals tier: live, committed snapshot, mixed, or absent. */
  fundamentalsSource: "yahoo" | "snapshot" | "mixed" | "none";
  /** Most recent as-of date across the fundamentals rows, if any. */
  fundamentalsAsOf: string | null;
  verdict: string;
  methodology: string[];
}

export interface StockPickInputs {
  factors: FactorSnapshot[];
  consensus: SignalConsensusReport;
  regime: { regime: StressTone; stressScore: number };
  generatedAt: string;
  /** Valuation/quality fundamentals by symbol; names missing here score neutral on value/quality. */
  fundamentals?: FundamentalsMap;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/**
 * Regime-adaptive weights. In a stable tape, cross-sectional momentum carries
 * the most information; under stress, low realized volatility and independent
 * strategy confirmation matter more than chasing what ran. Each row sums to 1.
 */
const REGIME_WEIGHTS: Record<StressTone, Record<PickComponentKey, number>> = {
  stable: { momentum: 0.24, trend: 0.16, stability: 0.08, overheat: 0.08, volume: 0.08, evidence: 0.16, value: 0.1, quality: 0.1 },
  caution: { momentum: 0.18, trend: 0.16, stability: 0.14, overheat: 0.1, volume: 0.06, evidence: 0.16, value: 0.1, quality: 0.1 },
  stress: { momentum: 0.1, trend: 0.14, stability: 0.24, overheat: 0.1, volume: 0.06, evidence: 0.16, value: 0.1, quality: 0.1 },
};

const REGIME_NOTES: Record<StressTone, string> = {
  stable: "Stable regime — momentum and trend carry the most weight; strength is rewarded.",
  caution: "Caution regime — weights shift toward realized stability while momentum still counts.",
  stress: "Stress regime — low volatility is weighted heaviest; chasing recent winners is de-emphasized.",
};

/**
 * Percentile rank (0–100) of `value` within `values` (average rank for ties).
 * A single-element universe scores 50 — no cross-section, no information.
 */
export function percentileRank(value: number, values: number[]): number {
  if (values.length <= 1) return 50;
  let below = 0;
  let equal = 0;
  for (const other of values) {
    if (other < value) below += 1;
    else if (other === value) equal += 1;
  }
  return ((below + (equal - 1) / 2) / (values.length - 1)) * 100;
}

interface ScoredSnapshot {
  snapshot: FactorSnapshot;
  momentum20d: number;
  momentum60d: number;
  volatility20d: number;
  rsi14: number;
}

export function buildStockPicks(inputs: StockPickInputs): StockPickReport {
  const { factors, consensus, regime, generatedAt, fundamentals = {} } = inputs;
  const weights = REGIME_WEIGHTS[regime.regime];

  // Only single-name stocks with a complete factor row enter the cross-section.
  const stockSnapshots = factors.filter((f) => constituentOf(f.symbol)?.kind === "stock");
  const scored: ScoredSnapshot[] = stockSnapshots
    .filter(
      (f) =>
        f.momentum20d !== null && f.momentum60d !== null && f.volatility20d !== null && f.rsi14 !== null,
    )
    .map((f) => ({
      snapshot: f,
      momentum20d: f.momentum20d as number,
      momentum60d: f.momentum60d as number,
      volatility20d: f.volatility20d as number,
      rsi14: f.rsi14 as number,
    }));

  const mom60s = scored.map((s) => s.momentum60d);
  const vols = scored.map((s) => s.volatility20d);
  const consensusBySymbol = new Map(consensus.picks.map((pick) => [pick.symbol, pick]));
  const fundamentalsCross = buildFundamentalCrossSection(
    scored.map((s) => fundamentals[s.snapshot.symbol]).filter((f): f is FundamentalSnapshot => Boolean(f)),
  );

  const picks = scored
    .map((s) => buildPick(s, { weights, mom60s, vols, consensusBySymbol, fundamentals, fundamentalsCross }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((pick, index) => ({ ...pick, rank: index + 1 }));

  const fallbackCount = scored.filter((s) => s.snapshot.isFallback).length;
  const fundamentalRows = picks.map((p) => p.fundamentals).filter((f): f is FundamentalSnapshot => Boolean(f));
  const fundamentalSources = new Set(fundamentalRows.map((f) => f.source));
  const fundamentalsSource: StockPickReport["fundamentalsSource"] =
    fundamentalRows.length === 0
      ? "none"
      : fundamentalSources.size > 1
        ? "mixed"
        : (fundamentalRows[0].source as "yahoo" | "snapshot");
  const fundamentalsAsOf = fundamentalRows.reduce<string | null>(
    (latest, f) => (latest === null || f.asOf > latest ? f.asOf : latest),
    null,
  );

  return {
    asOf: generatedAt,
    regime: regime.regime,
    regimeNote: REGIME_NOTES[regime.regime],
    weights,
    picks,
    coverage: {
      scanned: stockSnapshots.length,
      scored: scored.length,
      excluded: stockSnapshots.length - scored.length,
      realData: scored.length - fallbackCount,
      fallbackData: fallbackCount,
      withFundamentals: fundamentalRows.length,
    },
    fundamentalsSource,
    fundamentalsAsOf,
    verdict: buildVerdict(picks, regime.regime),
    methodology: [
      "Scores are deterministic and computed from the same factor snapshots, consensus grid, and stress regime shown elsewhere in the lab — the AI note is prose on top and never changes a number.",
      "Evidence blends technicals (momentum, trend, volatility, volume, multi-strategy confirmation) with fundamentals (earnings/book/EBITDA yields for value; ROE, margins, and earnings growth for quality). Value and quality are cross-sectional percentiles vs the universe — never an intrinsic-value appraisal or price target.",
      "Fundamentals come from the Yahoo quoteSummary API, falling back to a committed, dated snapshot — the source and as-of date are always shown. Names without fundamentals score neutral on value/quality with a visible caveat.",
      "Component weights adapt to the market-stress regime: stress shifts weight from momentum to realized stability.",
      "Benchmark ETFs (SPY/QQQ) are excluded — they are measuring sticks, not picks.",
      "A name on labeled fallback/demo data is capped at the monitor tier regardless of score.",
      "High cross-sectional rank is not a return forecast and none of this is investment advice.",
    ],
  };
}

/**
 * Yield-style transforms of the valuation multiples (1/PE, 1/PB, 1/EV-EBITDA)
 * so "higher is cheaper" and negative-earnings names simply drop out of the
 * cross-section instead of scoring as absurdly cheap.
 */
interface FundamentalCrossSection {
  earningsYield: number[];
  bookYield: number[];
  ebitdaYield: number[];
  roe: number[];
  opMargin: number[];
  earningsGrowth: number[];
}

const yieldOf = (multiple: number | null): number | null =>
  multiple !== null && multiple > 0 ? 1 / multiple : null;
const marginOf = (f: FundamentalSnapshot): number | null => f.operatingMargin ?? f.profitMargin;

function buildFundamentalCrossSection(rows: FundamentalSnapshot[]): FundamentalCrossSection {
  const collect = (pick: (f: FundamentalSnapshot) => number | null) =>
    rows.map(pick).filter((v): v is number => v !== null);
  return {
    earningsYield: collect((f) => yieldOf(f.trailingPE)),
    bookYield: collect((f) => yieldOf(f.priceToBook)),
    ebitdaYield: collect((f) => yieldOf(f.evToEbitda)),
    roe: collect((f) => f.returnOnEquity),
    opMargin: collect(marginOf),
    earningsGrowth: collect((f) => f.earningsGrowthYoY),
  };
}

/** Average of the available metric percentiles; null when nothing is available. */
function averagePercentile(pairs: Array<[number | null, number[]]>): number | null {
  const scores = pairs
    .filter((pair): pair is [number, number[]] => pair[0] !== null && pair[1].length > 0)
    .map(([value, values]) => percentileRank(value, values));
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function valueScoreOf(f: FundamentalSnapshot | undefined, cross: FundamentalCrossSection): number | null {
  if (!f) return null;
  return averagePercentile([
    [yieldOf(f.trailingPE), cross.earningsYield],
    [yieldOf(f.priceToBook), cross.bookYield],
    [yieldOf(f.evToEbitda), cross.ebitdaYield],
  ]);
}

export function qualityScoreOf(f: FundamentalSnapshot | undefined, cross: FundamentalCrossSection): number | null {
  if (!f) return null;
  return averagePercentile([
    [f.returnOnEquity, cross.roe],
    [marginOf(f), cross.opMargin],
    [f.earningsGrowthYoY, cross.earningsGrowth],
  ]);
}

function buildPick(
  s: ScoredSnapshot,
  ctx: {
    weights: Record<PickComponentKey, number>;
    mom60s: number[];
    vols: number[];
    consensusBySymbol: Map<string, { agreeCount: number; strategyTypes: string[] }>;
    fundamentals: FundamentalsMap;
    fundamentalsCross: FundamentalCrossSection;
  },
): StockPick {
  const { snapshot } = s;
  const constituent = constituentOf(snapshot.symbol);
  const consensusPick = ctx.consensusBySymbol.get(snapshot.symbol);
  const heldBy = consensusPick?.agreeCount ?? 0;
  const fundamental = ctx.fundamentals[snapshot.symbol];
  const valueScore = valueScoreOf(fundamental, ctx.fundamentalsCross);
  const qualityScore = qualityScoreOf(fundamental, ctx.fundamentalsCross);

  const momentumScore = percentileRank(s.momentum60d, ctx.mom60s);
  const trendScore = snapshot.aboveSma200 ? 100 : 0;
  const stabilityScore = 100 - percentileRank(s.volatility20d, ctx.vols);
  const overheatScore = rsiBalanceScore(s.rsi14);
  const volumeScore = volumeConfirmationScore(snapshot.volumeSurge);
  const evidenceScore = heldBy >= 3 ? 100 : heldBy === 2 ? 80 : heldBy === 1 ? 50 : 0;

  const components: PickComponent[] = [
    {
      key: "momentum",
      label: "Momentum",
      score: momentumScore,
      weight: ctx.weights.momentum,
      detail: `60-day return ${fmtPct(s.momentum60d)} — cross-sectional percentile vs the universe.`,
    },
    {
      key: "trend",
      label: "Trend",
      score: trendScore,
      weight: ctx.weights.trend,
      detail: snapshot.aboveSma200 ? "Trading above its 200-day average." : "Trading below its 200-day average.",
    },
    {
      key: "stability",
      label: "Stability",
      score: stabilityScore,
      weight: ctx.weights.stability,
      detail: `20-day realized volatility ${fmtPct(s.volatility20d)} — lower than peers scores higher.`,
    },
    {
      key: "overheat",
      label: "Overheat guard",
      score: overheatScore,
      weight: ctx.weights.overheat,
      detail: `RSI(14) at ${s.rsi14.toFixed(0)} — rewards the constructive band, penalizes chase and washout extremes.`,
    },
    {
      key: "volume",
      label: "Volume confirmation",
      score: volumeScore,
      weight: ctx.weights.volume,
      detail:
        snapshot.volumeSurge !== null
          ? `Latest volume at ${snapshot.volumeSurge.toFixed(2)}× its 20-day average.`
          : "No volume-average baseline available.",
    },
    {
      key: "evidence",
      label: "Strategy evidence",
      score: evidenceScore,
      weight: ctx.weights.evidence,
      detail:
        heldBy > 0
          ? `Currently held by ${heldBy} independent ${heldBy === 1 ? "strategy" : "strategies"} (${(consensusPick?.strategyTypes ?? []).join(", ")}).`
          : "No catalog strategy currently holds this name.",
    },
    {
      key: "value",
      label: "Value",
      score: valueScore ?? 50,
      weight: ctx.weights.value,
      detail:
        valueScore !== null && fundamental
          ? `Cheapness vs peers across earnings/book/EBITDA yields${fundamental.trailingPE !== null ? ` (trailing P/E ${fundamental.trailingPE.toFixed(1)})` : ""}.`
          : "No valuation data — scored neutral.",
    },
    {
      key: "quality",
      label: "Quality",
      score: qualityScore ?? 50,
      weight: ctx.weights.quality,
      detail:
        qualityScore !== null && fundamental
          ? `Profitability and growth vs peers${describeQuality(fundamental)}.`
          : "No profitability data — scored neutral.",
    },
  ];

  const compositeScore = Math.round(
    components.reduce((sum, component) => sum + component.score * component.weight, 0),
  );

  const caveats = buildCaveats(s, heldBy, ctx.vols, fundamental, valueScore);
  const tier: PickTier = snapshot.isFallback
    ? "monitor"
    : compositeScore >= 70
      ? "prime watch"
      : compositeScore >= 55
        ? "constructive"
        : "monitor";

  return {
    symbol: snapshot.symbol,
    name: constituent?.name ?? snapshot.symbol,
    sector: constituent?.sector ?? "Broad Market",
    rank: 0,
    compositeScore,
    tier,
    components,
    heldByStrategies: heldBy,
    strategyTypes: consensusPick?.strategyTypes ?? [],
    isFallbackData: snapshot.isFallback,
    caveats,
    fundamentals: fundamental ?? null,
  };
}

/**
 * RSI balance: full marks inside the constructive 40–70 band, linear penalty
 * outside it. An RSI of 85 (chase risk) or 20 (falling knife) scores low even
 * if momentum looks great — "promising" should not mean "already vertical".
 */
export function rsiBalanceScore(rsi: number): number {
  if (rsi >= 40 && rsi <= 70) return 100;
  const distance = rsi < 40 ? 40 - rsi : rsi - 70;
  return clamp(100 - distance * 4);
}

function describeQuality(f: FundamentalSnapshot): string {
  const parts: string[] = [];
  if (f.returnOnEquity !== null) parts.push(`ROE ${(f.returnOnEquity * 100).toFixed(0)}%`);
  const margin = marginOf(f);
  if (margin !== null) parts.push(`op margin ${(margin * 100).toFixed(0)}%`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function volumeConfirmationScore(volumeSurge: number | null): number {
  if (volumeSurge === null || !Number.isFinite(volumeSurge)) return 50;
  return clamp(volumeSurge * 50);
}

function buildCaveats(
  s: ScoredSnapshot,
  heldBy: number,
  vols: number[],
  fundamental: FundamentalSnapshot | undefined,
  valueScore: number | null,
): string[] {
  const caveats: string[] = [];
  if (s.snapshot.isFallback) caveats.push("Built on labeled fallback/demo data — treat every number as illustrative.");
  if (!s.snapshot.aboveSma200) caveats.push("Below its 200-day average — the long-term trend has not confirmed.");
  if (s.rsi14 > 75) caveats.push(`RSI(14) at ${s.rsi14.toFixed(0)} — short-term overbought, entry chase risk.`);
  if (s.rsi14 < 30) caveats.push(`RSI(14) at ${s.rsi14.toFixed(0)} — washout territory, wait for stabilization.`);
  if (heldBy === 0) caveats.push("No independent strategy confirmation yet.");
  if (percentileRank(s.volatility20d, vols) > 75)
    caveats.push("Top-quartile realized volatility — position sizing matters more here.");
  if (!fundamental) caveats.push("No fundamentals available — value and quality scored neutral.");
  else {
    if (fundamental.trailingPE !== null && fundamental.trailingPE <= 0)
      caveats.push("Negative trailing earnings — the P/E multiple is not meaningful.");
    if (fundamental.source === "snapshot")
      caveats.push(`Fundamentals from the committed snapshot (as of ${fundamental.asOf}), not live.`);
    if (valueScore !== null && valueScore < 25)
      caveats.push("Rich valuation vs peers — the technical rank is paying up for it.");
  }
  return caveats;
}

function buildVerdict(picks: StockPick[], regime: StressTone): string {
  if (picks.length === 0) {
    return "No universe name has a complete factor row to score — check the data page for provider coverage.";
  }
  const top = picks[0];
  const prime = picks.filter((pick) => pick.tier === "prime watch").length;
  const primeClause =
    prime === 0
      ? "no name clears the prime-watch bar"
      : `${prime} ${prime === 1 ? "name clears" : "names clear"} the prime-watch bar`;
  return (
    `Under the ${regime} regime, ${primeClause}; ${top.symbol} (${top.name}) ranks first at ${top.compositeScore}/100. ` +
    "Relative evidence only — not a return forecast, not investment advice."
  );
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}
