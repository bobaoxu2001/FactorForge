import type { BacktestResult } from "@/types/backtest";
import type { RadarCandidate } from "@/types/strategy";
import type { CorrelationCell } from "./portfolio";
import { pearson } from "./indicators";
import { attributeFactors, type FactorReturnsRow } from "./factorAttribution";

/**
 * Signal-concentration diagnostic.
 *
 * Motivation: a set of strategies can *look* diversified (different names, rules,
 * symbols) while actually being the same bet — e.g. four "different" strategies
 * that all fire on bank stocks are one factor exposure wearing four hats. This
 * module quantifies that overlap from the strategies' own daily P&L, so the
 * redundancy is measured, not eyeballed.
 *
 * Everything here is derived from real backtest equity curves and the shared
 * factor returns — no synthetic inputs.
 */

export type ConcentrationLevel = "low" | "medium" | "high";
export type FactorKey = "mkt" | "mom" | "vol";

export interface StrategyFactorRow {
  strategyId: string;
  strategyName: string;
  symbol: string;
  betas: { mkt: number; mom: number; vol: number };
  /** Factor with the largest |t-stat| — the strategy's dominant exposure. */
  dominantFactor: FactorKey;
  dominantTStat: number;
}

export interface PairCorrelation {
  aId: string;
  bId: string;
  aLabel: string;
  bLabel: string;
  correlation: number;
}

export interface SignalConcentrationReport {
  strategyCount: number;
  /** Pairwise daily-return correlation (reuses the portfolio CorrelationCell shape). */
  correlation: CorrelationCell[];
  /** Off-diagonal pairs keyed by strategy id, for joining back to radar candidates. */
  pairCorrelations: PairCorrelation[];
  averagePairwiseCorrelation: number;
  maxPair: { a: string; b: string; correlation: number } | null;
  /**
   * Effective number of independent strategies under an equal-average-correlation
   * approximation: N_eff = N / (1 + (N-1)·ρ̄). ρ̄=0 ⇒ N_eff=N (fully diversified);
   * ρ̄=1 ⇒ N_eff=1 (one bet in disguise). Clamped to [1, N].
   */
  effectiveStrategies: number;
  level: ConcentrationLevel;
  factorRows: StrategyFactorRow[];
  /** Set when a majority of strategies share the same dominant factor exposure. */
  sharedDominantFactor: { factor: FactorKey; count: number } | null;
  verdict: string;
}

const FACTOR_LABELS: Record<FactorKey, string> = { mkt: "Market", mom: "Momentum", vol: "Low-vol" };
export const factorLabel = (key: FactorKey) => FACTOR_LABELS[key];

/**
 * Effective number of independent bets under an equal-average-correlation
 * approximation: N_eff = N / (1 + (N-1)·ρ̄). ρ̄=0 ⇒ N_eff=N (fully diversified);
 * ρ̄→1 ⇒ N_eff→1 (one bet in disguise). Clamped to [1, N].
 *
 * Single source of truth shared by the radar concentration panel, the paper-
 * trading slot cap, and the portfolio diversification readout.
 */
export function effectiveBets(n: number, avgCorr: number): number {
  if (n <= 1) return Math.max(0, n);
  const rhoBar = Math.max(-1 / (n - 1) + 1e-6, Math.min(0.999, avgCorr));
  return Math.max(1, Math.min(n, n / (1 + (n - 1) * rhoBar)));
}

export function concentrationLevel(avgCorr: number): ConcentrationLevel {
  return avgCorr >= 0.6 ? "high" : avgCorr >= 0.3 ? "medium" : "low";
}

