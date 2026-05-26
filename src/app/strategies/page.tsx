import StrategyCard from "@/components/cards/StrategyCard";
import EmptyState from "@/components/research/EmptyState";
import { getResearchDataset } from "@/lib/research";

export const revalidate = 60 * 60;

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams?: { status?: string; symbol?: string; q?: string };
}) {
  const { radarCandidates } = await getResearchDataset();
  const status = searchParams?.status ?? "all";
  const symbol = searchParams?.symbol ?? "all";
  const query = (searchParams?.q ?? "").trim().toLowerCase();
  const filtered = radarCandidates.filter((candidate) => {
    const statusMatch = status === "all" || candidate.status === status;
    const symbolMatch = symbol === "all" || candidate.result.symbol === symbol;
    const queryMatch =
      query.length === 0 ||
      candidate.result.strategyName.toLowerCase().includes(query) ||
      candidate.result.symbol.toLowerCase().includes(query) ||
      candidate.result.type.toLowerCase().includes(query);
    return statusMatch && symbolMatch && queryMatch;
  });
  const symbols = Array.from(new Set(radarCandidates.map((candidate) => candidate.result.symbol)));

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L2 Strategies</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Strategy Backtest List</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Each card is produced from real market data or explicitly labeled fallback data, strategy rules, long-only backtests, and calculated metrics.
        </p>
      </header>

      <form className="card flex flex-col gap-3 p-3 md:flex-row md:items-center" action="/strategies">
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="symbol" value={symbol} />
        <input
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Search by strategy, symbol, or type"
          className="min-h-10 flex-1 rounded-lg border border-line bg-white/[0.04] px-3 text-[13px] text-ink outline-none placeholder:text-ink-soft"
        />
        <button type="submit" className="rounded-lg border border-blue-400/35 bg-blue-500/12 px-4 py-2 text-[13px] font-medium text-blue-200">
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {["all", "radar candidate", "continue observing", "rejected"].map((item) => (
          <a key={item} href={`/strategies?status=${encodeURIComponent(item)}&symbol=${symbol}&q=${encodeURIComponent(searchParams?.q ?? "")}`} className={`chip ${status === item ? "border-ink bg-ink text-white" : "border-line bg-white/[0.04] text-ink-muted"}`}>
            {item}
          </a>
        ))}
        {["all", ...symbols].map((item) => (
          <a key={item} href={`/strategies?status=${encodeURIComponent(status)}&symbol=${item}&q=${encodeURIComponent(searchParams?.q ?? "")}`} className={`chip ${symbol === item ? "border-blue-400/35 bg-blue-500/12 text-blue-200" : "border-line bg-white/[0.04] text-ink-muted"}`}>
            {item}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((candidate) => (
          <StrategyCard key={candidate.result.strategyId} result={candidate.result} score={candidate.score} status={candidate.status} />
        ))}
      </div>
      {filtered.length === 0 && (
        <EmptyState title="No matching strategies" message="Adjust the status or symbol filter. All strategy results come from the current data and backtest pipeline." />
      )}
    </div>
  );
}
