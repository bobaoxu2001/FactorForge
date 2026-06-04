import Link from "next/link";
import { Activity, ArrowUpRight, BarChart3, Clock3, Radio, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import EquityCurveChart from "@/components/charts/EquityCurveChart";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import EmptyState from "@/components/research/EmptyState";
import DailyReviewPanel from "@/components/research/DailyReviewPanel";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";
import { fetchAlpacaPaperSnapshot, type AlpacaPaperSnapshot } from "@/lib/broker/alpacaPaper";
import { pct, pctPlain, usd, num } from "@/lib/utils/format";
import type { PaperObservation } from "@/types/strategy";

export const dynamic = "force-dynamic";

export default async function PaperTradingPage() {
  const [{ paperObservations, paperAccount, dailyReview, dailyReviewNote, radarCandidates, metadata }, alpacaPaper] = await Promise.all([
    getResearchDataset({ paperLedger: true }),
    fetchAlpacaPaperSnapshot(),
  ]);
  const desk = buildDeskSnapshot(paperObservations, paperAccount.totalAllocatedCapital);
  const shortlistCount = radarCandidates.filter((candidate) => candidate.status === "radar candidate" || candidate.status === "continue observing").length;
  const promotedCount = paperObservations.length;
  const shareLine = `${promotedCount} ${promotedCount === 1 ? "strategy" : "strategies"} live · ${desk.bookReturnLabel} ledger-tracked return · ${pct(paperAccount.maxObservedDrawdown)} max observed drawdown · ${dailyReview.winners}W/${dailyReview.losers}L`;

  return (
    <div className="space-y-8">
      <section className="hero-shell p-5 md:p-7">
        <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
              Live paper desk · simulation only
            </div>
            <h1 className="mt-4 max-w-4xl text-[36px] font-semibold leading-none tracking-[-0.04em] text-white md:text-[58px]">
              Public track record for radar-promoted strategies.
            </h1>
            <p className="mt-4 max-w-3xl text-[14px] leading-7 text-ink-muted">
              A desk-style view of the simulated strategy book: current holdings, promotion funnel, observed P&amp;L, drawdown pressure, and the post-market tape. No broker is connected and no real order is routed.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 text-[12px] text-ink-muted sm:grid-cols-2">
              <DeskPill icon={Radio} label={`${promotedCount}/${paperAccount.observationSlots}`} detail="live slots" tone="green" />
              <DeskPill icon={ShieldCheck} label={paperAccount.riskBudgetStatus} detail="risk budget" tone="cyan" />
              <DeskPill icon={WalletCards} label={usd(desk.bookValue)} detail="sim book value" tone="blue" />
              <DeskPill icon={Clock3} label={dailyReview.asOf} detail="last review" tone="amber" />
            </div>
          </div>

          <div className="hero-showcase p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Share Snapshot</div>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">Paper Strategy Desk</h2>
              </div>
              <StatusBadge status={paperAccount.riskBudgetStatus} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SnapshotStat label="Ledger return" value={desk.bookReturnLabel} tone={desk.bookReturn >= 0 ? "positive" : "negative"} />
              <SnapshotStat label="Unrealized P&L" value={usd(desk.bookPnl)} tone={desk.bookPnl >= 0 ? "positive" : "negative"} />
              <SnapshotStat label="Active signals" value={String(paperAccount.activeObservations)} />
              <SnapshotStat label="Exposure" value={pctPlain(paperAccount.exposurePct)} tone="accent" />
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.055] p-4">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-cyan-100/70">Public line</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">{shareLine}</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
                Returns are measured from local ledger promotion price, not from the full historical backtest.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <LeaderCard label="Top winner" observation={desk.topWinner} />
              <LeaderCard label="Needs review" observation={desk.weakest} />
            </div>
          </div>
        </div>
      </section>

      <PlainEnglish>
        This is a simulated observation queue with <strong>pretend money</strong> — what traders call{" "}
        <Term term="papertrading">paper trading</Term>. Strategies from the radar are tracked as research cases so
        you can inspect how the rules behave, with zero real money at risk and no broker connected. It stays inside
        the research workflow and does not prepare or route real trades.
      </PlainEnglish>

      <MethodologyCallout
        items={[
          "Simulated only: no broker connection, no order routing, and no real-money account state.",
          "Only radar-approved strategies can enter paper observation.",
          "Observation slots, exposure limits, drawdown checks, and concentration gates constrain the simulated account.",
          "Daily Review summarizes deterministic observations; any LLM prose cannot change computed P&L or risk numbers.",
          "No P&L guarantee is implied by paper observation.",
        ]}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Promoted" value={`${promotedCount}/${shortlistCount}`} hint="from radar shortlist" tone="accent" />
        <MetricCard label="Live signals" value={String(paperAccount.activeObservations)} hint="active or holding" />
        <MetricCard label="Book value" value={usd(desk.bookValue)} tone={desk.bookPnl >= 0 ? "positive" : "negative"} />
        <MetricCard label="Ledger return" value={desk.bookReturnLabel} tone={desk.bookReturn >= 0 ? "positive" : "negative"} />
        <MetricCard label="Winners" value={String(dailyReview.winners)} tone="positive" />
        <MetricCard label="Losers" value={String(dailyReview.losers)} tone={dailyReview.losers > 0 ? "negative" : "default"} />
        <MetricCard label="Max DD" value={pct(paperAccount.maxObservedDrawdown)} tone={paperAccount.maxObservedDrawdown < -0.2 ? "negative" : "default"} />
        <MetricCard label="Real data" value={`${metadata.realDataCount}/${metadata.symbolCount}`} hint="provider-backed" />
      </section>

      <BrokerSyncPanel snapshot={alpacaPaper} />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Promotion Board</div>
            <h2 className="mt-1 text-[20px] font-semibold text-ink">Strategies currently visible on the desk</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              Every visible strategy was promoted by the radar screen, then constrained by slot count, exposure, drawdown, and concentration rules before it reached the simulated book. Ledger returns start at the local promotion price.
            </p>
          </div>
          <Link href="/radar" className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.07] px-3 py-1.5 text-[12px] text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.12]">
            Radar source
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-[12.5px]">
            <thead className="border-y border-line bg-white/[0.025] text-[10px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Desk rank</th>
                <th className="px-4 py-3 text-left">Strategy</th>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-right">Ledger return</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-left">Entry → Current</th>
                <th className="px-4 py-3 text-right">Radar score</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-left">Ledger</th>
                <th className="px-4 py-3 text-left">Latest signal</th>
                <th className="px-4 py-3 text-left">Next check</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {paperObservations.map((observation, index) => {
                const result = observation.candidate.result;
                return (
                  <tr key={observation.id} className="table-row">
                    <td className="px-4 py-3">
                      <span className="num inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/strategies/${result.strategyId}`} className="font-medium text-white hover:text-blue-300">
                        {result.strategyName}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-ink-soft">{result.strategyId}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{result.symbol}</td>
                    <td className={`num px-4 py-3 text-right ${observation.simulatedReturn >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {pct(observation.simulatedReturn)}
                    </td>
                    <td className={`num px-4 py-3 text-right ${ledgerPnl(observation) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {usd(ledgerPnl(observation))}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {observation.ledger ? (
                        <span className="num">
                          {observation.ledger.entryDate} {usd(observation.ledger.entryPrice)} → {observation.ledger.currentDate} {usd(observation.ledger.currentPrice)}
                        </span>
                      ) : (
                        <span>Backtest estimate</span>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-right text-ink">{observation.candidate.score}</td>
                    <td className="px-4 py-3"><StatusBadge status={observation.status} /></td>
                    <td className="px-4 py-3">
                      <StatusBadge status={observation.ledger ? ledgerStatusLabel(observation.ledger.source) : "backtest estimate"} />
                      {observation.ledger && <div className="mt-1 text-[11px] text-ink-soft">{observation.ledger.daysLive} days live</div>}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-ink-muted">{observation.recentSignal}</td>
                    <td className="px-4 py-3 text-ink-muted">{observation.nextCheck}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {paperObservations.length === 0 && (
          <div className="mt-5">
            <EmptyState title="No promoted strategy is live yet." message="The radar has not found a candidate that passes every promotion and concentration gate." />
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Simulated account controls</div>
            <h2 className="mt-1 text-[20px] font-semibold text-ink">Risk Budget</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              The desk can only promote strategies that fit the paper account limits. That keeps the public track record tied to the same guardrails the research engine uses.
            </p>
          </div>
          <StatusBadge status={paperAccount.riskBudgetStatus} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {paperAccount.guardrails.map((guardrail) => (
            <div key={guardrail} className="rounded-2xl border border-line bg-white/[0.035] p-3 text-[12px] leading-relaxed text-ink-muted">
              {guardrail}
            </div>
          ))}
        </div>
      </section>

      <DailyReviewPanel review={dailyReview} note={dailyReviewNote} />

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
                <MetricCard label="Ledger return" value={pct(observation.simulatedReturn)} tone={observation.simulatedReturn >= 0 ? "positive" : "negative"} />
                <MetricCard label="Score" value={String(observation.candidate.score)} tone="accent" />
                <MetricCard label="Position" value={result.metrics.currentPosition} />
                <MetricCard label="Days live" value={String(observation.ledger?.daysLive ?? 0)} />
                {observation.ledger && <MetricCard label="Ledger P&L" value={usd(observation.ledger.unrealizedPnl)} tone={observation.ledger.unrealizedPnl >= 0 ? "positive" : "negative"} />}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_0.8fr]">
                <EquityCurveChart data={result.equityCurve} />
                <div className="card p-5">
                  <div className="text-[11px] uppercase tracking-wider text-ink-soft">Recent signal</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink">{observation.recentSignal}</p>
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                    Observation uses next-open fills, {result.assumptions.slippageBps} bps slippage, and {usd(result.assumptions.feePerTrade)} per trade. No broker connection or real orders are active.
                  </p>
                  {observation.ledger && (
                    <div className="mt-4 rounded-2xl border border-line bg-white/[0.035] p-3 text-[12px] leading-relaxed text-ink-muted">
                      <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">Local paper ledger</div>
                      <p className="mt-2">
                        Promoted {observation.ledger.entryDate} at {usd(observation.ledger.entryPrice)}. Current mark is {usd(observation.ledger.currentPrice)} as of {observation.ledger.currentDate}; {observation.ledger.note}
                      </p>
                    </div>
                  )}
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

function BrokerSyncPanel({ snapshot }: { snapshot: AlpacaPaperSnapshot }) {
  const status =
    snapshot.status === "connected" ? "alpaca paper connected" :
    snapshot.status === "error" ? "alpaca sync error" : "alpaca paper disabled";
  const matchedPositions = snapshot.positions.length;
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Broker Paper Sync</div>
          <h2 className="mt-1 text-[20px] font-semibold text-ink">Alpaca paper account mirror</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            Read-only sync for Alpaca paper account, open positions, and recent orders. This desk still does not submit, cancel, or route orders.
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={status} />
          <div className="mt-1 text-[11px] text-ink-soft">{snapshot.updatedAt.slice(0, 19).replace("T", " ")} UTC</div>
        </div>
      </div>

      {snapshot.status !== "connected" ? (
        <div className="mt-5 rounded-2xl border border-line bg-white/[0.035] p-4 text-[13px] leading-relaxed text-ink-muted">
          {snapshot.message}
          <div className="mt-2 text-[11.5px] text-ink-soft">
            Configure `ALPACA_PAPER_API_KEY_ID` and `ALPACA_PAPER_API_SECRET` to enable paper sync. Base URL: {snapshot.baseUrl}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <MetricCard label="Portfolio" value={usd(snapshot.account?.portfolioValue ?? 0)} tone="accent" />
            <MetricCard label="Equity" value={usd(snapshot.account?.equity ?? 0)} />
            <MetricCard label="Cash" value={usd(snapshot.account?.cash ?? 0)} />
            <MetricCard label="Buying power" value={usd(snapshot.account?.buyingPower ?? 0)} />
            <MetricCard label="Positions" value={String(matchedPositions)} hint={snapshot.account?.status ?? "paper"} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-line">
              <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">Open paper positions</div>
              <table className="w-full min-w-[620px] text-[12.5px]">
                <thead className="border-b border-line text-[10px] uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Market value</th>
                    <th className="px-4 py-3 text-right">Unrealized</th>
                    <th className="px-4 py-3 text-left">Side</th>
                  </tr>
                </thead>
                <tbody className="divide-soft">
                  {snapshot.positions.map((position) => (
                    <tr key={position.symbol} className="table-row">
                      <td className="px-4 py-3 font-medium text-white">{position.symbol}</td>
                      <td className="num px-4 py-3 text-right">{num(position.qty, 4)}</td>
                      <td className="num px-4 py-3 text-right">{usd(position.marketValue)}</td>
                      <td className={`num px-4 py-3 text-right ${position.unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {usd(position.unrealizedPnl)} · {pct(position.unrealizedPnlPct)}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{position.side}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snapshot.positions.length === 0 && <div className="p-4 text-[12px] text-ink-muted">No open paper positions returned by Alpaca.</div>}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-line">
              <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">Recent paper orders</div>
              <table className="w-full min-w-[620px] text-[12.5px]">
                <thead className="border-b border-line text-[10px] uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-left">Side</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Filled</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-soft">
                  {snapshot.orders.map((order) => (
                    <tr key={order.id || `${order.symbol}-${order.submittedAt}`} className="table-row">
                      <td className="px-4 py-3 font-medium text-white">{order.symbol}</td>
                      <td className="px-4 py-3 text-ink-muted">{order.side}</td>
                      <td className="px-4 py-3 text-ink-muted">{order.type}</td>
                      <td className="num px-4 py-3 text-right">{num(order.filledQty, 4)} / {num(order.qty, 4)}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snapshot.orders.length === 0 && <div className="p-4 text-[12px] text-ink-muted">No recent paper orders returned by Alpaca.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function buildDeskSnapshot(observations: PaperObservation[], totalAllocatedCapital: number) {
  const live = observations.filter((observation) => observation.status === "active" || observation.status === "holding");
  const allocatedPerLive = live.length > 0 ? totalAllocatedCapital / live.length : 0;
  const bookPnl = live.reduce((sum, observation) => sum + ledgerPnl(observation, allocatedPerLive), 0);
  const base = totalAllocatedCapital > 0 ? totalAllocatedCapital : observations.length * 100_000;
  const bookReturn = base > 0 ? bookPnl / base : 0;
  const ranked = [...observations].sort((a, b) => b.simulatedReturn - a.simulatedReturn);
  return {
    bookPnl,
    bookReturn,
    bookReturnLabel: pct(bookReturn),
    bookValue: 100_000 + bookPnl,
    topWinner: ranked[0] ?? null,
    weakest: ranked[ranked.length - 1] ?? null,
  };
}

function ledgerPnl(observation: PaperObservation, fallbackCapital = 20_000): number {
  return observation.ledger?.unrealizedPnl ?? fallbackCapital * observation.simulatedReturn;
}

function ledgerStatusLabel(source: NonNullable<PaperObservation["ledger"]>["source"]): string {
  return source === "persistent" ? "ledger tracked" : source === "ephemeral" ? "new ledger" : "session estimate";
}

type DeskPillTone = "green" | "cyan" | "blue" | "amber";

const deskPillTones: Record<DeskPillTone, string> = {
  green: "border-emerald-300/22 bg-emerald-300/[0.065] text-emerald-100",
  cyan: "border-cyan-300/22 bg-cyan-300/[0.065] text-cyan-100",
  blue: "border-blue-300/22 bg-blue-300/[0.065] text-blue-100",
  amber: "border-amber-300/22 bg-amber-300/[0.06] text-amber-100",
};

function DeskPill({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  detail: string;
  tone: DeskPillTone;
}) {
  return (
    <div className={`flex min-h-[72px] items-center gap-3 rounded-2xl border p-3 ${deskPillTones[tone]}`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.055]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-white">{label}</div>
        <div className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.14em] opacity-70">{detail}</div>
      </div>
    </div>
  );
}

function SnapshotStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "accent";
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-300" :
    tone === "negative" ? "text-rose-300" :
    tone === "accent" ? "text-cyan-200" : "text-white";
  return (
    <div className="rounded-2xl border border-line bg-white/[0.035] p-3">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className={`num mt-2 text-[24px] font-semibold tracking-tight ${toneClass}`}>{value}</div>
    </div>
  );
}

function LeaderCard({ label, observation }: { label: string; observation: PaperObservation | null }) {
  if (!observation) {
    return (
      <div className="rounded-2xl border border-line bg-white/[0.03] p-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
        <div className="mt-2 text-[13px] text-ink-muted">Waiting for promotion</div>
      </div>
    );
  }
  const isWinner = observation.simulatedReturn >= 0;
  const isReviewCard = label.toLowerCase().includes("review");
  const Icon = isWinner && !isReviewCard ? Trophy : BarChart3;
  return (
    <div className="rounded-2xl border border-line bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
        <Icon className={isWinner && !isReviewCard ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-amber-200"} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-white">{observation.currentSymbol}</div>
          <div className="mt-0.5 truncate text-[11px] text-ink-soft">{observation.candidate.result.strategyName}</div>
        </div>
        <div className={`num text-[18px] font-semibold ${isWinner ? "text-emerald-300" : "text-rose-300"}`}>
          {pct(observation.simulatedReturn)}
        </div>
      </div>
      <div className="mt-2 text-[11px] text-ink-soft">Sharpe {num(observation.candidate.result.metrics.sharpe)}</div>
    </div>
  );
}
