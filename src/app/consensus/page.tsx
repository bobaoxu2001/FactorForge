import Link from "next/link";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import EmptyState from "@/components/research/EmptyState";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";

export const revalidate = 60 * 60;

export default async function ConsensusPage() {
  const { signalConsensus } = await getResearchDataset();
  const { picks, consensusCount, strategyCount, symbolsScanned, topPick, asOf, verdict } = signalConsensus;
  const resonance = picks.filter((p) => p.resonance);
  const singles = picks.filter((p) => !p.resonance);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L4 Multi-Strategy Consensus</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Signal Resonance</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          The platform runs {strategyCount} structurally different strategies across {symbolsScanned} symbols. This page
          pivots that grid to one question: which names is more than one independent strategy holding right now? No
          broker, no live orders — this is a research overlay.
        </p>
      </header>

      <PlainEnglish>
        Different trading strategies look for different things. When several of them — built on totally different
        logic — all land on the <strong>same stock at the same time</strong>, that agreement is a stronger, less
        style-dependent signal than any one strategy alone. This page shows those overlaps, strongest agreement first.
      </PlainEnglish>

      <MethodologyCallout
        items={[
          "Consensus counts only symbols currently held by more than one strategy.",
          "Agreement is ranked by strategy count, then by distinct strategy types, then by average radar score.",
          "Multi-strategy agreement can reduce single-style dependence, but it does not guarantee future returns.",
          "Single-strategy picks remain visible and are not relabeled as consensus.",
        ]}
      />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Scan summary</div>
            <h2 className="mt-1 text-[20px] font-semibold text-ink">Cross-strategy agreement</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{verdict}</p>
          </div>
          <div className="text-right text-[12px] text-ink-muted">As of<br /><span className="num text-ink">{asOf}</span></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Strategies scanned" value={String(strategyCount)} />
          <MetricCard label="Symbols scanned" value={String(symbolsScanned)} />
          <MetricCard
            label="Consensus names"
            value={String(consensusCount)}
            tone={consensusCount > 0 ? "positive" : "default"}
          />
          <MetricCard
            label="Strongest agreement"
            value={topPick ? `${topPick.symbol} ·${topPick.agreeCount}×` : "—"}
            tone="accent"
            hint={topPick ? `${topPick.strategyTypes.length} distinct ${topPick.strategyTypes.length === 1 ? "style" : "styles"}` : undefined}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-semibold text-ink">
            Resonance · <Term term="diversification">multi-strategy</Term> agreement
          </h2>
          <span className="text-[12px] text-ink-soft">{resonance.length} {resonance.length === 1 ? "name" : "names"}</span>
        </div>

        {resonance.length === 0 && (
          <EmptyState
            title="No cross-strategy confirmation yet."
            message="Every current pick is held by a single strategy. Resonance appears only when two or more independent strategies hold the same name at the same time — the engine does not invent agreement."
          />
        )}

        <div className="space-y-4">
          {resonance.map((pick) => (
            <article key={pick.symbol} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-400/35 bg-blue-400/10 text-[15px] font-semibold text-blue-100">
                    {pick.agreeCount}×
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold text-ink">{pick.symbol}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pick.strategyTypes.map((type) => (
                        <span key={type} className="chip border-line bg-white/[0.04] text-ink-muted">{type}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right text-[12px] text-ink-muted">
                  Avg score<br /><span className="num text-[18px] font-semibold text-brand-blue">{pick.averageScore}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {pick.legs.map((leg) => (
                  <div key={leg.strategyId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.035] p-3">
                    <div>
                      <Link href={`/strategies/${leg.strategyId}`} className="text-[13px] font-medium text-ink hover:text-brand-blue">
                        {leg.strategyName}
                      </Link>
                      <div className="text-[11px] uppercase tracking-wider text-ink-soft">{leg.type}</div>
                    </div>
                    <div className="text-[12px] text-ink-muted">{leg.recentSignal}</div>
                    <div className="num text-[13px] text-ink">{leg.score}</div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {singles.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold text-ink">Single-strategy picks</h2>
            <span className="text-[12px] text-ink-soft">{singles.length} {singles.length === 1 ? "name" : "names"}</span>
          </div>
          <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            Held by exactly one strategy — a real signal, but with no independent confirmation. Watch for a second
            strategy to join before treating it as resonance.
          </p>
          <div className="card divide-y divide-line">
            {singles.map((pick) => (
              <div key={pick.symbol} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-semibold text-ink">{pick.symbol}</span>
                  <StatusBadge status={pick.strategyTypes[0] ?? "single"} />
                </div>
                <Link href={`/strategies/${pick.legs[0]?.strategyId}`} className="text-[12px] text-ink-muted hover:text-ink">
                  {pick.legs[0]?.strategyName}
                </Link>
                <span className="num text-[12px] text-ink-muted">score {pick.averageScore}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
