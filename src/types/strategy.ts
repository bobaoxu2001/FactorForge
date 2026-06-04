import type { BacktestResult } from "./backtest";

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  type: "breakout" | "momentum" | "mean reversion" | "rotation";
  defaultSymbol: string;
  knownLimitations?: string[];
}

export interface RadarCandidate {
  rank: number;
  score: number;
  status: "radar candidate" | "continue observing" | "rejected";
  result: BacktestResult;
  reasons: string[];
  nextAction: string;
  /**
   * Set when the concentration gate found this candidate to be a near-duplicate
   * of a higher-ranked one. `demoted` means it was downgraded out of the radar-
   * candidate tier so capital isn't allocated twice to the same bet.
   */
  redundancy?: {
    correlatedWith: string;
    correlation: number;
    demoted: boolean;
  };
}

export interface PaperLedgerSnapshot {
  source: "persistent" | "ephemeral" | "unavailable";
  positionId: string;
  status: "open" | "closed";
  promotedAt: number;
  promotedAtIso: string;
  entryDate: string;
  entryPrice: number;
  currentDate: string;
  currentPrice: number;
  shares: number;
  allocatedCapital: number;
  marketValue: number;
  unrealizedPnl: number;
  returnPct: number;
  daysLive: number;
  note: string;
}

export interface PaperObservation {
  id: string;
  status: "waiting signal" | "active" | "holding" | "no signal";
  candidate: RadarCandidate;
  simulatedCapital: number;
  simulatedReturn: number;
  currentSymbol: string;
  recentSignal: string;
  nextCheck: string;
  ledger: PaperLedgerSnapshot | null;
}

export interface PaperAccountSummary {
  simulatedCapital: number;
  observationSlots: number;
  activeObservations: number;
  totalAllocatedCapital: number;
  exposurePct: number;
  concentrationPct: number;
  maxObservedDrawdown: number;
  averageRadarScore: number;
  riskBudgetStatus: "within limits" | "watch exposure" | "paused" | "idle";
  guardrails: string[];
}

/**
 * End-of-session tape: how many entries/exits the radar produced today and how
 * many were screened out. Mirrors a real desk's post-close trade blotter, but
 * every count is a simulated observation — no orders are routed.
 */
export interface DailyReviewTape {
  /** Observations that opened a simulated position on the review date. */
  entries: number;
  /** Observations that closed a simulated position on the review date. */
  exits: number;
  /** Candidates that signalled but were left in "continue observing" — not promoted. */
  skipped: number;
  /** Near-duplicate candidates the concentration gate refused a slot ("rejected orders"). */
  rejected: number;
}

/**
 * Deterministic post-market review of the paper-observation book. Every field is
 * computed in the engine from the same observations the rest of the app renders;
 * the LLM layer ({@link DailyReviewNote}) only writes prose on top of these
 * numbers, never new ones.
 */
export interface DailyReview {
  /** Review date (ET session), derived from the freshest signal in the book. */
  asOf: string;
  /** Number of observations currently held in the simulated book. */
  bookSize: number;
  /** Observations whose simulated return is at or above breakeven. */
  winners: number;
  /** Observations whose simulated return is below breakeven. */
  losers: number;
  /** Share of simulated capital deployed across active observations. */
  deployedExposurePct: number;
  /** The single weakest observation by simulated return, if the book is non-empty. */
  weakest: { label: string; symbol: string; returnPct: number } | null;
  /** Largest cluster of observations admitted on the same signal date. */
  largestBatch: { signalDate: string; count: number } | null;
  tape: DailyReviewTape;
  /** Ranked things a researcher should look at before the next session. */
  watchItems: string[];
}
