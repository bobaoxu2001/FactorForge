import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  LineChart,
  Network,
  Radar,
  ShieldAlert,
  Target,
  WalletCards,
} from "lucide-react";
import ModuleCard from "@/components/cards/ModuleCard";
import DataSourceStatus from "@/components/research/DataSourceStatus";
import EmptyState from "@/components/research/EmptyState";
import StatusBadge from "@/components/badges/StatusBadge";
import { getResearchDataset } from "@/lib/research";
import { pct, num } from "@/lib/utils/format";

export const revalidate = 60 * 60;

const modules = [
  ["L0", "Data", "Real Market Data", "Yahoo chart API OHLCV with explicit fallback labeling.", "/data"],
  ["L1", "Factors", "Factor Layer", "Momentum, volatility, RSI, volume surge, and SMA200 trend.", "/factors"],
  ["L2", "Strategy", "Strategy & Backtest", "Rule signals, trades, equity curves, metrics, and risk flags.", "/strategies"],
  ["L3", "Radar", "Strategy Radar", "Scores, ranks, promotes, and rejects strategies using real metrics.", "/radar"],
  ["L4", "AI Market", "Market Intelligence", "Deterministic market read generated from the default watchlist.", "/ai-market"],
  ["L5", "Paper", "Paper Observation", "Simulated observation for radar candidates only; no real orders.", "/paper-trading"],
] as const;

const dataIcons = [Database, Network, LineChart, Radar, BrainCircuit, WalletCards];

