import { Layers, AlertTriangle } from "lucide-react";
import CorrelationMatrix from "./CorrelationMatrix";
import { factorLabel, type SignalConcentrationReport } from "@/lib/quant/signalConcentration";
import { num, pctPlain } from "@/lib/utils/format";

const LEVEL_STYLE: Record<SignalConcentrationReport["level"], { chip: string; bar: string }> = {
  low: { chip: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200", bar: "bg-emerald-400" },
  medium: { chip: "border-amber-300/30 bg-amber-300/10 text-amber-200", bar: "bg-amber-400" },
  high: { chip: "border-rose-300/30 bg-rose-300/10 text-rose-200", bar: "bg-rose-400" },
};

export default function SignalConcentrationPanel({ report }: { report: SignalConcentrationReport | null }) {
  if (!report) {
    return (
      <div className="card p-5 text-[13px] text-ink-muted">
        Need at least two strategies with overlapping history to measure concentration.
      </div>
    );
  }

  const style = LEVEL_STYLE[report.level];
  const diversifiedPct = report.effectiveStrategies / report.strategyCount;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/25 bg-blue-300/10">
              <Layers className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Signal Concentration</div>
              <h2 className="mt-1 text-[20px] font-semibold text-ink">Are these strategies actually diversified?</h2>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wider ${style.chip}`}>
            {report.level} overlap
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Strategies" value={String(report.strategyCount)} />
          <Stat label="Effective bets" value={num(report.effectiveStrategies, 1)} tone="accent" />
          <Stat label="Avg correlation" value={pctPlain(report.averagePairwiseCorrelation)} />
          <Stat
            label="Most correlated"
            value={report.maxPair ? pctPlain(report.maxPair.correlation) : "—"}
          />
        </div>

        {/* Effective-bets bar: how much of the nominal strategy count is real diversification. */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] text-ink-soft">
            <span>Independent bets</span>
            <span className="num">{num(report.effectiveStrategies, 1)} of {report.strategyCount}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/[0.06]">
            <div className={`h-2 rounded-full ${style.bar}`} style={{ width: `${Math.max(6, diversifiedPct * 100)}%` }} />
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{report.verdict}</p>

        {report.sharedDominantFactor && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="text-[12.5px] leading-relaxed text-ink-muted">
              <span className="font-medium text-amber-100">Shared factor exposure. </span>
              {report.sharedDominantFactor.count} of {report.strategyCount} strategies load primarily on the{" "}
              <span className="font-medium text-ink">{factorLabel(report.sharedDominantFactor.factor)}</span> factor —
              different rules, same underlying driver.
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CorrelationMatrix cells={report.correlation} />
        <div className="card overflow-x-auto p-4">
          <div className="mb-3 text-[11px] uppercase tracking-wider text-ink-soft">Factor exposure by strategy</div>
          <table className="w-full min-w-[420px] text-[12px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-2 py-2 text-left">Strategy</th>
                <th className="px-2 py-2 text-right">Mkt β</th>
                <th className="px-2 py-2 text-right">Mom β</th>
                <th className="px-2 py-2 text-right">Vol β</th>
                <th className="px-2 py-2 text-right">Dominant</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {report.factorRows.map((row) => (
                <tr key={row.strategyId}>
                  <td className="px-2 py-2.5">
                    <div className="font-medium text-ink">{row.strategyName}</div>
                    <div className="text-[11px] text-ink-soft">{row.symbol}</div>
                  </td>
                  <td className="num px-2 py-2.5 text-right">{num(row.betas.mkt)}</td>
                  <td className="num px-2 py-2.5 text-right">{num(row.betas.mom)}</td>
                  <td className="num px-2 py-2.5 text-right">{num(row.betas.vol)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <span className="rounded-full border border-blue-300/25 bg-blue-300/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-200">
                      {factorLabel(row.dominantFactor)}
                    </span>
                  </td>
                </tr>
              ))}
              {report.factorRows.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-ink-muted">Not enough overlap for factor attribution.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className={`num mt-1 text-[20px] font-semibold ${tone === "accent" ? "text-brand-blue" : "text-ink"}`}>{value}</div>
    </div>
  );
}
