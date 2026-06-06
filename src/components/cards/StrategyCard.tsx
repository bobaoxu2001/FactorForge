import Link from "next/link";
import type { BacktestResult } from "@/types/backtest";
import type { StrategyStressDiagnostics } from "@/lib/quant/marketStress";
import MetricCard from "./MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import StressBadge from "@/components/badges/StressBadge";
import { pct, num } from "@/lib/utils/format";

export default function StrategyCard({
  result,
  score,
  status,
  diagnostics,
}: {
  result: BacktestResult;
  score?: number;
  status?: string;
  diagnostics?: StrategyStressDiagnostics;
}) {
  return (
    <Link href={`/strategies/${result.strategyId}`} className="card card-hover block p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">{result.type} · {result.symbol}</div>
          <h3 className="mt-2 text-[17px] font-semibold text-ink">{result.strategyName}</h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{result.description}</p>
        </div>
        {score !== undefined && (
          <div className="text-right">
            <div className="num text-2xl font-semibold text-ink">{score}</div>
            {diagnostics && (
              <div className={`num text-[11px] ${diagnostics.stressAdjustedScore < score ? "text-rose-300" : "text-emerald-300"}`}>
                {diagnostics.stressAdjustedScore} stress-adj
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Annual" value={pct(result.metrics.annualizedReturn)} tone="positive" />
        <MetricCard label="Max DD" value={pct(result.metrics.maxDrawdown)} tone="negative" />
        {diagnostics
          ? <MetricCard label="Current DD" value={pct(diagnostics.currentDrawdown)} tone={diagnostics.currentDrawdown < -0.05 ? "negative" : "default"} />
          : <MetricCard label="Sharpe" value={num(result.metrics.sharpe)} />}
        {diagnostics
          ? <MetricCard label="Downside vol" value={pct(diagnostics.downsideVolatility).replace("+", "")} />
          : <MetricCard label="Trades" value={String(result.metrics.tradeCount)} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {status && <StatusBadge status={status} />}
        {diagnostics?.badges.map((badge) => <StressBadge key={badge} label={badge} />)}
        {!diagnostics && <StatusBadge status={result.dataStatus.isFallback ? "fallback/demo" : "real data"} />}
      </div>
    </Link>
  );
}
