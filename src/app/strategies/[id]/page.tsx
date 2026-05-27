import Link from "next/link";
import { notFound } from "next/navigation";
import { BrainCircuit, FlaskConical, ListChecks, ShieldAlert } from "lucide-react";
import DrawdownChart from "@/components/charts/DrawdownChart";
import EquityCurveChart from "@/components/charts/EquityCurveChart";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import DataSourceStatus from "@/components/research/DataSourceStatus";
import BacktestChecklist from "@/components/research/BacktestChecklist";
import StrategySignalPanel from "@/components/research/StrategySignalPanel";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { generateStrategyExplanation } from "@/lib/ai/strategyExplainer";
import { getStrategyResult } from "@/lib/research";
import { num, pct, usd } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export function generateStaticParams() {
  return STRATEGY_CATALOG.map((strategy) => ({ id: strategy.id }));
}

export default async function StrategyDetailPage({ params }: { params: { id: string } }) {
  const result = await getStrategyResult(params.id);
  if (!result) notFound();
  const explanation = generateStrategyExplanation(result);

  return (
    <div className="space-y-8">
      <Link href="/strategies" className="text-[12px] text-ink-muted hover:text-ink">← Back to strategies</Link>
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">{result.type} · {result.symbol}</div>
        <h1 className="mt-2 text-[30px] font-semibold text-ink">{result.strategyName}</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">{result.description}</p>
        <div className="mt-4"><DataSourceStatus result={result.dataStatus} /></div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10">
              <BrainCircuit className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <div className="section-label">AI Strategy Thesis</div>
              <h2 className="mt-1 text-[20px] font-semibold text-white">{result.strategyName}</h2>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">{explanation.thesis}</p>
          <div className="mt-4 rounded-2xl border border-line bg-white/[0.035] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Model Reasoning Summary</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{explanation.modelReasoning}</p>
          </div>
        </div>
        <div className="card p-5">
          <div className="section-label">AI Confidence Score</div>
          <div className="mt-3 flex items-end justify-between">
            <div className="num text-[54px] font-semibold leading-none text-white">{explanation.confidenceScore}</div>
            <StatusBadge status={`${explanation.confidenceLevel} confidence`} />
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
            <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" style={{ width: `${explanation.confidenceScore}%` }} />
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
            Deterministic AI-style memo. No external LLM API is connected in this demo build.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total return" value={pct(result.metrics.totalReturn)} tone="positive" />
        <MetricCard label="Annualized" value={pct(result.metrics.annualizedReturn)} tone="positive" />
        <MetricCard label="Benchmark" value={pct(result.metrics.benchmarkReturn)} />
        <MetricCard label="Excess" value={pct(result.metrics.excessReturn)} tone="accent" />
        <MetricCard label="Max drawdown" value={pct(result.metrics.maxDrawdown)} />
        <MetricCard label="Sharpe" value={num(result.metrics.sharpe)} />
        <MetricCard label="Win rate" value={pct(result.metrics.winRate)} />
        <MetricCard label="Trades" value={String(result.metrics.tradeCount)} />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2"><EquityCurveChart data={result.equityCurve} /></div>
        <div className="space-y-5">
          <StrategySignalPanel result={result} />
          <div className="card p-5">
            <div className="text-[11px] uppercase tracking-wider text-ink-soft">AI Research Memo</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">{explanation.summary}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{explanation.whyItWorks}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-rose-200">{explanation.keyRisks}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-blue">{explanation.nextStep}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DrawdownChart data={result.equityCurve} />
        <BacktestChecklist result={result} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ResearchPanel icon={ListChecks} title="Rule Logic" items={[
          "Generate signals only from completed daily bars.",
          "Fill entries at the next bar open with modeled slippage and fees.",
          "Exit via stop loss, trailing stop, holding-period expiry, or strategy sell condition.",
        ]} />
        <ResearchPanel icon={ShieldAlert} title="Risk Flags" items={result.riskFlags.length > 0 ? result.riskFlags : ["No major model risk flag is triggered, but validation is still required."]} />
        <ResearchPanel icon={FlaskConical} title="Suggested Next Experiments" items={explanation.suggestedExperiments} />
      </section>

      <section className="card p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">Backtest assumptions</div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Execution" value="next open" />
          <MetricCard label="Position size" value={pct(result.assumptions.positionFraction)} />
          <MetricCard label="Slippage" value={`${num(result.assumptions.slippageBps, 0)} bps`} />
          <MetricCard label="Fee/trade" value={usd(result.assumptions.feePerTrade)} />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          Entry signals are generated from completed bars and filled at the next bar open. Stop and trailing-stop exits are evaluated on marked daily closes.
        </p>
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">Trades</div>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left">Entry</th>
              <th className="px-4 py-3 text-left">Exit</th>
              <th className="px-4 py-3 text-right">Return</th>
              <th className="px-4 py-3 text-right">P/L</th>
              <th className="px-4 py-3 text-right">Fees</th>
              <th className="px-4 py-3 text-left">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-soft">
            {result.trades.slice(-12).map((trade) => (
              <tr key={`${trade.entryDate}-${trade.exitDate}`}>
                <td className="px-4 py-3">{trade.entryDate}</td>
                <td className="px-4 py-3">{trade.exitDate}</td>
                <td className="num px-4 py-3 text-right">{pct(trade.returnPct)}</td>
                <td className="num px-4 py-3 text-right">{usd(trade.pnl)}</td>
                <td className="num px-4 py-3 text-right">{usd(trade.fees)}</td>
                <td className="px-4 py-3 text-ink-muted">{trade.exitReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ResearchPanel({ icon: Icon, title, items }: { icon: React.ComponentType<{ className?: string }>; title: string; items: string[] }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-blue-300/20 bg-blue-300/10">
          <Icon className="h-4 w-4 text-blue-200" />
        </div>
        <div className="panel-title">{title}</div>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[12.5px] leading-relaxed text-ink-muted">{item}</li>
        ))}
      </ul>
    </div>
  );
}
