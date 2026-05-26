import type { BacktestResult } from "./backtest";

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  type: "breakout" | "momentum" | "mean reversion" | "rotation";
  defaultSymbol: string;
}

export interface RadarCandidate {
  rank: number;
  score: number;
  status: "radar candidate" | "continue observing" | "rejected";
  result: BacktestResult;
  reasons: string[];
  nextAction: string;
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
