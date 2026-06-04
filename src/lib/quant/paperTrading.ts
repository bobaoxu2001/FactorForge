import type { PaperAccountSummary, PaperLedgerSnapshot, PaperObservation, RadarCandidate } from "@/types/strategy";

const SIMULATED_CAPITAL = 100_000;
/** Hard ceiling on simultaneous paper observations, regardless of how many candidates pass. */
export const MAX_OBSERVATION_SLOTS = 3;
export const PAPER_POSITION_FRACTION = 0.2;
export const PAPER_POSITION_CAPITAL = SIMULATED_CAPITAL * PAPER_POSITION_FRACTION;
const MAX_TOTAL_EXPOSURE = 0.6;
const MAX_CONCENTRATION = 0.25;
const DRAWDOWN_PAUSE_LEVEL = -0.3;
const DRAWDOWN_WATCH_LEVEL = -0.2;

export function buildPaperObservations(
  candidates: RadarCandidate[],
  maxSlots: number = MAX_OBSERVATION_SLOTS,
  options: { ledgerSnapshots?: Record<string, PaperLedgerSnapshot> } = {},
): PaperObservation[] {
  const slots = Math.max(0, Math.min(MAX_OBSERVATION_SLOTS, Math.floor(maxSlots)));
  const selected = candidates.filter((candidate) => candidate.status === "radar candidate").slice(0, slots);
  return selected.map((candidate) => {
    const result = candidate.result;
    const id = paperObservationId(candidate);
    const ledger = options.ledgerSnapshots?.[id] ?? null;
    const lastSignal = result.signals[result.signals.length - 1];
    const status =
      result.metrics.currentPosition === "long" ? "holding" :
      lastSignal?.type === "buy" ? "active" :
      lastSignal ? "waiting signal" : "no signal";
    const recentSignal = lastSignal
      ? `${lastSignal.date} · ${lastSignal.type} · ${lastSignal.reason}`
      : "Strategy is online and waiting for the next entry signal.";

    return {
      id,
      status,
      candidate,
      simulatedCapital: SIMULATED_CAPITAL,
      simulatedReturn: ledger?.returnPct ?? result.metrics.totalReturn,
      currentSymbol: result.symbol,
      recentSignal,
      nextCheck: nextMarketCheck(),
      ledger,
    };
  });
}

export function buildPaperAccountSummary(
  observations: PaperObservation[],
  options: { maxSlots?: number; slotNote?: string } = {},
): PaperAccountSummary {
  const observationSlots = Math.max(
    0,
    Math.min(MAX_OBSERVATION_SLOTS, Math.floor(options.maxSlots ?? MAX_OBSERVATION_SLOTS)),
  );
  const activeObservations = observations.filter((observation) => observation.status === "active" || observation.status === "holding").length;
  const totalAllocatedCapital = activeObservations * PAPER_POSITION_CAPITAL;
  const exposurePct = totalAllocatedCapital / SIMULATED_CAPITAL;
  const concentrationPct = activeObservations > 0 ? PAPER_POSITION_FRACTION : 0;
  const maxObservedDrawdown = observations.length > 0
    ? Math.min(...observations.map((observation) => observation.candidate.result.metrics.maxDrawdown))
    : 0;
  const averageRadarScore = observations.length > 0
    ? Math.round(observations.reduce((sum, observation) => sum + observation.candidate.score, 0) / observations.length)
    : 0;
  const riskBudgetStatus: PaperAccountSummary["riskBudgetStatus"] =
    observations.length === 0
      ? "idle"
      : maxObservedDrawdown <= DRAWDOWN_PAUSE_LEVEL
        ? "paused"
        : exposurePct > MAX_TOTAL_EXPOSURE || concentrationPct > MAX_CONCENTRATION || maxObservedDrawdown <= DRAWDOWN_WATCH_LEVEL
          ? "watch exposure"
          : "within limits";

  return {
    simulatedCapital: SIMULATED_CAPITAL,
    observationSlots,
    activeObservations,
    totalAllocatedCapital,
    exposurePct,
    concentrationPct,
    maxObservedDrawdown,
    averageRadarScore,
    riskBudgetStatus,
    guardrails: [
      "Only radar candidates can enter paper observation.",
      "No broker connection, live order routing, or execution automation is enabled.",
      `Each active signal is capped at ${(PAPER_POSITION_FRACTION * 100).toFixed(0)}% simulated capital.`,
      `Total simulated exposure target stays below ${(MAX_TOTAL_EXPOSURE * 100).toFixed(0)}%.`,
      options.slotNote ??
        `Observation slots: ${observationSlots} of ${MAX_OBSERVATION_SLOTS} hard cap.`,
      "Fallback/demo market data remains labeled and is not promoted as live evidence.",
    ],
  };
}

export function paperObservationId(candidate: RadarCandidate): string {
  return `${candidate.result.strategyId}-${candidate.result.symbol}`;
}

function nextMarketCheck(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return `${next.toISOString().slice(0, 10)} 09:35 ET`;
}
