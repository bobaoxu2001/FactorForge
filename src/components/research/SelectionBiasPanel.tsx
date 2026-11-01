import Term from "@/components/learn/Term";
import { DSR_CONFIDENCE, type SelectionBiasSummary } from "@/lib/quant/selectionBias";
import { num } from "@/lib/utils/format";

interface SelectionBiasRow {
  strategyId: string;
  strategyName: string;
  summary: SelectionBiasSummary;
}

const prob = (value: number | null) => (value === null ? "n/a" : `${Math.round(value * 100)}%`);

/**
 * Quantifies the "best symbol per strategy" showcase: each headline run is the
 * strongest of N, so its Sharpe is tested against what the luckiest of N
 * skill-less runs would score (Deflated Sharpe Ratio).
 */
export default function SelectionBiasPanel({ rows, title = "Selection-bias check" }: { rows: SelectionBiasRow[]; title?: string }) {
  if (rows.length === 0) return null;
  const survivors = rows.filter((r) => r.summary.survives).length;
  const trials = rows.reduce((s, r) => s + r.summary.trials, 0);
  const perStrategy = Math.max(...rows.map((r) => r.summary.trials));
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-label">{title}</div>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
            Each strategy is shown on the symbol where it scored best, out of up to {perStrategy} tried. Picking a winner inflates its{" "}
            <Term term="sharpe">Sharpe</Term>, so each pick is compared with the Sharpe the luckiest skill-less run would reach. The{" "}
            <Term term="deflated-sharpe">deflated Sharpe</Term> is the probability the edge is real after that haircut.
          </p>
        </div>
        <span className={`chip ${survivors > 0 ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-amber-300/35 bg-amber-300/10 text-amber-100"}`}>
          {survivors} of {rows.length} clear {Math.round(DSR_CONFIDENCE * 100)}%
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12.5px]">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-semibold">Strategy</th>
              <th className="py-2 pr-3 font-semibold">Showcase pick</th>
              <th className="py-2 pr-3 text-right font-semibold">Sharpe</th>
              <th className="py-2 pr-3 text-right font-semibold">Luck bar (best of N)</th>
              <th className="py-2 pr-3 text-right font-semibold">P(skill), naive</th>
              <th className="py-2 pr-3 text-right font-semibold">P(skill), deflated</th>
              <th className="py-2 font-semibold">Read</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ strategyId, strategyName, summary }) => (
              <tr key={strategyId} className="border-b border-line/60 last:border-0">
                <td className="py-2.5 pr-3">
                  <a href={`/strategies/${strategyId}`} className="font-medium text-ink hover:underline">{strategyName}</a>
                </td>
                <td className="py-2.5 pr-3 text-ink-muted">{summary.selectedSymbol} · 1 of {summary.trials}</td>
                <td className="num py-2.5 pr-3 text-right text-ink">{num(summary.sharpe)}</td>
                <td className="num py-2.5 pr-3 text-right text-ink-muted">{num(summary.luckThreshold)}</td>
                <td className="num py-2.5 pr-3 text-right text-ink-muted">{prob(summary.psr)}</td>
                <td className={`num py-2.5 pr-3 text-right font-semibold ${summary.survives ? "text-emerald-300" : "text-amber-200"}`}>{prob(summary.dsr)}</td>
                <td className="py-2.5 text-ink-muted">{summary.survives ? "Edge survives the haircut" : "Not distinguishable from luck"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-soft">
        Method: Bailey &amp; López de Prado (2014). Luck bar = dispersion of each strategy&apos;s per-symbol Sharpe ratios × the expected
        maximum of N standard normals; probabilities also correct for sample length, skew and fat tails. {trials} backtests
        sit behind this page in total. Probabilities are model estimates, not guarantees, and the threshold is a convention.
      </p>
    </section>
  );
}
