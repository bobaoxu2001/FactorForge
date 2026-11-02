import type { HistoricalPriceResult } from "@/types/market";
import StatusBadge from "@/components/badges/StatusBadge";

export default function DataSourceStatus({ result }: { result: HistoricalPriceResult | { provider: string; isFallback: boolean; message: string; updatedAt: string; adjusted?: boolean } }) {
  const adjusted = "quality" in result ? result.quality.adjusted : result.adjusted;
  const stale = "quality" in result && result.quality.stale === true;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
      <StatusBadge status={result.isFallback ? "fallback/demo" : "real data"} />
      <StatusBadge status={adjusted ? "adjusted prices" : "raw/demo prices"} />
      {stale && <StatusBadge status={`stale · last bar ${result.quality.lastDate}`} />}
      <span>{result.provider}</span>
      <span>·</span>
      <span>{result.message}</span>
      <span>·</span>
      <span>updated {new Date(result.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
    </div>
  );
}
