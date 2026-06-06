import Link from "next/link";
import StatusBadge from "@/components/badges/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/research/EmptyState";
import SignalConcentrationPanel from "@/components/research/SignalConcentrationPanel";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";
import { num, pct } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function RadarPage() {
  const { radarCandidates, signalConcentration, stressDiagnostics, marketStress } = await getResearchDataset();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="L3 Radar"
        title="Strategy Radar Screening"
        subtitle={
          <>
            Scoring rules live in code: <Term term="annualized">annualized return</Term>, <Term term="sharpe">Sharpe</Term>, <Term term="drawdown">drawdown</Term>, <Term term="winrate">win rate</Term>, trade count, data provenance, and cost-aware <Term term="backtest">backtest</Term> assumptions determine candidate status.
          </>
        }
      />

      <PlainEnglish>
        Think of this as a talent scout for trading strategies. Each strategy is graded on how much it made,
        how bumpy the ride was, and how reliable the evidence is. The best-graded ones become
        &ldquo;candidates&rdquo; worth watching; the risky ones get rejected. Nothing here trades real money.
      </PlainEnglish>

      <RadarFunnel candidates={radarCandidates} />

      <section className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.05] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-amber-100/75">Stress-adjusted ranking active</div>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
              Under the current <span className="text-ink">{marketStress.regime}</span> regime (stress score {marketStress.stressScore}/100), each
              candidate also carries a <span className="text-ink">stress-adjusted score</span> that penalizes high drawdown and downside
              volatility, and rewards benchmark-relative resilience, smoother equity, and higher data quality. The base score is unchanged.
            </p>
          </div>
          <StatusBadge status={marketStress.regime === "risk-off" ? "under stress" : marketStress.regime === "neutral" ? "mixed regime" : "risk-on"} />
        </div>
      </section>

      <MethodologyCallout
        items={[
          "Scores combine return, Sharpe, drawdown, win rate, trade count, and data-provenance penalties.",
          "Candidate thresholds are explicit: high score with bounded drawdown and enough trades can reach radar candidate status.",
          "Hard rejection rules penalize severe drawdown, negative Sharpe, weak evidence, or poor data quality.",
          "Stress-adjusted score is a regime-aware re-weighting for research only; the base score and admission rules are unchanged.",
          "Radar gates mean worthy of simulated observation review, not an instruction to trade.",
        ]}
      />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[
          "score >= 80, maxDrawdown > -25%, Sharpe > 1, and tradeCount >= 5: radar candidate",
          "score >= 70: continue observing",
          "maxDrawdown < -35% or Sharpe < 0: rejected",
          "Signals are generated from completed bars and filled at next open with modeled costs",
          "Paper Trading can only observe strategies admitted by radar candidates",
        ].map((rule, index) => (
          <div key={rule} className="card p-4">
            <div className="text-[11px] uppercase tracking-wider text-ink-soft">Rule {index + 1}</div>
            <div className="mt-2 text-[13px] leading-relaxed text-ink">{rule}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          Concentration gate — prefer diversification, not duplicates
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
              {(() => {
                const diag = stressDiagnostics[candidate.result.strategyId];
                const adjusted = diag?.stressAdjustedScore;
                return (
                  <>
                    <Small label="Base score" value={String(candidate.score)} />
                    <Small
                      label="Stress-adj"
                      value={adjusted !== undefined ? String(adjusted) : "—"}
                      tone={adjusted !== undefined ? (adjusted < candidate.score ? "down" : "up") : "default"}
                    />
                    <Small label="Annual" value={pct(candidate.result.metrics.annualizedReturn)} />
                    <Small label="Max DD" value={pct(candidate.result.metrics.maxDrawdown)} tone="down" />
                    <Small label="Current DD" value={diag ? pct(diag.currentDrawdown) : "—"} tone={diag && diag.currentDrawdown < -0.05 ? "down" : "default"} />
                    <Small label="Sharpe" value={num(candidate.result.metrics.sharpe)} />
                  </>
                );
              })()}
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

/**
 * Screening funnel — visualizes how the full backtest set narrows down to
 * radar candidates. Each stage is a strict subset of the one above it, so the
 * bars genuinely funnel inward instead of being four unrelated counters.
 */
function RadarFunnel({ candidates }: { candidates: Array<{ status: string }> }) {
  const total = candidates.length;
  const candidateCount = candidates.filter((c) => c.status === "radar candidate").length;
  const observingCount = candidates.filter((c) => c.status === "continue observing").length;
  const rejectedCount = candidates.filter((c) => c.status === "rejected").length;
  const passedGate = candidateCount + observingCount;
  const pct100 = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const stages = [
    { label: "Screened", sub: "Backtests scored", count: total, color: "from-slate-300/70 to-slate-400/40", text: "text-ink" },
    { label: "Passed gate", sub: "Candidate or observing", count: passedGate, color: "from-blue-400/80 to-cyan-400/50", text: "text-blue-100" },
    { label: "Radar candidates", sub: "Cleared for paper observation", count: candidateCount, color: "from-cyan-400 to-emerald-400/70", text: "text-cyan-100" },
  ];

  return (
    <section className="card relative overflow-hidden p-6 panel-glow">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-label">Screening funnel</div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Every backtest enters at the top; only candidates that clear the score, drawdown, and trade-count gates reach the bottom.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-300/[0.06] px-3 py-1.5">
          <span className="num text-[15px] font-semibold text-rose-200">{rejectedCount}</span>
          <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-rose-200/80">rejected</span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {stages.map((stage) => (
          <div key={stage.label} className="grid grid-cols-[160px_1fr_56px] items-center gap-4">
            <div className="min-w-0">
              <div className={`text-[13px] font-semibold ${stage.text}`}>{stage.label}</div>
              <div className="text-[10.5px] text-ink-soft">{stage.sub}</div>
            </div>
            <div className="h-7 overflow-hidden rounded-lg bg-white/[0.04]">
              <div
                className={`flex h-full items-center justify-end rounded-lg bg-gradient-to-r px-2.5 ${stage.color} transition-all duration-500`}
                style={{ width: `${Math.max(8, pct100(stage.count))}%` }}
              >
                <span className="num text-[12px] font-semibold text-[#04121f]">{pct100(stage.count)}%</span>
              </div>
            </div>
            <div className="num text-right text-[20px] font-semibold text-white">{stage.count}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Small({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "up" | "down" }) {
  const cls = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : "text-ink";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className={`num mt-0.5 text-[15px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
