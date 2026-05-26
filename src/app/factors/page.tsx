import StatusBadge from "@/components/badges/StatusBadge";
import { getResearchDataset } from "@/lib/research";
import { pct, num } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function FactorsPage() {
  const { factors } = await getResearchDataset();
  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L1 Factors</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Core Price Factors</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Factors are calculated from daily prices and volume. No hand-written results are used; fallback symbols are explicitly labeled.
        </p>
      </header>
      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Mom 20d</th>
              <th className="px-4 py-3 text-right">Mom 60d</th>
              <th className="px-4 py-3 text-right">Vol 20d</th>
              <th className="px-4 py-3 text-right">Volume surge</th>
              <th className="px-4 py-3 text-right">RSI</th>
              <th className="px-4 py-3 text-left">Trend</th>
              <th className="px-4 py-3 text-left">Basis</th>
            </tr>
          </thead>
          <tbody className="divide-soft">
            {factors.map((factor) => (
              <tr key={factor.symbol}>
                <td className="px-4 py-3 font-semibold text-ink">{factor.symbol}</td>
                <td className="num px-4 py-3 text-right">{factor.momentum20d === null ? "n/a" : pct(factor.momentum20d)}</td>
                <td className="num px-4 py-3 text-right">{factor.momentum60d === null ? "n/a" : pct(factor.momentum60d)}</td>
                <td className="num px-4 py-3 text-right">{factor.volatility20d === null ? "n/a" : pct(factor.volatility20d)}</td>
                <td className="num px-4 py-3 text-right">{factor.volumeSurge === null ? "n/a" : `${num(factor.volumeSurge)}x`}</td>
                <td className="num px-4 py-3 text-right">{factor.rsi14 === null ? "n/a" : num(factor.rsi14, 1)}</td>
                <td className="px-4 py-3"><StatusBadge status={factor.aboveSma200 ? "above SMA200" : "below SMA200"} /></td>
                <td className="px-4 py-3"><StatusBadge status={factor.adjusted ? "adjusted" : "raw/demo"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
