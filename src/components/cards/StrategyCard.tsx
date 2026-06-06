import Link from "next/link";
import type { BacktestResult } from "@/types/backtest";
import type { StrategyStressDiagnostics } from "@/lib/quant/marketStress";
import type { StrategyIntel } from "@/lib/quant/strategyIntel";
import MetricCard from "./MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import StressBadge from "@/components/badges/StressBadge";
import { pct, num } from "@/lib/utils/format";

const GATE_STYLE: Record<StrategyIntel["researchGate"]["kind"], string> = {
  observe: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  investigate: "border-cyan-300/30 bg-cyan-400/[0.08] text-cyan-100",
  watchlist: "border-amber-300/35 bg-amber-400/10 text-amber-100",
};

export default function StrategyCard({
  result,
  score,
  status,
  diagnostics,
  intel,
}: {
  result: BacktestResult;
  score?: number;
  status?: string;
  diagnostics?: StrategyStressDiagnostics;
  intel?: StrategyIntel;
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
      {intel && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <IntelMini label="Regime fit" value={intel.regimeFit.score} />
          <IntelMini label="Catalyst" value={intel.catalystSensitivity.score} />
          <IntelMini label="Confidence" value={intel.confidence.score} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {intel && <span className={`chip ${GATE_STYLE[intel.researchGate.kind]}`}>{intel.researchGate.label}</span>}
        {status && <StatusBadge status={status} />}
        {diagnostics?.badges.map((badge) => <StressBadge key={badge} label={badge} />)}
        {!diagnostics && !intel && <StatusBadge status={result.dataStatus.isFallback ? "fallback/demo" : "real data"} />}
      </div>
    </Link>
  );
}

function IntelMini({ label, value }: { label: string; value: number }) {
  const bar = value >= 65 ? "from-emerald-400 to-cyan-400" : value >= 45 ? "from-cyan-400 to-blue-400" : "from-amber-400 to-amber-300";
  return (
    <div className="rounded-lg border border-line bg-white/[0.025] px-2.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{label}</span>
        <span className="num text-[11px] font-semibold text-white">{value}</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
