import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import {
  getCacheCounters,
  getCacheStats,
  getPerStrategyStats,
} from "@/lib/persistence/backtestCache";

// Force dynamic so the counters reflect the live process snapshot, not a
// cached static render.
export const dynamic = "force-dynamic";

export default async function CacheAdminPage() {
  const counters = getCacheCounters();
  const stats = getCacheStats();
  const byStrategy = getPerStrategyStats();
  const totalReads = counters.hits + counters.misses;
  const hitRate = totalReads === 0 ? 0 : counters.hits / totalReads;

  return (
    <div className="space-y-8">
      <header>
        <div className="section-label">Admin</div>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">Backtest cache</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Live SQLite cache state for backtest results. Counters reset on every cold start of the Node process — for cross-restart history, ship a metrics exporter (Prometheus/OTLP) and rely on the persisted row count below.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={`${stats.rowCount} rows persisted`} />
          <StatusBadge status={`hit rate ${(hitRate * 100).toFixed(1)}%`} />
          <StatusBadge status="research-only workflow" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Hits" value={String(counters.hits)} tone="positive" />
        <MetricCard label="Misses" value={String(counters.misses)} />
        <MetricCard label="Writes" value={String(counters.writes)} tone="accent" />
        <MetricCard label="Errors" value={String(counters.errors)} tone={counters.errors > 0 ? "negative" : "default"} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Persisted rows" value={String(stats.rowCount)} />
        <MetricCard label="Oldest entry" value={formatTimestamp(stats.oldestCreatedAt)} />
        <MetricCard label="Newest entry" value={formatTimestamp(stats.newestCreatedAt)} />
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">
          By strategy
        </div>
        {byStrategy.length === 0 ? (
          <div className="p-6 text-[13px] text-ink-muted">
            No persisted rows yet. Visit a page that triggers backtests (Overview, Strategies, Portfolio) to populate the cache.
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Strategy</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-right">Oldest</th>
                <th className="px-4 py-3 text-right">Newest</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {byStrategy.map((row) => (
                <tr key={row.strategyId}>
                  <td className="px-4 py-3 font-medium text-ink">{row.strategyId}</td>
                  <td className="num px-4 py-3 text-right">{row.rowCount}</td>
                  <td className="num px-4 py-3 text-right text-ink-muted">{formatTimestamp(row.oldestCreatedAt)}</td>
                  <td className="num px-4 py-3 text-right text-ink-muted">{formatTimestamp(row.newestCreatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5">
        <div className="panel-title">How the cache works</div>
        <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
          <li>• Cache key = <code className="text-ink">strategyId :: symbol :: sha1(market+benchmark fingerprint)</code></li>
          <li>• Fingerprint includes row count, first/last bar dates, fallback &amp; adjusted-close flags. A fresh data fetch automatically invalidates stale entries.</li>
          <li>• On top of fingerprint matching, a 6h TTL bounds staleness even if the data hasn&apos;t changed.</li>
          <li>• If the native SQLite binding fails to load, the engine quietly runs uncached — the counters above will show all misses, zero writes.</li>
        </ul>
      </section>
    </div>
  );
}

function formatTimestamp(ms: number | null): string {
  if (ms === null) return "—";
  const delta = Date.now() - ms;
  const seconds = Math.floor(delta / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) return `${hours}h ${minutes % 60}m ago`;
  if (minutes >= 1) return `${minutes}m ${seconds % 60}s ago`;
  return `${seconds}s ago`;
}
