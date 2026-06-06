import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  GraduationCap,
  LineChart,
  Network,
  Radar,
  ShieldAlert,
  Target,
  Trophy,
  WalletCards,
} from "lucide-react";
import ModuleCard from "@/components/cards/ModuleCard";
import DataSourceStatus from "@/components/research/DataSourceStatus";
import EmptyState from "@/components/research/EmptyState";
import StatusBadge from "@/components/badges/StatusBadge";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import MarketRegimeBanner from "@/components/research/MarketRegimeBanner";
import StressInsightGrid from "@/components/research/StressInsightGrid";
import SelloffMemoBlock from "@/components/research/SelloffMemoBlock";
import { getResearchDataset } from "@/lib/research";
import { sectorCount, sectorOf } from "@/data/watchlist";
import { pct, pctPlain, num } from "@/lib/utils/format";
import type { EquityPoint } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import type { RadarCandidate } from "@/types/strategy";

export const revalidate = 60 * 60;

const modules = [
  ["L0", "Data Layer", "Real Market Data", "Yahoo Finance OHLCV, adjusted-close metadata, and explicit fallback provenance.", "/data", Database],
  ["L1", "Factor Layer", "Factor Discovery", "Momentum, volatility, trend, liquidity, and regime signals across the watchlist.", "/factors", Network],
  ["L2", "Strategy & Backtest", "AI Strategy Generation", "Rule logic, next-open execution assumptions, metrics, drawdown, and trades.", "/strategies", LineChart],
  ["L3", "Strategy Radar", "Radar Screening", "Composite ranking, rejection rules, and paper-observation promotion logic.", "/radar", Radar],
  ["L4", "AI Market Intelligence", "Market Intelligence", "AI-style market memo generated from factor breadth and backtest evidence.", "/ai-market", BrainCircuit],
  ["L5", "Paper Observation", "Simulated Observation", "Research-only paper monitoring for radar-approved strategies. No live orders.", "/paper-trading", WalletCards],
  ["L6", "Public Track Record", "Shareable Receipt", "Ledger-backed paper performance for outside viewers. Simulation only.", "/track-record", Trophy],
] as const;

const engineStrip = [
  ["Yahoo Finance", "Live", Database],
  ["Watchlist", "Synced", Network],
  ["Market Data", "Adjusted", LineChart],
  ["Factor Engine", "Online", BrainCircuit],
  ["Backtest Engine", "Cost-aware", Target],
  ["Radar Engine", "Scoring", Radar],
] as const;

