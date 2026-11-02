"use client";

import { useState } from "react";
import { discountedCashFlow, type DcfInputs } from "@/lib/intel/valuation";
import { fmt, textTone } from "./ui";

type Field = { key: keyof DcfInputs; label: string; pct: boolean; hint: string };

const FIELDS: Field[] = [
  { key: "initialGrowth", label: "Year-1 revenue growth", pct: true, hint: "Default: latest TTM growth, clipped to −10%…+15%" },
  { key: "terminalGrowth", label: "Terminal growth", pct: true, hint: "Long-run nominal growth assumption" },
  { key: "ebitMargin", label: "EBIT margin", pct: true, hint: "Default: TTM operating margin" },
  { key: "taxRate", label: "Tax rate", pct: true, hint: "Default: TTM effective rate if 0–40%, else 21%" },
  { key: "reinvestmentRate", label: "Net reinvestment / revenue", pct: true, hint: "Default: TTM (capex − D&A) / revenue, floored at 0" },
  { key: "wacc", label: "Discount rate (WACC)", pct: true, hint: "Your assumption. Not estimated from market data here" },
  { key: "years", label: "Explicit years", pct: false, hint: "1–15" },
];

/** Interactive FCFF DCF. Every input is visible and editable; nothing is hidden in a default. */
export default function DcfCalculator({ defaults, price }: { defaults: DcfInputs; price: number }) {
  const [inputs, setInputs] = useState<DcfInputs>(defaults);
  const result = discountedCashFlow(inputs);
  const implied = result.perShare === null ? null : result.perShare / price - 1;
  const set = (f: Field, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setInputs({ ...inputs, [f.key]: f.pct ? n / 100 : n });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="grid grid-cols-[1fr_90px] items-center gap-2 text-[12px]">
            <span><span className="text-ink">{f.label}</span><span className="block text-[10.5px] text-ink-soft">{f.hint}</span></span>
            <input
              aria-label={f.label}
              type="number"
              step={f.pct ? 0.5 : 1}
              value={f.pct ? Number(((inputs[f.key] as number) * 100).toFixed(2)) : (inputs[f.key] as number)}
              onChange={(e) => set(f, e.target.value)}
              className="h-8 rounded-md border border-line bg-ink/[0.04] px-2 text-right text-ink focus:border-accent/50 focus:outline-none"
            />
          </label>
        ))}
        <button onClick={() => setInputs(defaults)} className="text-[11.5px] text-accent hover:text-ink">Reset to data-derived defaults</button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Value / share</div><div className="num mt-1 text-[17px] font-semibold text-ink">{result.perShare === null ? "n/m" : fmt.usd(result.perShare)}</div></div>
          <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">vs price</div><div className={`num mt-1 text-[17px] font-semibold ${textTone(implied)}`}>{fmt.pct(implied)}</div></div>
          <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Terminal share of EV</div><div className="num mt-1 text-[17px] font-semibold text-ink">{fmt.pctPlain(result.terminalShare, 0)}</div></div>
        </div>
        {result.warnings.map((w) => <div key={w} className="rounded-lg border border-amber-600/25 bg-amber-300/[0.06] px-3 py-1.5 text-[11.5px] text-amber-800/90">{w}</div>)}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11.5px]">
            <thead className="text-[10px] text-ink-soft"><tr><th className="py-1 text-left">Year</th><th>Revenue</th><th>EBIT</th><th>NOPAT</th><th>Reinvest</th><th>FCFF</th><th>PV</th></tr></thead>
            <tbody className="divide-soft text-ink-muted">
              {result.projections.map((p) => (
                <tr key={p.year}><td className="py-1 text-left">{p.year}</td><td>{fmt.usdM(p.revenue)}</td><td>{fmt.usdM(p.ebit)}</td><td>{fmt.usdM(p.nopat)}</td><td>{fmt.usdM(p.reinvestment)}</td><td>{fmt.usdM(p.fcff)}</td><td>{fmt.usdM(p.pv)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-soft">EV {fmt.usdB(result.enterpriseValue)} − net debt {fmt.usdB(inputs.netDebt)} = equity {fmt.usdB(result.equityValue)} over {(inputs.shares / 1e6).toFixed(1)}M shares. A DCF this sensitive to margin and WACC is a framing tool, not a price target.</p>
      </div>
    </div>
  );
}
