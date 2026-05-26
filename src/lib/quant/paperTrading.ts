import type { PaperObservation, RadarCandidate } from "@/types/strategy";

export function buildPaperObservations(candidates: RadarCandidate[]): PaperObservation[] {
  const selected = candidates.filter((candidate) => candidate.status === "radar candidate").slice(0, 3);
  return selected.map((candidate) => {
    const result = candidate.result;
    const lastSignal = result.signals[result.signals.length - 1];
    const status =
      result.metrics.currentPosition === "long" ? "holding" :
      lastSignal?.type === "buy" ? "active" :
      lastSignal ? "waiting signal" : "no signal";
    const recentSignal = lastSignal
      ? `${lastSignal.date} · ${lastSignal.type} · ${lastSignal.reason}`
      : "Strategy is online and waiting for the next entry signal.";

    return {
      id: `${result.strategyId}-${result.symbol}`,
      status,
      candidate,
      simulatedCapital: 100_000,
      simulatedReturn: result.metrics.totalReturn,
      currentSymbol: result.symbol,
      recentSignal,
      nextCheck: nextMarketCheck(),
    };
  });
}

function nextMarketCheck(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return `${next.toISOString().slice(0, 10)} 09:35 ET`;
}
