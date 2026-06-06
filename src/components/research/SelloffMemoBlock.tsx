import { BrainCircuit, FlaskConical } from "lucide-react";
import type { SelloffMemo } from "@/lib/quant/marketStress";

/**
 * "AI Research Memo: Market Selloff Review" — a structured, deterministic memo
 * generated from live metrics. When no external LLM is connected, the prose is
 * still credible because every sentence is templated over engine numbers.
 */
export default function SelloffMemoBlock({ memo }: { memo: SelloffMemo }) {
  const sections: Array<[string, string]> = [
    ["Market context", memo.marketContext],
    ["Factor behavior", memo.factorBehavior],
    ["Strategy risk", memo.strategyRisk],
    ["Radar impact", memo.radarImpact],
    ["Paper observation notes", memo.paperObservation],
  ];
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/[0.08]">
            <BrainCircuit className="h-5 w-5 text-amber-200" />
          </div>
          <div>
            <div className="section-label">AI Research Memo</div>
            <h2 className="mt-1 text-[20px] font-semibold text-white">{memo.title}</h2>
          </div>
        </div>
        <span className="chip border-amber-300/35 bg-amber-400/10 text-amber-100">Deterministic memo</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {sections.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-line bg-white/[0.025] p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{title}</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{body}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-blue-300/20 bg-blue-300/[0.05] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-blue-100/80">
            <FlaskConical className="h-3.5 w-3.5" />
            Suggested next experiments
          </div>
          <ul className="mt-2 space-y-1.5">
            {memo.nextExperiments.map((item) => (
              <li key={item} className="text-[12px] leading-relaxed text-ink-muted before:mr-2 before:text-blue-200/70 before:content-['→']">{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
        Generated from deterministic engine metrics (regime, breadth, volatility, drawdown, radar scoring). No order
        instructions. Historical backtests do not represent future returns. Research only — not investment advice.
      </p>
    </section>
  );
}