export function buildSignalConcentration(
  results: BacktestResult[],
  factorReturns: FactorReturnsRow[],
  benchmarkSymbol: string,
): SignalConcentrationReport | null {
  if (results.length < 2) return null;

  // Daily returns per strategy, keyed by date.
  const seriesByStrategy = results.map((r) => ({
    result: r,
    returns: dailyReturnMap(r),
  }));

  // Shared calendar = dates present in every strategy's return series.
  const calendar = intersectDates(seriesByStrategy.map((s) => [...s.returns.keys()]));
  if (calendar.length < 30) return null;

  const aligned = seriesByStrategy.map((s) => ({
    result: s.result,
    vec: calendar.map((d) => s.returns.get(d) ?? 0),
  }));

  // Pairwise correlation matrix.
  const correlation: CorrelationCell[] = [];
  const pairCorrelations: PairCorrelation[] = [];
  const offDiagonal: number[] = [];
  let maxPair: SignalConcentrationReport["maxPair"] = null;
  for (let i = 0; i < aligned.length; i += 1) {
    for (let j = 0; j < aligned.length; j += 1) {
      const corr = i === j ? 1 : pearson(aligned[i].vec, aligned[j].vec);
      correlation.push({
        rowSymbol: aligned[i].result.symbol,
        rowStrategy: aligned[i].result.strategyName,
        colSymbol: aligned[j].result.symbol,
        colStrategy: aligned[j].result.strategyName,
        correlation: corr,
      });
      if (j > i) {
        offDiagonal.push(corr);
        const aLabel = `${aligned[i].result.strategyName} · ${aligned[i].result.symbol}`;
        const bLabel = `${aligned[j].result.strategyName} · ${aligned[j].result.symbol}`;
        pairCorrelations.push({
          aId: aligned[i].result.strategyId,
          bId: aligned[j].result.strategyId,
          aLabel,
          bLabel,
          correlation: corr,
        });
        if (!maxPair || corr > maxPair.correlation) {
          maxPair = { a: aLabel, b: bLabel, correlation: corr };
        }
      }
    }
  }

  const avg = offDiagonal.length > 0 ? offDiagonal.reduce((s, v) => s + v, 0) / offDiagonal.length : 0;
  const n = aligned.length;
  const effective = effectiveBets(n, avg);
  const level = concentrationLevel(avg);

  // Per-strategy factor exposure (which factor each strategy really loads on).
  const factorRows: StrategyFactorRow[] = results
    .map((r) => {
      const attr = attributeFactors(r.equityCurve, factorReturns, benchmarkSymbol);
      if (!attr) return null;
      const candidates: Array<[FactorKey, number]> = [
        ["mkt", Math.abs(attr.tStats.mkt)],
        ["mom", Math.abs(attr.tStats.mom)],
        ["vol", Math.abs(attr.tStats.vol)],
      ];
      candidates.sort((a, b) => b[1] - a[1]);
      const [dominantFactor, dominantTStat] = candidates[0];
      return {
        strategyId: r.strategyId,
        strategyName: r.strategyName,
        symbol: r.symbol,
        betas: attr.betas,
        dominantFactor,
        dominantTStat,
      } satisfies StrategyFactorRow;
    })
    .filter((row): row is StrategyFactorRow => row !== null);

  // Do a majority of strategies share the same dominant factor?
  let sharedDominantFactor: SignalConcentrationReport["sharedDominantFactor"] = null;
  if (factorRows.length >= 2) {
    const counts = new Map<FactorKey, number>();
    factorRows.forEach((row) => counts.set(row.dominantFactor, (counts.get(row.dominantFactor) ?? 0) + 1));
    const [topFactor, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCount > factorRows.length / 2) sharedDominantFactor = { factor: topFactor, count: topCount };
  }

  return {
    strategyCount: n,
    correlation,
    pairCorrelations,
    averagePairwiseCorrelation: avg,
    maxPair,
    effectiveStrategies: effective,
    level,
    factorRows,
    sharedDominantFactor,
    verdict: buildVerdict(n, avg, effective, level, maxPair, sharedDominantFactor),
  };
}

function buildVerdict(
  n: number,
  avg: number,
  effective: number,
  level: ConcentrationLevel,
  maxPair: SignalConcentrationReport["maxPair"],
  shared: SignalConcentrationReport["sharedDominantFactor"],
): string {
  const effStr = effective.toFixed(1);
  if (level === "high") {
    const factorClause = shared
      ? ` and ${shared.count} of them load primarily on the ${factorLabel(shared.factor)} factor`
      : "";
    return `High overlap. Average pairwise correlation is ${(avg * 100).toFixed(0)}%${factorClause}: these ${n} strategies behave like roughly ${effStr} independent bets. Promoting more of them to paper trading concentrates risk rather than diversifying it.`;
  }
  if (level === "medium") {
    return `Moderate overlap. Average pairwise correlation is ${(avg * 100).toFixed(0)}%, so the ${n} strategies act like about ${effStr} independent bets. Prefer the highest-scoring strategy within each correlated cluster instead of running near-duplicates side by side.`;
  }
  const pairClause = maxPair && maxPair.correlation > 0.5
    ? ` Watch the most correlated pair (${maxPair.a} vs ${maxPair.b}, ${(maxPair.correlation * 100).toFixed(0)}%).`
    : "";
  return `Low overlap. Average pairwise correlation is ${(avg * 100).toFixed(0)}%; the ${n} strategies provide close to ${effStr} independent bets — a genuinely diversified set.${pairClause}`;
}

