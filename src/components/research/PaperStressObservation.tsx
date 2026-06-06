import { CheckCircle2, CircleDot } from "lucide-react";
import type { PaperStressObservation as PaperStressData } from "@/lib/quant/marketStress";
import StressBadge from "@/components/badges/StressBadge";
import StatusBadge from "@/components/badges/StatusBadge";
import { stressToneCard, stressToneText } from "./stressStyles";
import { pct, usd } from "@/lib/utils/format";

export interface PaperStressRow {
  id: string;
  strategyName: string;
  symbol: string;
  observationStatus: string;
  stressStatusBadge: string;
  todayReturn: number;
  currentDrawdown: number;
  benchmarkRelative: number;
  note: string;
}

const statusLabel: Record<PaperStressData["riskState"], string> = {
  stress: "Under Stress",
  caution: "Caution",
  stable: "Within Limits",
};

/**
 * "Paper Observation During Market Stress" — how the simulated book behaves
 * through the regime, with a small selloff timeline. Simulation only; no orders
 * are routed.
 */
export default function PaperStressObservation({
  data,
  rows,
}: {
  data: PaperStressData;
  rows: PaperStressRow[];
}) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="section-label">Stress Observation</div>
          <h2 className="mt-1 text-[20px] font-semibold text-ink">Paper Observation During Market Stress</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            How promoted strategies behave through the current regime. Simulated observation only — no broker connection
            and no orders routed.
          </p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-right ${stressToneCard[data.riskState]}`}>
          <div className="text-[10px] uppercase tracking-[0.16em] opacity-75">Risk state</div>
          <div className="mt-0.5 text-[14px] font-semibold text-white">{statusLabel[data.riskState]}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StressStat label="Active observed" value={String(data.activeCount)} />
        <StressStat label="Today simulated P&L" value={usd(data.todaySimulatedPnl)} tone={data.todaySimulatedPnl >= 0 ? "up" : "down"} />
        <StressStat label="Worst current DD" value={pct(data.currentDrawdown)} tone={data.currentDrawdown < 0 ? "down" : "flat"} />
        <StressStat label="Benchmark-rel. DD" value={pct(data.benchmarkRelative)} tone={data.benchmarkRelative < 0 ? "down" : "up"} />
      </div>

      {/* Selloff timeline. */}
      <div className="mt-5 rounded-2xl border border-line bg-white/[0.025] p-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Stress timeline</div>
        <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          {data.timeline.map((step) => {
            const Icon = step.state === "active" ? CircleDot : CheckCircle2;
            return (
              <li key={step.label} className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${step.state === "active" ? "text-amber-300" : "text-emerald-300"}`} />
                <div>
                  <div className="text-[12px] font-semibold text-white">{step.label}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{step.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {rows.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead className="border-y border-line bg-white/[0.025] text-[10px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Strategy</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-left">Stress</th>
                <th className="px-4 py-3 text-right">Today P&L</th>
                <th className="px-4 py-3 text-right">Current DD</th>
                <th className="px-4 py-3 text-right">Bench-rel DD</th>
                <th className="px-4 py-3 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{row.strategyName}</div>
                    <div className="text-[11px] text-ink-soft">{row.symbol}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.observationStatus} /></td>
                  <td className="px-4 py-3"><StressBadge label={row.stressStatusBadge} /></td>
                  <td className={`num px-4 py-3 text-right ${row.todayReturn >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(row.todayReturn)}</td>
                  <td className={`num px-4 py-3 text-right ${row.currentDrawdown < 0 ? "text-rose-300" : "text-ink"}`}>{pct(row.currentDrawdown)}</td>
                  <td className={`num px-4 py-3 text-right ${row.benchmarkRelative < 0 ? "text-rose-300" : "text-emerald-300"}`}>{pct(row.benchmarkRelative)}</td>
                  <td className="max-w-[260px] px-4 py-3 text-ink-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-white/[0.025] p-4 text-[12.5px] leading-relaxed text-ink-muted">
          No promoted strategy is live, so there is no simulated book to stress-test this session. The desk keeps waiting
          for a radar candidate that clears every promotion gate.
        </div>
      )}

      {data.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {data.notes.map((note) => (
            <li key={note} className={`text-[12px] leading-relaxed ${stressToneText[data.riskState]}`}>• {note}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
        Simulated observation · stress-adjusted ranking · not investment advice. Historical backtests do not represent
        future returns.
      </p>
    </section>
  );
}

function StressStat({ label, value, tone = "flat" }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const cls = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-2xl border border-line bg-white/[0.025] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className={`num mt-2 text-[20px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
