import Link from "next/link";
import { notFound } from "next/navigation";
import DrawdownChart from "@/components/charts/DrawdownChart";
import EquityCurveChart from "@/components/charts/EquityCurveChart";
import MetricCard from "@/components/cards/MetricCard";
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
            <div className="text-[11px] uppercase tracking-wider text-ink-soft">AI-style explanation</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">{explanation.summary}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{explanation.whyItWorks}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-rose-700">{explanation.keyRisks}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-blue">{explanation.nextStep}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DrawdownChart data={result.equityCurve} />
        <BacktestChecklist result={result} />
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

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">Trades</div>
        <table className="w-full text-[13px]">
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