export default async function HomePage() {
  const dataset = await getResearchDataset();
  const top = dataset.radarCandidates.slice(0, 4);
  const best = top[0];
  const priceResults = Object.values(dataset.pricesBySymbol);
  const realCount = priceResults.filter((item) => !item.isFallback).length;
  const fallbackCount = priceResults.length - realCount;
  const paper = dataset.paperObservations[0];
  const radarCandidateCount = dataset.radarCandidates.filter((item) => item.status === "radar candidate").length;
  const observingCount = dataset.radarCandidates.filter((item) => item.status === "continue observing").length;
  const rejectedCount = dataset.radarCandidates.filter((item) => item.status === "rejected").length;

  return (
    <div className="mx-auto max-w-[1720px] space-y-4">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-soft">AI Quant Research Platform</div>
          <h1 className="mt-3 max-w-4xl text-[32px] font-semibold leading-tight tracking-tight text-white md:text-[42px]">
            Stock Factor Mining & Strategy Simulation Platform
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
            {["Real data", "Factor mining", "Strategy rules", "Backtest metrics", "Radar screening", "Paper observation"].map((step, index, items) => (
              <span key={step} className="inline-flex items-center gap-2">
                <span>{step}</span>
                {index < items.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-ink-soft" />}
              </span>
            ))}
          </div>
        </div>
        <div className="card flex min-w-[280px] items-center gap-3 p-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-500/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider text-ink-soft">Pipeline health</div>
            <div className="mt-0.5 text-[14px] font-semibold text-white">{realCount}/{priceResults.length} real data sources active</div>
            <div className="mt-0.5 text-[11px] text-ink-soft">Generated {new Date(dataset.metadata.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-[13px] font-semibold text-white">Six-Layer Research Architecture</div>
          <span className="text-[12px] text-ink-soft">Live modules</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {modules.map(([layer, label, title, description, href], index) => (
            <div key={href} className="relative">
              <ModuleCard layer={layer} label={label} title={title} description={description} href={href} status={index === 0 ? `${realCount} real · ${fallbackCount} fallback` : "Open module"} />
              {index < modules.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-ink-soft xl:block" />}
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-6">
        <div className="card p-4 xl:col-span-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-[13px] font-semibold text-white">Data Source Status</div>
            <span className="text-[12px] text-ink-soft">Provider provenance is visible on every result</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            {priceResults.slice(0, 6).map((result, index) => {
              const Icon = dataIcons[index] ?? Database;
              return (
                <div key={result.symbol} className="rounded-xl border border-line bg-white/[0.035] p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg border border-blue-400/30 bg-blue-500/10">
                      <Icon className="h-5 w-5 text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{result.symbol}</div>
                      <div className="truncate text-[11px] text-ink-soft">{result.provider}</div>
                    </div>
                    <span className={`ml-auto h-2 w-2 rounded-full ${result.isFallback ? "bg-amber-400" : "bg-emerald-400"}`} />
                  </div>
                  <div className="mt-3">
                    <DataSourceStatus result={result} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="card overflow-hidden xl:col-span-5">
          <PanelHeader title="Priority Strategies" label="Real backtest results" href="/strategies" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12.5px]">
              <thead className="border-y border-line bg-white/[0.025] text-[10px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-right">Annual</th>
                  <th className="px-4 py-3 text-right">Max DD</th>
                  <th className="px-4 py-3 text-right">Sharpe</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-soft">
                {top.map((candidate) => (
                  <tr key={candidate.result.strategyId}>
                    <td className="px-4 py-3">
                      <Link href={`/strategies/${candidate.result.strategyId}`} className="font-medium text-white hover:text-blue-300">
                        {candidate.result.strategyName}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-ink-soft">{candidate.result.symbol}</div>
                    </td>
                    <td className="num px-4 py-3 text-right text-emerald-300">{pct(candidate.result.metrics.annualizedReturn)}</td>
                    <td className="num px-4 py-3 text-right text-rose-300">{pct(candidate.result.metrics.maxDrawdown)}</td>
                    <td className="num px-4 py-3 text-right text-ink">{num(candidate.result.metrics.sharpe)}</td>
                    <td className="num px-4 py-3 text-right text-ink">{candidate.score}</td>
                    <td className="px-4 py-3"><StatusBadge status={candidate.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {top.length === 0 && <div className="p-4"><EmptyState title="No strategy results yet" message="Backtests will appear after the data pipeline returns usable OHLCV data." /></div>}
        </div>

        <div className="card p-4 xl:col-span-3">
          <PanelHeader title="Strategy Radar" label="Screening summary" href="/radar" />
          <div className="mt-4 grid grid-cols-4 divide-x divide-line rounded-xl border border-line bg-white/[0.025] py-3 text-center">
            <RadarStat label="Total" value={dataset.radarCandidates.length} />
            <RadarStat label="Candidate" value={radarCandidateCount} />
            <RadarStat label="Observe" value={observingCount} />
            <RadarStat label="Rejected" value={rejectedCount} />
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Adjusted price sources", dataset.metadata.adjustedCount, `${Math.round((dataset.metadata.adjustedCount / Math.max(dataset.metadata.symbolCount, 1)) * 100)}%`],
              ["Radar candidates", radarCandidateCount, `${Math.round((radarCandidateCount / Math.max(dataset.radarCandidates.length, 1)) * 100)}%`],
              ["Continue observing", observingCount, `${Math.round((observingCount / Math.max(dataset.radarCandidates.length, 1)) * 100)}%`],
              ["Rejected", rejectedCount, `${Math.round((rejectedCount / Math.max(dataset.radarCandidates.length, 1)) * 100)}%`],
            ].map(([label, value, percent]) => (
              <div key={String(label)}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-ink-muted">{label}</span>
                  <span className="num text-ink">{value} · {percent}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className="h-2 rounded-full bg-blue-500/75" style={{ width: String(percent) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 xl:col-span-4">
          <PanelHeader title="Paper Observation" label="Simulation only" href="/paper-trading" />
          {paper ? (
            <div>
              <div className="mt-4 grid grid-cols-4 divide-x divide-line rounded-xl border border-line bg-white/[0.025] py-3 text-center">
                <RadarStat label="Watching" value={dataset.paperObservations.length} />
                <RadarStat label="Return" value={pct(paper.simulatedReturn)} />
                <RadarStat label="Trades" value={paper.candidate.result.metrics.tradeCount} />
                <RadarStat label="Sharpe" value={num(paper.candidate.result.metrics.sharpe)} />
              </div>
              <div className="mt-4 rounded-xl border border-line bg-white/[0.025] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] uppercase tracking-wider text-ink-soft">Current strategy</div>
                    <div className="mt-1 font-semibold text-white">{paper.candidate.result.strategyName}</div>
                    <div className="mt-1 text-[12px] text-ink-muted">{paper.currentSymbol} · {paper.status}</div>
                  </div>
                  <StatusBadge status={paper.status} />
                </div>
                <div className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">{paper.recentSignal}</div>
              </div>
            </div>
          ) : (
            <EmptyState title="Strategy is online and waiting" message="No radar candidate has been admitted into paper observation yet." />
          )}
        </div>
      </section>

      <section className="card p-4">
        <PanelHeader title="AI Market Read" label="Deterministic from factors" href="/ai-market" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Market regime", value: dataset.marketSummary.tone, detail: dataset.marketSummary.summary, Icon: Target, tone: "blue" },
            { title: "Factor preference", value: best ? `${best.result.type} bias` : "Pending", detail: best ? best.result.recommendation : "Waiting for backtest output.", Icon: Network, tone: "emerald" },
            { title: "Volatility state", value: "Measured regime", detail: dataset.marketSummary.risk, Icon: LineChart, tone: "purple" },
            { title: "Risk control", value: "Research only", detail: "No broker connection. Paper observation is simulation-only.", Icon: ShieldAlert, tone: "amber" },
          ].map(({ title, value, detail, Icon, tone }) => (
            <div key={String(title)} className={`rounded-xl border p-4 ${
              tone === "emerald" ? "border-emerald-400/25 bg-emerald-500/10" :
              tone === "purple" ? "border-purple-400/25 bg-purple-500/10" :
              tone === "amber" ? "border-amber-400/25 bg-amber-500/10" :
              "border-blue-400/25 bg-blue-500/10"
            }`}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-current/25">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{title}</div>
                  <div className="mt-0.5 text-[12px] text-ink-muted">{value}</div>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PanelHeader({ title, label, href }: { title: string; label: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[14px] font-semibold text-white">{title}</div>
        <div className="mt-0.5 text-[11px] text-ink-soft">{label}</div>
      </div>
      <Link href={href} className="text-[12px] text-blue-300 hover:text-blue-200">View all ›</Link>
    </div>
  );
}

function RadarStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="num text-[19px] font-semibold text-white">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-soft">{label}</div>
    </div>
  );
}
