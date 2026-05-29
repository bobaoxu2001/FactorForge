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

export interface PaperObservation {
  id: string;
  status: "waiting signal" | "active" | "holding" | "no signal";
  candidate: RadarCandidate;
  simulatedCapital: number;
  simulatedReturn: number;
  currentSymbol: string;
  recentSignal: string;
  nextCheck: string;
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
