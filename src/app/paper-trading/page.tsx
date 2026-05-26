import Link from "next/link";
import EquityCurveChart from "@/components/charts/EquityCurveChart";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import EmptyState from "@/components/research/EmptyState";
import { getResearchDataset } from "@/lib/research";
import { pct, usd } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function PaperTradingPage() {
  const { paperObservations } = await getResearchDataset();
  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L5 Paper Trading</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Paper Observation</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          This page is for simulated observation only. It does not connect to a broker or place real orders. Observed strategies must come from radar candidates.
        </p>
      </header>

      {paperObservations.length === 0 && (
        <EmptyState title="Strategy is online and waiting for the next entry signal." message="No strategy currently meets radar admission rules. Paper observation only accepts radar candidates and does not inject fake results." />
      )}

      <div className="space-y-6">
        {paperObservations.map((observation) => {
          const result = observation.candidate.result;
          return (
            <section key={observation.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <StatusBadge status={observation.status} />
                  <h2 className="mt-2 text-[20px] font-semibold text-ink">{result.strategyName}</h2>
                  <Link href={`/strategies/${result.strategyId}`} className="text-[12px] text-ink-muted hover:text-ink">{result.symbol} · view strategy</Link>
                </div>
                <div className="text-right text-[12px] text-ink-muted">Next check<br />{observation.nextCheck}</div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                <MetricCard label="Sim capital" value={usd(observation.simulatedCapital)} />
                <MetricCard label="Return" value={pct(observation.simulatedReturn)} tone="positive" />
                <MetricCard label="Score" value={String(observation.candidate.score)} tone="accent" />
                <MetricCard label="Position" value={result.metrics.currentPosition} />
                <MetricCard label="Trades" value={String(result.metrics.tradeCount)} />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_0.8fr]">
                <EquityCurveChart data={result.equityCurve} />
                <div className="card p-5">
                  <div className="text-[11px] uppercase tracking-wider text-ink-soft">Recent signal</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink">{observation.recentSignal}</p>
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                    Observation uses next-open fills, {result.assumptions.slippageBps} bps slippage, and {usd(result.assumptions.feePerTrade)} per trade. No broker connection or real orders are active.
                  </p>
                  <div className="mt-5 text-[11px] uppercase tracking-wider text-ink-soft">Recent trades</div>
                  <div className="mt-2 space-y-2">
                    {result.trades.slice(-4).map((trade) => (
                      <div key={`${trade.entryDate}-${trade.exitDate}`} className="flex justify-between gap-3 text-[12px]">
                        <span className="text-ink-muted">{trade.entryDate} → {trade.exitDate}</span>
                        <span className="num text-ink">{pct(trade.returnPct)}</span>
                      </div>
                    ))}
                    {result.trades.length === 0 && <div className="text-[12px] text-ink-muted">Strategy is online and waiting for the next entry signal.</div>}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
