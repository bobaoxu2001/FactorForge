import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, ClipboardList, Eye, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import EmptyState from "@/components/research/EmptyState";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";
import { buildPublicTrackRecord } from "@/lib/quant/publicTrackRecord";
import { num, pct, usd } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function TrackRecordPage() {
  const dataset = await getResearchDataset({ paperLedger: true });
  const record = buildPublicTrackRecord({
    observations: dataset.paperObservations,
    account: dataset.paperAccount,
    dailyReview: dataset.dailyReview,
    generatedAt: dataset.metadata.generatedAt,
  });

  return (
    <div className="space-y-7">
      <section className="hero-shell p-5 md:p-7">
        <div className="relative grid gap-6 xl:grid-cols-[1fr_0.78fr] xl:items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              <Trophy className="h-3.5 w-3.5" />
              Public paper track record
            </div>
            <h1 className="mt-4 max-w-4xl text-[36px] font-semibold leading-none tracking-[-0.04em] text-white md:text-[58px]">
              A shareable receipt for simulated strategy performance.
            </h1>
            <p className="mt-4 max-w-3xl text-[14px] leading-7 text-ink-muted">
              This page is built for outside viewers: strategy-by-strategy paper ledger results, observation dates, current marks, and guardrails. It is not a broker statement, not financial advice, and not a live-trading workflow.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 text-[12px] text-ink-muted sm:grid-cols-3">
              <ProofPill icon={BadgeCheck} label={`${record.ledgerTrackedCount}/${record.promotedCount || 0}`} detail="ledger-backed" />
              <ProofPill icon={ShieldCheck} label="No orders" detail="read-only public record" />
              <ProofPill icon={CalendarDays} label={record.latestMarkDate ?? record.asOf} detail="latest mark" />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/paper-trading" className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.07] px-3.5 py-2 text-[12.5px] text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.12]">
                Open full paper desk
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/radar" className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3.5 py-2 text-[12.5px] text-ink-muted transition hover:text-ink">
                View admission rules
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="hero-showcase p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Share line</div>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">FactorForge Paper Record</h2>
              </div>
              <StatusBadge status="simulation only" />
            </div>
            <div className="mt-5 rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.055] p-4">
              <p className="text-[13px] leading-relaxed text-ink">{record.shareLine}</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
                Public URL: /track-record · generated {record.generatedAt.slice(0, 19).replace("T", " ")} UTC
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="Ledger return" value={pct(record.ledgerReturnPct)} tone={record.ledgerReturnPct >= 0 ? "positive" : "negative"} />
              <MiniStat label="Unrealized P&L" value={usd(record.unrealizedPnl)} tone={record.unrealizedPnl >= 0 ? "positive" : "negative"} />
              <MiniStat label="Tracked since" value={record.oldestEntryDate ?? "waiting"} />
              <MiniStat label="Paper positions" value={String(record.promotedCount)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Tracked" value={String(record.promotedCount)} hint="radar admitted" tone="accent" />
        <MetricCard label="Live" value={String(record.liveCount)} hint="active or holding" />
        <MetricCard label="Ledger return" value={pct(record.ledgerReturnPct)} tone={record.ledgerReturnPct >= 0 ? "positive" : "negative"} />
        <MetricCard label="Unrealized P&L" value={usd(record.unrealizedPnl)} tone={record.unrealizedPnl >= 0 ? "positive" : "negative"} />
        <MetricCard label="Market value" value={usd(record.totalMarketValue)} />
        <MetricCard label="Exposure" value={pct(record.exposurePct)} />
        <MetricCard label="Max DD" value={pct(record.maxObservedDrawdown)} tone={record.maxObservedDrawdown < -0.2 ? "negative" : "default"} />
        <MetricCard label="W/L" value={`${record.winners}/${record.losers}`} hint="current book" />
      </section>

      <MethodologyCallout title="Public record contract" items={record.disclosureItems} />

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Public Scorecard</div>
            <h2 className="mt-1 text-[20px] font-semibold text-ink">Ledger-backed strategy rows</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              Rows are ranked by paper ledger return. Entry and current marks come from the local paper ledger when available; otherwise the row is clearly labeled as an estimate.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-white/[0.035] px-3 py-2 text-[12px] text-ink-muted">
            <Eye className="h-3.5 w-3.5" />
            public view
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[12.5px]">
            <thead className="border-y border-line bg-white/[0.025] text-[10px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Strategy</th>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-right">Ledger return</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-right">Market value</th>
                <th className="px-4 py-3 text-left">Entry → Current</th>
                <th className="px-4 py-3 text-left">Evidence</th>
                <th className="px-4 py-3 text-left">Next check</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {record.rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-4 py-3">
                    <span className="num inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100">
                      {row.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/strategies/${row.strategyId}`} className="font-medium text-white hover:text-blue-300">
                      {row.strategyName}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-ink-soft">{row.strategyId}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{row.symbol}</td>
                  <td className={`num px-4 py-3 text-right ${row.returnPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(row.returnPct)}</td>
                  <td className={`num px-4 py-3 text-right ${row.unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{usd(row.unrealizedPnl)}</td>
                  <td className="num px-4 py-3 text-right text-ink">{usd(row.marketValue)}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {row.entryDate && row.currentDate ? (
                      <span className="num">{row.entryDate} → {row.currentDate}</span>
                    ) : (
                      <span>Not ledger-backed</span>
                    )}
                    <div className="mt-0.5 text-[11px] text-ink-soft">{row.daysLive} days live</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.ledgerSource} />
                    <div className="mt-1 text-[11px] text-ink-soft">Radar {row.radarScore} · DD {pct(row.maxDrawdown)}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.nextCheck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {record.rows.length === 0 && (
          <div className="p-5">
            <EmptyState title="No public paper record yet" message="The radar has not admitted a strategy into the paper ledger." />
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/25 bg-blue-300/10">
              <ClipboardList className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Verification Notes</div>
              <h2 className="text-[18px] font-semibold text-ink">What an outside viewer can trust</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Source", `${record.ledgerTrackedCount} rows use the local paper ledger; ${dataset.metadata.realDataCount}/${dataset.metadata.symbolCount} symbols use provider-backed market data.`],
              ["Scope", "This page summarizes paper observation after radar admission. Full historical backtests remain on each strategy page."],
              ["Broker", "Alpaca paper sync, when configured, is a read-only mirror on the full desk page. Public track record does not expose broker account identifiers."],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line bg-white/[0.035] p-3">
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Live Public Summary</div>
          <h2 className="mt-1 text-[20px] font-semibold text-ink">Readable performance receipt</h2>
          <div className="mt-4 rounded-2xl border border-line bg-white/[0.035] p-4">
            <p className="text-[15px] leading-7 text-ink">{record.shareLine}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
              <ReceiptCell label="Allocated" value={usd(record.totalAllocatedCapital)} />
              <ReceiptCell label="Market value" value={usd(record.totalMarketValue)} />
              <ReceiptCell label="Avg score" value={num(record.averageRadarScore, 0)} />
              <ReceiptCell label="As of" value={record.asOf} />
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

function ProofPill({ icon: Icon, label, detail }: { icon: LucideIcon; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.04] p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08]">
        <Icon className="h-4 w-4 text-emerald-100" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-white">{label}</div>
        <div className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.14em] text-ink-soft">{detail}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-2xl border border-line bg-white/[0.035] p-3">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className={`num mt-2 text-[22px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function ReceiptCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className="num mt-1 text-[14px] font-semibold text-ink">{value}</div>
    </div>
  );
}
