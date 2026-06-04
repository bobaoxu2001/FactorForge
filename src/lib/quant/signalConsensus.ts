import type { BacktestResult } from "@/types/backtest";

/**
 * Multi-strategy consensus ("signal resonance").
 *
 * The platform runs several *structurally different* strategies (breakout,
 * mean-reversion, momentum, rotation) across the whole universe. This module
 * pivots that strategy×symbol grid into a per-symbol view and answers the core
 * question: which names are being selected by more than one independent
 * strategy *right now*?
 *
 * The quant point is independent confirmation. One strategy liking a name is a
 * signal; three strategies of three different *types* liking the same name is a
 * far stronger, less style-dependent read. So agreement is ranked first by how
 * many strategies hold the name and then by how many distinct strategy *types*
 * those are — a breakout + a mean-reversion agreeing is worth more than two
 * breakouts agreeing.
 *
 * Honesty note: "holds" means the backtest's simulated position on that symbol
 * is currently long. No broker, no live order — this is a research overlay.
 */

/** One strategy's run on a single symbol, with its showcase score. */
export interface StrategyRun {
  strategyId: string;
  strategyName: string;
  type: string;
  score: number;
  result: BacktestResult;
}

/** All of one strategy's runs across the scanned universe. */
export interface StrategyScan {
  strategyId: string;
  strategyName: string;
  type: string;
  runs: StrategyRun[];
}

export interface ConsensusLeg {
  strategyId: string;
  strategyName: string;
  type: string;
  score: number;
  /** Latest signal on this symbol, e.g. "2026-06-01 · buy · reclaimed EMA20". */
  recentSignal: string;
}

export interface ConsensusPick {
  symbol: string;
  /** How many distinct strategies currently hold this symbol. */
  agreeCount: number;
  /** Distinct strategy types among the agreeing legs (independence of the read). */
  strategyTypes: string[];
  legs: ConsensusLeg[];
  /** Average showcase score of the agreeing legs. */
  averageScore: number;
  /** True when two or more strategies agree — the "resonance" tier. */
  resonance: boolean;
}

export interface SignalConsensusReport {
  asOf: string;
  /** Number of strategies scanned. */
  strategyCount: number;
  /** Number of symbols scanned (universe breadth). */
  symbolsScanned: number;
  /** All picks held by at least one strategy, resonance first. */
  picks: ConsensusPick[];
  /** Picks where two or more strategies agree. */
  consensusCount: number;
  /** Strongest agreement, or null when nothing is held. */
  topPick: ConsensusPick | null;
  /** Deterministic one-line read of the consensus state. */
  verdict: string;
}

/** A strategy "holds" a symbol when its simulated position there is currently long. */
function isHeld(result: BacktestResult): boolean {
  return result.metrics.currentPosition === "long";
}

function describeSignal(result: BacktestResult): string {
  const last = result.signals[result.signals.length - 1];
  if (!last) return "currently long; no recent discrete signal";
  return `${last.date} · ${last.type} · ${last.reason}`;
}

export function buildSignalConsensus(scans: StrategyScan[]): SignalConsensusReport {
  const symbolsScanned = new Set<string>();
  let latestDate = "";

  // symbol -> agreeing legs
  const bySymbol = new Map<string, ConsensusLeg[]>();

  for (const scan of scans) {
    for (const run of scan.runs) {
      const symbol = run.result.symbol;
      symbolsScanned.add(symbol);
      const lastDate = run.result.metrics.lastSignalDate;
      if (lastDate && lastDate > latestDate) latestDate = lastDate;

      if (!isHeld(run.result)) continue;
      const leg: ConsensusLeg = {
        strategyId: scan.strategyId,
        strategyName: scan.strategyName,
        type: scan.type,
        score: run.score,
        recentSignal: describeSignal(run.result),
      };
      const legs = bySymbol.get(symbol) ?? [];
      legs.push(leg);
      bySymbol.set(symbol, legs);
    }
  }

  const picks: ConsensusPick[] = Array.from(bySymbol.entries())
    .map(([symbol, legs]) => {
      const sortedLegs = [...legs].sort((a, b) => b.score - a.score);
      const strategyTypes = Array.from(new Set(sortedLegs.map((l) => l.type)));
      const averageScore = Math.round(
        sortedLegs.reduce((sum, l) => sum + l.score, 0) / sortedLegs.length,
      );
      return {
        symbol,
        agreeCount: sortedLegs.length,
        strategyTypes,
        legs: sortedLegs,
        averageScore,
        resonance: sortedLegs.length >= 2,
      };
    })
    .sort(
      (a, b) =>
        b.agreeCount - a.agreeCount ||
        b.strategyTypes.length - a.strategyTypes.length ||
        b.averageScore - a.averageScore ||
        a.symbol.localeCompare(b.symbol),
    );

  const consensusCount = picks.filter((p) => p.resonance).length;
  const topPick = picks[0] ?? null;
  const asOf = latestDate || new Date().toISOString().slice(0, 10);

  return {
    asOf,
    strategyCount: scans.length,
    symbolsScanned: symbolsScanned.size,
    picks,
    consensusCount,
    topPick,
    verdict: buildVerdict(scans.length, symbolsScanned.size, consensusCount, topPick),
  };
}

function buildVerdict(
  strategyCount: number,
  symbolsScanned: number,
  consensusCount: number,
  topPick: ConsensusPick | null,
): string {
  if (!topPick) {
    return `No strategy is currently holding a name across the ${symbolsScanned}-symbol scan — there is nothing to confirm right now.`;
  }
  if (consensusCount === 0) {
    return `${strategyCount} strategies scanned ${symbolsScanned} symbols; every current pick is a single-strategy read, so there is no cross-strategy confirmation yet.`;
  }
  const lead =
    topPick.agreeCount >= 2
      ? `${topPick.symbol} has the strongest agreement — ${topPick.agreeCount} strategies across ${topPick.strategyTypes.length} distinct ${topPick.strategyTypes.length === 1 ? "style" : "styles"} hold it.`
      : "";
  return `${consensusCount} ${consensusCount === 1 ? "name has" : "names have"} two or more strategies agreeing out of ${strategyCount} scanned across ${symbolsScanned} symbols. ${lead}`.trim();
}
