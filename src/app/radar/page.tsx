import Link from "next/link";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import EmptyState from "@/components/research/EmptyState";
import SignalConcentrationPanel from "@/components/research/SignalConcentrationPanel";
import { getResearchDataset } from "@/lib/research";
import { num, pct } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function RadarPage() {
  const { radarCandidates, signalConcentration } = await getResearchDataset();
  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L3 Radar</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Strategy Radar Screening</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Scoring rules live in code: annualized return, Sharpe, drawdown, win rate, trade count, data provenance, and cost-aware backtest assumptions determine candidate status.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total" value={String(radarCandidates.length)} />
        <MetricCard label="Candidates" value={String(radarCandidates.filter((item) => item.status === "radar candidate").length)} tone="accent" />
        <MetricCard label="Observing" value={String(radarCandidates.filter((item) => item.status === "continue observing").length)} />
        <MetricCard label="Rejected" value={String(radarCandidates.filter((item) => item.status === "rejected").length)} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[
          "score >= 80, maxDrawdown > -25%, Sharpe > 1, and tradeCount >= 5: radar candidate",
          "score >= 70: continue observing",
          "maxDrawdown < -35% or Sharpe < 0: rejected",
          "Signals are generated from completed bars and filled at next open with modeled costs",
          "Paper Trading can only use strategies promoted from radar candidates",
        ].map((rule, index) => (
          <div key={rule} className="card p-4">
            <div className="text-[11px] uppercase tracking-wider text-ink-soft">Rule {index + 1}</div>
            <div className="mt-2 text-[13px] leading-relaxed text-ink">{rule}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          Concentration gate — promote diversification, not duplicates
        </div>
        <SignalConcentrationPanel report={signalConcentration} />
      </section>

      <section className="space-y-3">
        {radarCandidates.length > 0 ? radarCandidates.map((candidate) => (
          <Link key={candidate.result.strategyId} href={`/strategies/${candidate.result.strategyId}`} className="card card-hover grid grid-cols-1 gap-4 p-5 lg:grid-cols-[80px_1.2fr_1fr_1.3fr]">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-soft">Rank</div>
              <div className="num mt-1 text-3xl font-semibold text-ink">{candidate.rank}</div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={candidate.status} />
                {candidate.redundancy?.demoted && (
                  <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-200">
                    redundant {Math.round(candidate.redundancy.correlation * 100)}%
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={candidate.result.dataStatus.adjusted ? "adjusted prices" : "raw/demo prices"} />
                <StatusBadge status={`${candidate.result.assumptions.slippageBps} bps slippage`} />
              </div>
              <h3 className="mt-2 text-[16px] font-semibold text-ink">{candidate.result.strategyName}</h3>
              <p className="mt-1 text-[12.5px] text-ink-muted">{candidate.result.symbol} · {candidate.nextAction}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Small label="Score" value={String(candidate.score)} />
              <Small label="Sharpe" value={num(candidate.result.metrics.sharpe)} />
              <Small label="Annual" value={pct(candidate.result.metrics.annualizedReturn)} />
              <Small label="Max DD" value={pct(candidate.result.metrics.maxDrawdown)} />
            </div>
            <ul className="space-y-1.5">
              {candidate.reasons.map((reason) => (
                <li key={reason} className="text-[12px] text-ink-muted">{reason}</li>
              ))}
            </ul>
          </Link>
        )) : (
          <EmptyState title="No radar results yet" message="After market data and backtests are available, the radar will generate ranking, status, and next actions from real metrics." />
        )}
      </section>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="num mt-0.5 text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}
