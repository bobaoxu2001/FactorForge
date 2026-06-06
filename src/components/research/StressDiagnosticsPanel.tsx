import { ShieldAlert } from "lucide-react";
import type { StrategyStressDiagnostics, MarketStressReport } from "@/lib/quant/marketStress";
import StressBadge from "@/components/badges/StressBadge";
import { stressToneCard } from "./stressStyles";
import { pct, num } from "@/lib/utils/format";

const statusLabel: Record<StrategyStressDiagnostics["status"], string> = {
  stable: "Stable",
  watch: "Watch",
  "under stress": "Under Stress",
};

/**
 * Full stress-diagnostics + drawdown-focused view for a single strategy.
 * Everything is computed deterministically from the backtest equity curve; the
 * regime context only tightens the stable/watch/under-stress thresholds.
 */
export default function StressDiagnosticsPanel({
  diagnostics,
  report,
}: {
  diagnostics: StrategyStressDiagnostics;
  report: MarketStressReport;
}) {
  const d = diagnostics;
  return (
    <section className={`card overflow-hidden p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl border ${stressToneCard[d.tone]}`}>
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="section-label">Stress Diagnostics</div>
            <h2 className="mt-1 text-[20px] font-semibold text-white">{statusLabel[d.status]} under a {report.regime} tape</h2>
            <p className="mt-1 text-[12px] text-ink-muted">
              Suitability for paper observation during selloff conditions:{" "}
              <span className={d.paperSuitable ? "text-emerald-200" : "text-amber-200"}>
                {d.paperSuitable ? "suitable" : "hold — review drawdown first"}
              </span>.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {d.badges.map((badge) => <StressBadge key={badge} label={badge} />)}
        </div>
      </div>

      {/* Stress-aware radar score: base vs stress-adjusted. */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ScoreTile label="Base score" value={String(d.baseScore)} />
        <ScoreTile label="Stress-adjusted score" value={String(d.stressAdjustedScore)} tone={d.stressAdjustedScore < d.baseScore ? "down" : "up"} delta={d.stressAdjustedScore - d.baseScore} />
        <div className="rounded-2xl border border-line bg-white/[0.025] p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Risk flags</div>
          <div className="num mt-2 text-[24px] font-semibold text-white">{d.riskFlagCount}</div>
          <div className="mt-1 text-[11px] text-ink-muted">{d.stopLossTriggers} stop-loss exit{d.stopLossTriggers === 1 ? "" : "s"} on record</div>
        </div>
      </div>

      {/* Sensitivities. */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <SensitivityBar label="Drawdown sensitivity" value={d.drawdownSensitivity} />
        <SensitivityBar label="Volatility sensitivity" value={d.volatilitySensitivity} />
      </div>

      {/* Drawdown-focused views — what matters most in a crash. */}
      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Drawdown-focused views</div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <RiskMetric label="Max drawdown" value={pct(d.maxDrawdown)} negative />
          <RiskMetric label="Current drawdown" value={pct(d.currentDrawdown)} negative={d.currentDrawdown < 0} />
          <RiskMetric label="Downside volatility" value={pct(d.downsideVolatility).replace("+", "")} />
          <RiskMetric label="Worst 5-day" value={pct(d.worstFiveDay)} negative />
          <RiskMetric label="Benchmark-rel. DD" value={pct(d.benchmarkRelativeDrawdown)} negative={d.benchmarkRelativeDrawdown < 0} />
          <RiskMetric label="Recent vs benchmark" value={pct(d.recentReturnVsBenchmark)} negative={d.recentReturnVsBenchmark < 0} positive={d.recentReturnVsBenchmark > 0} />
          <RiskMetric label="Days underwater" value={d.daysUnderwater === 0 ? "At highs" : `${d.daysUnderwater}d`} />
          <RiskMetric label="Stop-loss triggers" value={String(d.stopLossTriggers)} />
        </div>
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-soft">
        Stress status tightens automatically when the broad regime is risk-off. Drawdown metrics are deterministic from
        the backtest equity curve; historical backtests do not represent future returns. Research only — not investment advice.
      </p>
    </section>
  );
}

function ScoreTile({ label, value, tone, delta }: { label: string; value: string; tone?: "up" | "down"; delta?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.025] p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className="num mt-2 flex items-end gap-2 text-[24px] font-semibold text-white">
        {value}
        {tone && delta !== undefined && delta !== 0 && (
          <span className={`text-[12px] ${tone === "down" ? "text-rose-300" : "text-emerald-300"}`}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-ink-muted">{tone ? "Penalizes drawdown / downside vol, rewards resilience" : "Composite radar score"}</div>
    </div>
  );
}

function SensitivityBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 65 ? "bg-rose-300" : value >= 40 ? "bg-amber-300" : "bg-emerald-300";
  return (
    <div className="rounded-2xl border border-line bg-white/[0.025] p-4">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="text-ink-muted">{label}</span>
        <span className="num text-white">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06]">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RiskMetric({ label, value, negative, positive }: { label: string; value: string; negative?: boolean; positive?: boolean }) {
  const cls = positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-xl border border-line bg-white/[0.025] p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">{label}</div>
      <div className={`num mt-1.5 text-[16px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
