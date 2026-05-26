import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import { getResearchDataset } from "@/lib/research";

export const revalidate = 60 * 60;

export default async function DataPage() {
  const { pricesBySymbol, metadata } = await getResearchDataset();
  const rows = Object.values(pricesBySymbol);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L0 Data</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Real Market Data Status</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          The default provider is Yahoo Finance chart API for US equity daily OHLCV. Network or provider failures switch to deterministic fallback and are clearly labeled.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="Symbols" value={String(rows.length)} />
        <MetricCard label="Real loaded" value={String(metadata.realDataCount)} tone="accent" />
        <MetricCard label="Adjusted" value={String(metadata.adjustedCount)} />
        <MetricCard label="Fallback" value={String(metadata.fallbackCount)} tone={metadata.fallbackCount > 0 ? "negative" : "default"} />
        <MetricCard label="Range" value="3y" />
      </div>

      <div className="card p-4 text-[12.5px] leading-relaxed text-ink-muted">
        Dataset generated {new Date(metadata.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}; routes revalidate every {Math.round(metadata.revalidateSeconds / 60)} minutes.
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-left">Provider</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Price basis</th>
              <th className="px-4 py-3 text-right">Rows</th>
              <th className="px-4 py-3 text-left">Coverage</th>
              <th className="px-4 py-3 text-left">Message</th>
            </tr>
          </thead>
          <tbody className="divide-soft">
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td className="px-4 py-3 font-semibold text-ink">{row.symbol}</td>
                <td className="px-4 py-3 text-ink-muted">{row.provider}</td>
                <td className="px-4 py-3"><StatusBadge status={row.isFallback ? "fallback/demo" : "real data ok"} /></td>
                <td className="px-4 py-3"><StatusBadge status={row.quality.adjusted ? "adjusted close" : "raw/demo close"} /></td>
                <td className="num px-4 py-3 text-right">{row.prices.length}</td>
                <td className="px-4 py-3 text-ink-muted">{row.quality.firstDate} → {row.quality.lastDate}</td>
                <td className="px-4 py-3 text-ink-muted">{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