/**
 * Correlation threshold above which two candidates are treated as the same bet.
 * Deliberately high (0.8) so only genuine near-duplicates are gated — moderate
 * co-movement is normal for long-only equity strategies and shouldn't be punished.
 */
export const CONCENTRATION_GATE_THRESHOLD = 0.8;

/**
 * Concentration gate: walk radar candidates in rank order and demote any
 * "radar candidate" that is a near-duplicate (correlation > threshold) of an
 * already-kept, higher-ranked candidate. This stops the radar from promoting
 * four versions of the same bet just because each scores well on its own.
 *
 * Returns a new array (inputs are not mutated). Rank/score are preserved; only
 * status, reasons, nextAction and the `redundancy` annotation change.
 */
export function applyConcentrationGate(
  candidates: RadarCandidate[],
  report: SignalConcentrationReport | null,
  threshold = CONCENTRATION_GATE_THRESHOLD,
): RadarCandidate[] {
  if (!report || report.pairCorrelations.length === 0) return candidates;

  // Fast lookup: max correlation between any two strategy ids.
  const corrBetween = new Map<string, number>();
  const key = (a: string, b: string) => [a, b].sort().join("|");
  report.pairCorrelations.forEach((p) => corrBetween.set(key(p.aId, p.bId), p.correlation));

  const keptCandidateIds: string[] = [];
  const ordered = [...candidates].sort((a, b) => a.rank - b.rank);
  const annotated = new Map<string, RadarCandidate>();

  for (const candidate of ordered) {
    if (candidate.status !== "radar candidate") {
      annotated.set(candidate.result.strategyId, candidate);
      continue;
    }
    // Compare against already-kept (higher-ranked) radar candidates.
    let twinId: string | null = null;
    let twinCorr = 0;
    for (const keptId of keptCandidateIds) {
      const corr = corrBetween.get(key(candidate.result.strategyId, keptId)) ?? 0;
      if (corr > twinCorr) {
        twinCorr = corr;
        twinId = keptId;
      }
    }

    if (twinId && twinCorr > threshold) {
      const twinLabel = labelFor(candidates, twinId);
      annotated.set(candidate.result.strategyId, {
        ...candidate,
        status: "continue observing",
        redundancy: { correlatedWith: twinLabel, correlation: twinCorr, demoted: true },
        reasons: [
          ...candidate.reasons,
          `Near-duplicate of ${twinLabel} (${(twinCorr * 100).toFixed(0)}% return correlation) — observe the stronger one instead`,
        ],
        nextAction: `Hold: redundant with ${twinLabel}. Diversify before promoting.`,
      });
    } else {
      keptCandidateIds.push(candidate.result.strategyId);
      annotated.set(candidate.result.strategyId, candidate);
    }
  }

  // Preserve original ordering of the input array.
  return candidates.map((c) => annotated.get(c.result.strategyId) ?? c);
}

function labelFor(candidates: RadarCandidate[], id: string): string {
  const c = candidates.find((x) => x.result.strategyId === id);
  return c ? `${c.result.strategyName} · ${c.result.symbol}` : id;
}

// --- local math helpers (kept independent of portfolio internals) ---

function dailyReturnMap(result: BacktestResult): Map<string, number> {
  const map = new Map<string, number>();
  const curve = result.equityCurve;
  for (let i = 1; i < curve.length; i += 1) {
    const prev = curve[i - 1].equity;
    const today = curve[i].equity;
    if (prev > 0 && Number.isFinite(prev) && Number.isFinite(today)) {
      map.set(curve[i].date, today / prev - 1);
    }
  }
  return map;
}

function intersectDates(seriesList: string[][]): string[] {
  if (seriesList.length === 0) return [];
  const sorted = [...seriesList].sort((a, b) => a.length - b.length);
  const shortest = sorted[0];
  const others = sorted.slice(1).map((list) => new Set(list));
  return shortest.filter((date) => others.every((set) => set.has(date))).sort();
}

export const __testing = { intersectDates, pearson, dailyReturnMap };
