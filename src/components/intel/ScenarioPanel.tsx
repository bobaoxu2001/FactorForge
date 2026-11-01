"use client";

import { useEffect, useState } from "react";
import type { ScenarioCase, ScenarioResult } from "@/lib/intel/types";
import { weightScenarios } from "@/lib/intel/valuation";
import { fmt, textTone } from "./ui";
import { useWorkspace } from "./useWorkspace";

const CASES: ScenarioCase[] = ["bull", "base", "bear"];

/**
 * Bull/base/bear valuation with OPTIONAL probabilities. Probabilities are the
 * analyst's judgement: they must be written down with a justification, and an
 * expected return is shown only once they form a complete distribution.
 */
export default function ScenarioPanel({ ticker, scenarios, price }: { ticker: string; scenarios: ScenarioResult[]; price: number }) {
  const { state, ready, dispatch } = useWorkspace();
  const saved = state.scenarioProbabilities[ticker];
  const [probs, setProbs] = useState<Record<ScenarioCase, string>>({ bull: "", base: "", bear: "" });
  const [justification, setJustification] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !saved) return;
    setProbs({
      bull: saved.probabilities.bull === null ? "" : String(Math.round(saved.probabilities.bull * 100)),
      base: saved.probabilities.base === null ? "" : String(Math.round(saved.probabilities.base * 100)),
      bear: saved.probabilities.bear === null ? "" : String(Math.round(saved.probabilities.bear * 100)),
    });
    setJustification(saved.justification);
  }, [ready, saved]);

  const parsed = (c: ScenarioCase) => (probs[c].trim() === "" ? null : Number(probs[c]) / 100);
  const weighting = weightScenarios(scenarios.map((s) => ({ impliedReturn: s.impliedReturn, probability: parsed(s.case) })));
  const bull = scenarios.find((s) => s.case === "bull");
  const bear = scenarios.find((s) => s.case === "bear");
  const upside = bull?.impliedReturn ?? null;
  const downside = bear?.impliedReturn ?? null;

  const save = () => {
    const error = dispatch({
      type: "scenario/set",
      value: { ticker, probabilities: { bull: parsed("bull"), base: parsed("base"), bear: parsed("bear") }, justification, updatedAt: new Date().toISOString() },
    });
    setMessage(error ?? "Saved to your workspace (this browser only).");
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-[0.14em] text-ink-soft">
            <tr><th className="py-2 pr-3">Case</th><th className="py-2 pr-3">NTM revenue growth</th><th className="py-2 pr-3">Op. margin</th><th className="py-2 pr-3">EV/EBITDA</th><th className="py-2 pr-3">Implied value / share</th><th className="py-2 pr-3">vs ${price.toFixed(2)}</th><th className="py-2">Probability %</th></tr>
          </thead>
          <tbody className="divide-soft">
            {CASES.map((c) => {
              const s = scenarios.find((x) => x.case === c);
              if (!s) return null;
              return (
                <tr key={c} className="table-row align-top">
                  <td className="py-2 pr-3"><div className="font-medium capitalize text-ink">{c}</div><div className="max-w-[220px] text-[10.5px] text-ink-soft">{s.label}</div></td>
                  <td className="py-2 pr-3 text-ink-muted">{fmt.pct(s.revenueGrowth)}</td>
                  <td className="py-2 pr-3 text-ink-muted">{fmt.pctPlain(s.operatingMargin)}</td>
                  <td className="py-2 pr-3 text-ink-muted">{fmt.x(s.evToEbitda)}</td>
                  <td className="py-2 pr-3 text-ink">{s.perShare === null ? "n/m" : fmt.usd(s.perShare)}</td>
                  <td className={`py-2 pr-3 ${textTone(s.impliedReturn)}`}>{fmt.pct(s.impliedReturn)}</td>
                  <td className="py-2">
                    <input aria-label={`${c} probability`} inputMode="numeric" value={probs[c]} onChange={(e) => setProbs({ ...probs, [c]: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="—" className="h-8 w-16 rounded-md border border-line bg-white/[0.04] px-2 text-[12.5px] text-ink focus:border-cyan-300/50 focus:outline-none" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-[11px] leading-relaxed text-ink-soft">
        {scenarios.map((s) => <li key={s.case}><span className="capitalize text-ink-muted">{s.case}:</span> {s.rationale}</li>)}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="stat-tile !p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Upside to bull</div><div className={`num mt-1 text-[17px] font-semibold ${textTone(upside)}`}>{fmt.pct(upside)}</div></div>
        <div className="stat-tile !p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Downside to bear</div><div className={`num mt-1 text-[17px] font-semibold ${textTone(downside)}`}>{fmt.pct(downside)}</div></div>
        <div className="stat-tile !p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Upside / downside</div><div className="num mt-1 text-[17px] font-semibold text-ink">{upside !== null && downside !== null && downside < 0 ? `${(upside / Math.abs(downside)).toFixed(2)}×` : "n/m"}</div></div>
      </div>
      <div className="rounded-xl border border-line bg-white/[0.02] p-3">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-ink-soft" htmlFor={`just-${ticker}`}>Why these probabilities? (required before any expected return is shown)</label>
        <textarea id={`just-${ticker}`} value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] p-2 text-[12.5px] text-ink focus:border-cyan-300/50 focus:outline-none" placeholder="e.g. Three shipper checks point to flat 2027 bid rates; fuel is the main swing factor." />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button onClick={save} className="rounded-lg border border-cyan-300/35 bg-cyan-300/[0.08] px-3 py-1.5 text-[12px] text-cyan-100 hover:bg-cyan-300/[0.15]">Save to workspace</button>
          <span className="text-[12px] text-ink-muted">
            Probabilities sum to {Math.round(weighting.probabilitySum * 100)}%.{" "}
            {weighting.complete && justification.trim().length >= 20 ? (
              <span>Probability-weighted return: <span className={textTone(weighting.expectedReturn)}>{fmt.pct(weighting.expectedReturn)}</span> (your judgement, not a forecast).</span>
            ) : (
              <span>No expected return until probabilities total 100% and a justification is written.</span>
            )}
          </span>
        </div>
        {message && <div className="mt-1 text-[11.5px] text-ink-soft">{message}</div>}
      </div>
    </div>
  );
}
