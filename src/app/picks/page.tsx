import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import MetricCard from "@/components/cards/MetricCard";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/research/EmptyState";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";
import type { PickTier, StockPick } from "@/lib/quant/stockPicks";

export const revalidate = 60 * 60;

export const metadata: Metadata = {
  title: "AI Stock Picks",
  description:
    "Model-ranked cross-sectional stock selection: momentum, trend, stability, volume, and multi-strategy confirmation blended under the current market regime. Research only — no broker, no advice.",
};

const TIER_STYLES: Record<PickTier, string> = {
  "prime watch": "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  constructive: "border-blue-400/35 bg-blue-400/10 text-blue-200",
  monitor: "border-line bg-white/[0.05] text-ink-muted",
};

export default async function PicksPage() {
  const { stockPicks, stockPickNote } = await getResearchDataset();
  const { picks, coverage, regime, regimeNote, verdict, asOf } = stockPicks;
  const leaders = picks.slice(0, 6);
  const bench = picks.slice(6);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="L4 Model Stock Selection"
        title="AI Stock Picks"
        subtitle={`Every scored universe name, ranked by a regime-aware blend of momentum, trend, stability, overheat balance, volume confirmation, and multi-strategy evidence. The scores are deterministic; the AI writes the reading on top. Technical evidence only — no fundamental data, no broker, not investment advice.`}
      />

      <PlainEnglish>
        This page answers &ldquo;which stocks look most promising right now, according to the model?&rdquo; — and shows the
        receipts. Each name gets six sub-scores (how strongly it&apos;s been rising, whether the long-term trend agrees, how
        calm it trades, whether it&apos;s already overheated, whether volume confirms, and how many independent strategies
        hold it). The weights shift with the market <Term term="factor">regime</Term>: in a stressed market the model
        prefers calm names over hot ones. <strong>High rank means strong technical evidence, not a prediction.</strong>
      </PlainEnglish>

      <MethodologyCallout items={stockPicks.methodology} />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Screen summary</div>
            <h2 className="mt-1 text-[20px] font-semibold text-ink">Cross-sectional rank · {regime} regime</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{verdict}</p>
          </div>
          <div className="text-right text-[12px] text-ink-muted">As of<br /><span className="num text-ink">{asOf.slice(0, 10)}</span></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Stocks scored" value={`${coverage.scored}/${coverage.scanned}`} hint="Complete factor rows" />
          <MetricCard label="Real data" value={String(coverage.realData)} tone={coverage.fallbackData === 0 ? "positive" : "default"} hint={coverage.fallbackData > 0 ? `${coverage.fallbackData} on labeled fallback` : "No fallback rows"} />
          <MetricCard label="Prime watch" value={String(picks.filter((p) => p.tier === "prime watch").length)} tone="accent" hint="Score ≥ 70 on real data" />
          <MetricCard label="Regime" value={regime} hint={regimeNote.split("—")[1]?.trim() ?? regimeNote} />
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
            <Sparkles className="h-4 w-4" /> Model reading
          </div>
          <span className="chip border-line bg-white/[0.04] text-ink-soft">
            {stockPickNote.source === "deepseek" ? "LLM note · numbers computed in code" : "Deterministic template"}
          </span>
        </div>
        <h3 className="mt-3 text-[17px] font-semibold text-ink">{stockPickNote.headline}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{stockPickNote.body}</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft"><span className="font-semibold text-ink-muted">Watch:</span> {stockPickNote.watch}</p>
      </section>

      {picks.length === 0 && (
        <EmptyState
          title="Nothing to rank yet."
          message="No universe name has a complete factor row this session. The screen only ranks what the data supports — it never invents a leaderboard."
          action={{ href: "/data", label: "Check data sources" }}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-semibold text-ink">Ranked picks</h2>
          <span className="text-[12px] text-ink-soft">{leaders.length} of {picks.length} shown in detail</span>
        </div>
        <div className="space-y-4">
          {leaders.map((pick) => (
            <PickCard key={pick.symbol} pick={pick} />
          ))}
        </div>
      </section>

      {bench.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[18px] font-semibold text-ink">Rest of the cross-section</h2>
          <div className="card divide-y divide-line">
            {bench.map((pick) => (
              <div key={pick.symbol} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="num w-8 text-right text-[12px] text-ink-soft">#{pick.rank}</span>
                  <span className="text-[14px] font-semibold text-ink">{pick.symbol}</span>
                  <span className="text-[12px] text-ink-muted">{pick.name}</span>
                  <span className="chip border-line bg-white/[0.04] text-ink-soft">{pick.sector}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`chip ${TIER_STYLES[pick.tier]}`}>{pick.tier}</span>
                  <span className="num text-[14px] font-semibold text-ink">{pick.compositeScore}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-[12px] leading-relaxed text-ink-soft">
        Research software only. The screen ranks technical evidence over a 28-name universe; it does not know
        earnings, valuations, or news, places no trades, and is not investment advice. Cross-check any name on{" "}
        <Link href="/consensus" className="text-ink-muted underline decoration-dotted hover:text-ink">consensus</Link>,{" "}
        <Link href="/factors" className="text-ink-muted underline decoration-dotted hover:text-ink">factors</Link>, and{" "}
        <Link href="/data" className="text-ink-muted underline decoration-dotted hover:text-ink">data provenance</Link> before drawing conclusions.
      </p>
    </div>
  );
}

function PickCard({ pick }: { pick: StockPick }) {
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-[13px] font-semibold text-cyan-100">
            #{pick.rank}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-semibold text-ink">{pick.symbol}</span>
              <span className="text-[13px] text-ink-muted">{pick.name}</span>
              <span className="chip border-line bg-white/[0.04] text-ink-soft">{pick.sector}</span>
              {pick.isFallbackData && (
                <span className="chip border-amber-300/30 bg-amber-300/10 text-amber-200">fallback data</span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`chip ${TIER_STYLES[pick.tier]}`}>{pick.tier}</span>
              {pick.heldByStrategies > 0 && (
                <span className="text-[11.5px] text-ink-soft">
                  held by {pick.heldByStrategies} independent {pick.heldByStrategies === 1 ? "strategy" : "strategies"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">Composite</div>
          <div className="num text-[26px] font-semibold text-ink">{pick.compositeScore}<span className="text-[13px] text-ink-soft">/100</span></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
        {pick.components.map((component) => (
          <div key={component.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium text-ink-muted">
                {component.label}
                <span className="ml-1.5 text-[10.5px] text-ink-soft">w {(component.weight * 100).toFixed(0)}%</span>
              </span>
              <span className="num text-[12px] text-ink">{Math.round(component.score)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-blue-400/80"
                style={{ width: `${Math.round(component.score)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-ink-soft">{component.detail}</div>
          </div>
        ))}
      </div>

      {pick.caveats.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-300/18 bg-amber-300/[0.05] p-3 text-[12px] leading-relaxed text-amber-100/85">
          <span className="font-semibold">Caveats:</span> {pick.caveats.join(" ")}
        </div>
      )}
    </article>
  );
}
