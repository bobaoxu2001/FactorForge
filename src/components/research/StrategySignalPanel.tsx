import type { BacktestResult } from "@/types/backtest";

export default function StrategySignalPanel({ result }: { result: BacktestResult }) {
  const latest = result.signals[result.signals.length - 1];
  return (
    <div className="card p-5">
      <div className="text-[11px] uppercase tracking-wider text-ink-soft">Latest signal</div>
      <div className="mt-2 text-[15px] font-semibold text-ink">{latest ? `${latest.type.toUpperCase()} · ${latest.date}` : "Strategy is online and waiting for the next entry signal."}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{latest?.reason ?? "No current entry signal from the live rule set."}</p>
    </div>
  );
}
