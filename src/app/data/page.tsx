import { CheckCircle2, Database, ShieldAlert } from "lucide-react";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";

export const revalidate = 60 * 60;

export default async function DataPage() {
  const { pricesBySymbol, metadata } = await getResearchDataset();
  const rows = Object.values(pricesBySymbol);

  return (
    <div className="space-y-8">
      <header>
        <div className="section-label">L0 Data</div>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">Market Data Control Plane</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          The default provider is Yahoo Finance chart API for US equity daily <Term term="ohlcv">OHLCV</Term>. Every result carries provider, freshness, adjusted-close, and fallback metadata.
        </p>
      </header>

      <PlainEnglish>
        Everything on this platform is built from real daily price history — the open, high, low, close, and trading
        volume for each stock. This page is the receipts: where each number came from, how fresh it is, and whether any
        stand-in <Term term="fallback">demo data</Term> was used (it&rsquo;s always labeled, never faked).
      </PlainEnglish>

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

      <MethodologyCallout
        items={[
          "Provider order is Yahoo Finance first, optional Polygon and Alpha Vantage after that, then deterministic fallback/demo data if all real providers fail.",
          "The default date range is 3 years of daily OHLCV bars.",
          "Adjusted close is used when Yahoo provides it; rows disclose whether the price basis is adjusted or raw/demo.",
          "Fallback/demo rows are labeled in the status, price basis, and message columns.",
        ]}
      />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DataCredCard icon={Database} title="Provider Transparency" detail="Yahoo Finance chart API remains visible in the UI, and all fallback/demo substitutions are disclosed." />
        <DataCredCard icon={CheckCircle2} title="Adjusted Close Awareness" detail="Corporate-action-adjusted price series are used when Yahoo provides adjusted close data." />
        <DataCredCard icon={ShieldAlert} title="Fallback Discipline" detail="Fallback data keeps the demo resilient, but it is never presented as real market validation." />
      </section>

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
              <tr key={row.symbol} className="table-row">
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

function DataCredCard({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="card p-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/20 bg-blue-300/10">
        <Icon className="h-5 w-5 text-blue-200" />
      </div>
      <h2 className="mt-4 text-[15px] font-semibold text-white">{title}</h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>
    </div>
  );
}