export default async function HomePage() {
  const dataset = await getResearchDataset();
  const top = dataset.radarCandidates.slice(0, 4);
  const best = top[0];
  const priceResults = Object.values(dataset.pricesBySymbol);
  const marketMovers = buildMarketMovers(priceResults);
  const realCount = priceResults.filter((item) => !item.isFallback).length;
  const fallbackCount = priceResults.length - realCount;
  const paper = dataset.paperObservations[0];
  const radarCandidateCount = dataset.radarCandidates.filter((item) => item.status === "radar candidate").length;
  const observingCount = dataset.radarCandidates.filter((item) => item.status === "continue observing").length;
  const rejectedCount = dataset.radarCandidates.filter((item) => item.status === "rejected").length;
  const shortlistedCount = radarCandidateCount + observingCount;
  const avgScore = top.length > 0 ? Math.round(top.reduce((sum, item) => sum + item.score, 0) / top.length) : 0;
  const conc = dataset.signalConcentration;
  const sectorBreadth = sectorCount();
  const universeSize = priceResults.length;
  // Real, engine-derived insights — market-summary prose + the live concentration finding.
  const aiInsights = [
    dataset.marketSummary.summary,
    dataset.marketSummary.risk,
    conc ? `${conc.strategyCount} screened strategies behave like ~${conc.effectiveStrategies.toFixed(1)} independent bets (${conc.level} overlap).` : null,
    dataset.marketSummary.highlights[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  return (
    <div className="mx-auto max-w-[1760px] space-y-5">
      <section className="hero-shell p-6 md:p-8">
        <div className="relative grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
              Open-source AI-assisted quant research workbench
            </div>
            <h1 className="mt-4 max-w-4xl text-[40px] font-semibold leading-[0.98] tracking-[-0.045em] text-white md:text-[64px]">
              Factor signals, backtests, portfolios, and research memos in one reusable lab.
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ink-muted">
              FactorForge is an open-source AI-assisted quant research workbench for factor signals, cost-aware backtests, portfolio construction, risk diagnostics, paper observation, and research memo generation.
            </p>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
              Built for researchers, maintainers, and contributors who need deterministic metrics, visible data provenance, safe public demo behavior, and reviewable workflows.
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/[0.07] px-3.5 py-1.5 text-[12.5px] text-cyan-100 transition-colors hover:border-cyan-300/55 hover:bg-cyan-300/[0.12]"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              New to stocks? Start with Stocks 101 — every term in plain English
              <span aria-hidden>→</span>
            </Link>
            <div className="mt-6 grid grid-cols-2 gap-2 text-[12px] text-ink-muted">
              <EvidencePill label="Open-source research workbench" tone="green" />
              <EvidencePill label="Real or clearly labeled fallback data" />
              <EvidencePill label="No broker connection" tone="amber" />
              <EvidencePill label="No live trading" tone="amber" />
              <EvidencePill label="CI + 175 tests" />
              <EvidencePill label="Contributor-ready" tone="green" />
            </div>
            <div className="mt-6 rounded-2xl border border-amber-300/18 bg-amber-300/[0.045] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/70">Why the demo is safe and maintainable</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                No hardcoded returns. Metrics are calculated from OHLCV backtests, optional keys degrade to labeled fallback/template mode, and maintainer docs cover CI, releases, security policy, issue triage, and PR review.
              </p>
            </div>
          </div>
          <LiveResearchCase candidate={best} fallbackCount={fallbackCount} />
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroStat label="Real data" value={`${realCount}/${priceResults.length}`} detail="active sources" />
          <HeroStat label="Independent bets" value={conc ? `~${conc.effectiveStrategies.toFixed(1)}` : "—"} detail={conc ? `of ${conc.strategyCount} screened` : "mega-cap + ETFs"} />
          <HeroStat label="Radar candidates" value={String(radarCandidateCount)} detail="rule-screened" />
          <HeroStat label="Paper watch" value={String(dataset.paperObservations.length)} detail="simulation only" />
        </div>
      </section>

      <MarketRegimeBanner report={dataset.marketStress} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.86fr]">
        <MarketPerformancePanel movers={marketMovers} />
        <section className="card p-4">
          <SectionHeader title="How This Works" label="Compact evidence pipeline for visitors" href="/reports" compact />
          <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2">
            {["1. Fetch real OHLCV", "2. Build factors", "3. Generate signals", "4. Run backtest", "5. Score radar", "6. Observe in paper"].map((step, index) => (
              <div key={step} className="rounded-xl border border-line bg-white/[0.035] p-3">
                <div className="text-[12px] font-semibold text-white">{step}</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
                  {[
                    "Yahoo Finance daily bars with provider and fallback metadata.",
                    "Momentum, volatility, volume, RSI, and trend breadth snapshots.",
                    "Rule-based VCP, ATR breakout, pullback, EMA continuation, and rotation logic.",
                    "Next-open fills, fees, slippage, stops, drawdown, and trade logs.",
                    "Annualized return, Sharpe, drawdown, win rate, sample size, and risk penalties.",
                    "Only radar-approved strategies enter simulated observation; no real orders.",
                  ][index]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <MethodologyCallout
        title="Workbench guardrails"
        items={[
          "What it is: an OSS research workbench for inspecting factor and backtest evidence.",
          "Who it is for: researchers, contributors, and maintainers reviewing quant logic and data provenance.",
          "What it does: fetches daily OHLCV, computes factors, runs rule-based backtests, ranks candidates, builds portfolio diagnostics, and drafts memos.",
          "Why it is safe: no broker connection, no live trading, and no financial-advice workflow.",
          "Why it is maintainable: CI, tests, issue templates, release checklist, security policy, and maintainer backlog are documented.",
          "Fallback policy: real data is preferred; fallback/demo data and template memos are labeled.",
        ]}
      />

      <section className="space-y-3">
        <SectionHeader title="6-Layer Research Architecture" label="Production workflow map" href="/reports" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {modules.map(([layer, label, title, description, href, Icon], index) => (
            <div key={href} className="relative">
              <ModuleCard
                layer={layer}
                label={label}
                title={title}
                description={description}
                href={href}
                status={index === 0 ? `${realCount} real · ${fallbackCount} fallback` : "Operational"}
                metric={index === 1 ? `${dataset.factors.length} symbols` : index === 2 ? `${dataset.strategyResults.length} models` : index === 3 ? `${radarCandidateCount} candidates` : undefined}
                icon={Icon}
              />
              {index < modules.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-cyan-200/45 xl:block" />}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <SectionHeader title="Data Source Status" label="Provider provenance is visible on every result" href="/data" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {engineStrip.map(([label, status, Icon]) => (
            <div key={label} className="rounded-2xl border border-line bg-white/[0.035] p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/25 bg-blue-300/10">
                  <Icon className="h-5 w-5 text-blue-200" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{label}</div>
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {priceResults.slice(0, 2).map((result) => (
            <div key={result.symbol} className="rounded-2xl border border-line bg-white/[0.025] p-3">
              <DataSourceStatus result={result} />
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="card overflow-hidden xl:col-span-6">
          <SectionHeader title="Top Strategies" label="Ranked by evidence, risk, and radar score" href="/strategies" compact />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead className="border-y border-line bg-white/[0.025] text-[10px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-right">Annual</th>
                  <th className="px-4 py-3 text-right">Max DD</th>
                  <th className="px-4 py-3 text-right">Sharpe</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-left">Curve</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-soft">
                {top.map((candidate) => (
                  <tr key={candidate.result.strategyId} className="table-row">
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
                    <td className="px-4 py-3"><MiniCurve data={candidate.result.equityCurve} /></td>
                    <td className="px-4 py-3"><StatusBadge status={candidate.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {top.length === 0 && <div className="p-4"><EmptyState title="No strategy results yet" message="Backtests will appear after the data pipeline returns usable OHLCV data." /></div>}
        </div>

        <div className="card p-4 xl:col-span-3">
          <SectionHeader title="Radar Summary" label="Screening funnel" href="/radar" compact />
          <div className="mt-4 grid grid-cols-4 divide-x divide-line rounded-xl border border-line bg-white/[0.025] py-3 text-center">
            <RadarStat label="Total" value={dataset.radarCandidates.length} />
            <RadarStat label="Shortlist" value={shortlistedCount} />
            <RadarStat label="Radar" value={radarCandidateCount} />
            <RadarStat label="Paper" value={dataset.paperObservations.length} />
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Universe", dataset.radarCandidates.length, "100%"],
              ["Shortlisted", shortlistedCount, `${Math.round((shortlistedCount / Math.max(dataset.radarCandidates.length, 1)) * 100)}%`],
              ["Radar candidates", radarCandidateCount, `${Math.round((radarCandidateCount / Math.max(dataset.radarCandidates.length, 1)) * 100)}%`],
              ["Rejected", rejectedCount, `${Math.round((rejectedCount / Math.max(dataset.radarCandidates.length, 1)) * 100)}%`],
            ].map(([label, value, percent]) => (
              <div key={String(label)}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-ink-muted">{label}</span>
                  <span className="num text-ink">{value} · {percent}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-blue-400" style={{ width: String(percent) }} />
                </div>
              </div>
            ))}
          </div>
          {dataset.signalConcentration && (
            <div
              className={[
                "mt-5 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-[12px]",
                dataset.signalConcentration.level === "high"
                  ? "border-rose-300/30 bg-rose-300/[0.06] text-rose-100"
                  : dataset.signalConcentration.level === "medium"
                    ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-100"
                    : "border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-100",
              ].join(" ")}
            >
              <span className="uppercase tracking-wider text-ink-soft">Diversification</span>
              <span className="num text-right">
                {dataset.signalConcentration.strategyCount} screened ≈{" "}
                {dataset.signalConcentration.effectiveStrategies.toFixed(1)} independent bets ·{" "}
                {dataset.signalConcentration.level} overlap
              </span>
            </div>
          )}
        </div>

        <div className="card p-4 xl:col-span-4">
          <SectionHeader title="Paper Observation" label="Simulation only" href="/paper-trading" compact />
          {paper ? (
            <div>
              <div className="mt-4 grid grid-cols-4 divide-x divide-line rounded-xl border border-line bg-white/[0.025] py-3 text-center">
                <RadarStat label="Watching" value={dataset.paperObservations.length} />
                <RadarStat label="Return" value={pct(paper.simulatedReturn)} />
                <RadarStat label="Exposure" value={pctPlain(dataset.paperAccount.exposurePct)} />
                <RadarStat label="Risk" value={dataset.paperAccount.riskBudgetStatus} />
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
                <div className="mt-3 rounded-lg border border-line bg-white/[0.025] px-3 py-2 text-[12px] text-ink-muted">
                  Account guardrail: {dataset.paperAccount.guardrails[2]} Current max observed drawdown is {pct(dataset.paperAccount.maxObservedDrawdown)}.
                </div>
                <div className="mt-4"><MiniCurve data={paper.candidate.result.equityCurve} wide /></div>
              </div>
            </div>
          ) : (
            <EmptyState title="Strategy is online and waiting" message="No radar candidate has been admitted into paper observation yet." />
          )}
        </div>
      </section>

      <section className="card p-4">
        <SectionHeader title="AI Market Insight — Stress Lens" label="Regime-aware research cards derived from live factor and backtest evidence" href="/ai-market" />
        <div className="mt-2 px-0">
          <StressInsightGrid cards={dataset.stressInsights} />
        </div>
      </section>

      <SelloffMemoBlock memo={dataset.selloffMemo} />

      <section className="card p-4">
        <SectionHeader title="AI Market Insight" label="AI-style research summary from factor and backtest evidence" href="/ai-market" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {aiInsights.map((detail, index) => {
            const Icon = [Target, Network, LineChart, ShieldAlert][index] ?? BrainCircuit;
            return (
            <div key={detail} className="rounded-xl border border-blue-300/20 bg-blue-300/[0.055] p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-current/25">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Insight {index + 1}</div>
                  <div className="mt-0.5 text-[12px] text-ink-muted">Derived from live metrics</div>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>
            </div>
          )})}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, label, href, compact = false }: { title: string; label: string; href: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${compact ? "px-4 py-4" : ""}`}>
      <div>
        <div className="panel-title">{title}</div>
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

function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft">{label}</div>
      <div className="num mt-2 text-[26px] font-semibold text-white">{value}</div>
      <div className="mt-1 text-[12px] text-ink-muted">{detail}</div>
    </div>
  );
}

function EvidencePill({ label, tone = "blue" }: { label: string; tone?: "blue" | "green" | "amber" }) {
  const cls = tone === "green"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
    : tone === "amber"
      ? "border-amber-300/35 bg-amber-400/10 text-amber-100"
      : "border-white/10 bg-white/[0.045] text-blue-100";
  return (
    <div className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${cls}`}>
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function LiveResearchCase({ candidate, fallbackCount }: { candidate: RadarCandidate | undefined; fallbackCount: number }) {
  if (!candidate) {
    return (
      <div className="rounded-3xl border border-blue-300/20 bg-blue-300/[0.045] p-5">
        <EmptyState title="No radar evidence yet" message="Strategy evidence appears after the research pipeline has usable OHLCV data." />
      </div>
    );
  }

  const result = candidate.result;
  const latestEquity = result.equityCurve[result.equityCurve.length - 1]?.equity ?? result.assumptions.initialCapital;
  const caseSteps = [
    ["01", "Fetch", `${result.symbol} · 3Y Yahoo OHLCV`],
    ["02", "Signal", `${result.signals.length} rule-generated signals`],
    ["03", "Backtest", "Next-open fills, fees, slippage, stops"],
    ["04", "Decide", `${candidate.status} · score ${candidate.score}`],
  ] as const;

  return (
    <div className="hero-showcase relative min-h-[540px] overflow-hidden p-5">
      <div className="absolute inset-x-5 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/24 to-transparent" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-blue-200/80">Live research case</div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="num text-[60px] font-semibold leading-none tracking-[-0.07em] text-white md:text-[82px]">{result.symbol}</div>
            <div className="pb-2">
              <div className="text-[15px] font-semibold text-white">{result.strategyName}</div>
              <div className="mt-1 text-[12px] text-ink-muted">{result.dataStatus.provider} · {result.dataStatus.isFallback ? "fallback labeled" : "real market data"}</div>
            </div>
          </div>
        </div>
        <StatusBadge status={fallbackCount === 0 ? "real data active" : `${fallbackCount} fallback labeled`} />
      </div>

      <div className="relative mt-5 rounded-3xl border border-cyan-300/16 bg-black/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">Backtested equity curve</div>
            <div className="num mt-1 text-[24px] font-semibold text-white">${Math.round(latestEquity).toLocaleString("en-US")}</div>
          </div>
          <Link href={`/strategies/${result.strategyId}`} className="rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1.5 text-[12px] text-blue-100 hover:bg-blue-400/15">
            Open case
          </Link>
        </div>
        <HeroCurve data={result.equityCurve} />
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CaseMetric label="Annualized" value={pct(result.metrics.annualizedReturn)} tone="positive" />
        <CaseMetric label="Sharpe" value={num(result.metrics.sharpe)} />
        <CaseMetric label="Max DD" value={pct(result.metrics.maxDrawdown)} tone="negative" />
        <CaseMetric label="Win rate" value={pctPlain(result.metrics.winRate)} />
      </div>

      <div className="relative mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
        {caseSteps.map(([step, label, detail], index) => (
          <div key={step} className="rounded-2xl border border-line bg-white/[0.035] p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-[10px] font-semibold text-cyan-100">{step}</span>
              <span className="text-[12px] font-semibold text-white">{label}</span>
              {index < caseSteps.length - 1 && <ArrowRight className="ml-auto hidden h-3.5 w-3.5 text-cyan-200/50 md:block" />}
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">{detail}</div>
          </div>
        ))}
      </div>

      <div className="relative mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-[12px] leading-relaxed text-emerald-50/85">
        Decision output: {candidate.nextAction}. This is simulated research evidence only, not a trading recommendation.
      </div>
    </div>
  );
}

function CaseMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const cls = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">{label}</div>
      <div className={`num mt-2 text-[25px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function HeroCurve({ data }: { data: EquityPoint[] }) {
  const sampled = data.filter((_, index) => index % Math.max(1, Math.floor(data.length / 80)) === 0 || index === data.length - 1);
  const values = sampled.map((point) => point.equity);
  const benchmarkValues = sampled.map((point) => point.benchmarkEquity);
  const allValues = [...values, ...benchmarkValues];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const toPoints = (series: number[]) => series.map((value, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * 1000;
    const y = 260 - ((value - min) / range) * 220;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mt-3">
      <svg viewBox="0 0 1000 280" className="h-[220px] w-full">
        <defs>
          <linearGradient id="heroCurveFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.38)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </linearGradient>
          <filter id="heroCurveGlow" x="-10%" y="-25%" width="120%" height="150%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line x1="0" x2="1000" y1="260" y2="260" stroke="rgba(148,163,184,0.22)" />
        <line x1="0" x2="1000" y1="150" y2="150" stroke="rgba(148,163,184,0.15)" strokeDasharray="8 10" />
        <line x1="0" x2="1000" y1="62" y2="62" stroke="rgba(251,191,36,0.12)" strokeDasharray="6 12" />
        <polyline points={toPoints(benchmarkValues)} fill="none" stroke="rgba(148,163,184,0.55)" strokeWidth="4" strokeDasharray="10 10" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,260 ${toPoints(values)} 1000,260`} fill="url(#heroCurveFill)" />
        <polyline points={toPoints(values)} fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" filter="url(#heroCurveGlow)" />
        <polyline points={toPoints(values)} fill="none" stroke="#67e8f9" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        {values.length > 0 && (
          <>
            <circle cx="1000" cy={260 - ((values[values.length - 1] - min) / range) * 220} r="12" fill="rgba(34,211,238,0.18)" />
            <circle cx="1000" cy={260 - ((values[values.length - 1] - min) / range) * 220} r="6" fill="#fbbf24" />
          </>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-soft">
        <span>Strategy equity</span>
        <span>Dashed line = benchmark</span>
      </div>
    </div>
  );
}

interface MarketMover {
  symbol: string;
  oneDay: number;
  fiveDay: number;
  isFallback: boolean;
}

function buildMarketMovers(results: HistoricalPriceResult[]): MarketMover[] {
  return results
    .map((result) => {
      const prices = result.prices;
      const last = prices[prices.length - 1];
      const previous = prices[prices.length - 2];
      const fiveAgo = prices[prices.length - 6];
      if (!last || !previous || !fiveAgo) return null;
      return {
        symbol: result.symbol,
        oneDay: last.close / previous.close - 1,
        fiveDay: last.close / fiveAgo.close - 1,
        isFallback: result.isFallback,
      };
    })
    .filter((item): item is MarketMover => item !== null)
    .sort((a, b) => b.fiveDay - a.fiveDay);
}

function MarketPerformancePanel({ movers }: { movers: MarketMover[] }) {
  const maxAbs = Math.max(...movers.map((item) => Math.abs(item.fiveDay)), 0.01);
  const bestOneDay = [...movers].sort((a, b) => b.oneDay - a.oneDay)[0];
  const bestFiveDay = movers[0];
  const fallbackCount = movers.filter((item) => item.isFallback).length;
  const sectorsCovered = sectorCount();
  // movers is sorted by 5D desc. Show the 6 strongest + 4 weakest so the panel
  // stays compact while still surfacing both leaders and laggards across sectors.
  const topMovers = movers.length > 12
    ? [...movers.slice(0, 6), ...movers.slice(-4)]
    : movers;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="panel-title">Sector-Diversified Market Pulse</div>
          <div className="mt-0.5 text-[11px] text-ink-soft">{movers.length} US names across {sectorsCovered} sectors, calculated from latest OHLCV close data</div>
        </div>
        <StatusBadge status={fallbackCount === 0 ? "real data active" : `${fallbackCount} fallback labeled`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <HeroStat label="Top 1D move" value={bestOneDay ? `${bestOneDay.symbol} ${pct(bestOneDay.oneDay)}` : "N/A"} detail="latest close vs prior close" />
        <HeroStat label="Top 5D move" value={bestFiveDay ? `${bestFiveDay.symbol} ${pct(bestFiveDay.fiveDay)}` : "N/A"} detail="latest close vs 5 sessions ago" />
        <HeroStat label="Universe" value={String(movers.length)} detail={`${sectorsCovered} sectors · single-name + ETF benchmarks`} />
        <HeroStat label="Fallback" value={String(fallbackCount)} detail="always disclosed" />
      </div>
      <div className="mt-5 grid grid-cols-[56px_1fr_88px_76px_76px] gap-3 border-y border-line py-2 text-[10px] uppercase tracking-wider text-ink-soft">
        <span>Symbol</span>
        <span>5D relative move</span>
        <span>Sector</span>
        <span className="text-right">1D</span>
        <span className="text-right">5D</span>
      </div>
      <div className="mt-3 space-y-2">
        {topMovers.map((item) => {
          const width = `${Math.max(4, (Math.abs(item.fiveDay) / maxAbs) * 100)}%`;
          const positive = item.fiveDay >= 0;
          return (
            <div key={item.symbol} className="grid grid-cols-[56px_1fr_88px_76px_76px] items-center gap-3 text-[12px]">
              <div className="font-semibold text-white">{item.symbol}</div>
              <div className="h-2.5 rounded-full bg-white/[0.06]">
                <div className={`h-2.5 rounded-full ${positive ? "bg-emerald-300" : "bg-rose-300"}`} style={{ width }} />
              </div>
              <div className="truncate text-[11px] text-ink-soft">{sectorOf(item.symbol) ?? "—"}</div>
              <div className={`num text-right ${item.oneDay >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(item.oneDay)}</div>
              <div className={`num text-right ${positive ? "text-emerald-300" : "text-rose-300"}`}>{pct(item.fiveDay)}</div>
            </div>
          );
        })}
      </div>
      {movers.length > topMovers.length && (
        <div className="mt-3 text-[11px] text-ink-soft">
          Showing the {topMovers.length} largest 5-day movers of {movers.length} names. Full table on the{" "}
          <Link href="/data" className="text-blue-300 hover:text-blue-200">Data</Link> page.
        </div>
      )}
    </section>
  );
}

function MiniCurve({ data, wide = false }: { data: EquityPoint[]; wide?: boolean }) {
  const sampled = data.filter((_, index) => index % Math.max(1, Math.floor(data.length / 18)) === 0 || index === data.length - 1);
  const values = sampled.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 34 - ((value - min) / range) * 28;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 40" className={wide ? "h-16 w-full" : "h-10 w-24"}>
      <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="0" x2="100" y1="34" y2="34" stroke="rgba(120,149,184,0.18)" />
    </svg>
  );
}
