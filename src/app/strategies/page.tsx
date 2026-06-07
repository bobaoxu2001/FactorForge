import StrategyCard from "@/components/cards/StrategyCard";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/research/EmptyState";
import { buildStrategyIntel } from "@/lib/quant/strategyIntel";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import MarketRegimeBanner from "@/components/research/MarketRegimeBanner";
import ModelPortfolioCard from "@/components/research/ModelPortfolioCard";
import { getResearchDataset } from "@/lib/research";

export const revalidate = 60 * 60;

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams?: { status?: string; symbol?: string; q?: string };
}) {
  const { radarCandidates, marketStress, stressDiagnostics, modelPortfolio } = await getResearchDataset();
  const enrichedCandidates = radarCandidates.map((candidate) => ({
    candidate,
    intel: buildStrategyIntel({
      result: candidate.result,
      diagnostics: stressDiagnostics[candidate.result.strategyId],
      regime: { regime: marketStress.regime, stressScore: marketStress.stressScore },
      status: candidate.status,
    }),
  }));
  const status = searchParams?.status ?? "all";
  const symbol = searchParams?.symbol ?? "all";
  const query = (searchParams?.q ?? "").trim().toLowerCase();
  const filtered = enrichedCandidates.filter(({ candidate }) => {
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
      <PageHeader
        eyebrow="L2 Strategies"
        title="Strategy Backtest List"
        subtitle="Each card is produced from real market data or explicitly labeled fallback data, strategy rules, long-only backtests, and calculated metrics."
      />

      <MarketRegimeBanner report={marketStress} />

      <ModelPortfolioCard
        data={modelPortfolio}
        eyebrow="Since May · Simulated"
        title="Strategy Basket Since May"
        variant="compact"
      />

      <StressSummaryStrip candidates={radarCandidates} diagnostics={stressDiagnostics} />

      <StrategyQualityBoard items={enrichedCandidates} regimeLabel={marketStress.regimeLabel} />

      <PlainEnglish>
        A <Term term="strategy">strategy</Term> is a fixed research rule for entering, exiting, and sizing a simulated position.
        Each card below shows how the rule behaved on real past prices — a <Term term="backtest">backtest</Term>. Green-tinted
        numbers are good, red are warning signs. Remember: doing well in the past is evidence, not a promise.
      </PlainEnglish>

      <MethodologyCallout
        items={[
          "Signals are generated from completed daily bars and modeled with next-open execution.",
          "Backtests include strategy-level slippage, per-trade fees, stops, trailing stops, and max-holding exits where defined.",
          "No intraday fills, market impact, margin, shorts, options, or live order routing are modeled.",
          "Strategy metrics come from the backtest engine and remain unchanged by memo text.",
        ]}
      />

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
        {filtered.map(({ candidate, intel }) => (
          <StrategyCard
            key={candidate.result.strategyId}
            result={candidate.result}
            score={candidate.score}
            status={candidate.status}
            diagnostics={stressDiagnostics[candidate.result.strategyId]}
            intel={intel}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <EmptyState title="No matching strategies" message="Adjust the status or symbol filter. All strategy results come from the current data and backtest pipeline." />
      )}
    </div>
  );
}

function StrategyQualityBoard({
  items,
  regimeLabel,
}: {
  items: Array<{
    candidate: Awaited<ReturnType<typeof getResearchDataset>>["radarCandidates"][number];
    intel: ReturnType<typeof buildStrategyIntel>;
  }>;
  regimeLabel: string;
}) {
  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const avgQuality = avg(items.map(({ candidate }) => candidate.score));
  const avgRegimeFit = avg(items.map(({ intel }) => intel.regimeFit.score));
  const avgCatalyst = avg(items.map(({ intel }) => intel.catalystSensitivity.score));
  const observationEligible = items.filter(({ intel }) => intel.researchGate.kind === "observe").length;
  const top = items.slice(0, 3);
  return (
    <section className="card relative overflow-hidden p-5 panel-glow">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-label">Strategy Quality Matrix</div>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
            Each model is scored across quality, risk, factor exposure, regime fit, and catalyst sensitivity before it can enter simulated observation.
          </p>
        </div>
        <span className="chip border-line bg-white/[0.04] text-ink-soft">{regimeLabel}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MatrixStat label="Avg quality" value={`${avgQuality}/100`} />
        <MatrixStat label="Avg regime fit" value={`${avgRegimeFit}/100`} />
        <MatrixStat label="Catalyst sensitivity" value={`${avgCatalyst}/100`} />
        <MatrixStat label="Observation eligible" value={`${observationEligible}/${items.length}`} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {top.map(({ candidate, intel }) => (
          <div key={candidate.result.strategyId} className="rounded-2xl border border-line bg-white/[0.025] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12.5px] font-semibold text-white">{candidate.result.strategyName}</div>
                <div className="mt-0.5 text-[11px] text-ink-soft">{candidate.result.symbol} · {candidate.status}</div>
              </div>
              <div className="num text-[18px] font-semibold text-cyan-100">{candidate.score}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              <span>Risk {intel.downsideRiskPriority.score}</span>
              <span>Regime {intel.regimeFit.score}</span>
              <span>Factor {intel.factorExposure[0]?.tilt ?? "n/a"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatrixStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile !p-3.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{label}</div>
      <div className="num mt-1.5 text-[20px] font-semibold text-white">{value}</div>
    </div>
  );
}

function StressSummaryStrip({
  candidates,
  diagnostics,
}: {
  candidates: Awaited<ReturnType<typeof getResearchDataset>>["radarCandidates"];
  diagnostics: Awaited<ReturnType<typeof getResearchDataset>>["stressDiagnostics"];
}) {
  const diags = candidates.map((c) => diagnostics[c.result.strategyId]).filter(Boolean);
  const resilient = diags.filter((d) => d.status === "stable").length;
  const watch = diags.filter((d) => d.status === "watch").length;
  const underStress = diags.filter((d) => d.status === "under stress").length;
  const paperReady = diags.filter((d) => d.paperSuitable).length;
  const cells: Array<[string, number, string]> = [
    ["Resilient", resilient, "text-emerald-300"],
    ["Watch", watch, "text-amber-300"],
    ["Under stress", underStress, "text-rose-300"],
    ["Paper-suitable", paperReady, "text-cyan-200"],
  ];
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <div className="panel-title">Stress Diagnostics Summary</div>
        <span className="text-[11px] text-ink-soft">Stable / Watch / Under Stress, classified under the current regime</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cells.map(([label, value, cls]) => (
          <div key={label} className="rounded-xl border border-line bg-white/[0.025] p-3">
            <div className={`num text-[22px] font-semibold ${cls}`}>{value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
