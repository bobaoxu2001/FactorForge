import PortfolioCurveChart from "@/components/charts/PortfolioCurveChart";
import CorrelationMatrix from "@/components/research/CorrelationMatrix";
import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import PlainEnglish from "@/components/learn/PlainEnglish";
import Term from "@/components/learn/Term";
import { getResearchDataset } from "@/lib/research";
import { concentrationLevel } from "@/lib/quant/signalConcentration";
import { num, pct, pctPlain } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function PortfolioPage() {
  const { portfolio, radarCandidates, metadata } = await getResearchDataset();

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <header>
          <div className="section-label">L5 Portfolio</div>
          <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">Multi-Symbol Portfolio Backtest</h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
            Not enough eligible legs to assemble a portfolio. At least two radar-candidate (or strong continue-observing) results are required.
          </p>
        </header>
        <div className="card p-6 text-[13px] text-ink-muted">
          Current radar pool: {radarCandidates.length} strategies; {radarCandidates.filter((c) => c.status === "radar candidate").length} marked as candidates.
        </div>
      </div>
    );
  }

  const concentration = Math.max(...portfolio.legs.map((leg) => leg.weight));
  const level = concentrationLevel(portfolio.averagePairwiseCorrelation);
  const levelClass =
    level === "high"
      ? "border-rose-300/30 bg-rose-300/[0.06] text-rose-100"
      : level === "medium"
        ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-100"
        : "border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-100";
  const dataNote =
    metadata.fallbackCount === 0
      ? "All legs use real Yahoo daily OHLCV data."
      : `${metadata.fallbackCount}/${metadata.symbolCount} symbols use fallback/demo data.`;

  return (
    <div className="space-y-8">
      <header>
        <div className="section-label">L5 Portfolio</div>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">Multi-Symbol Portfolio Backtest</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Score-weighted blend of the top radar-eligible strategy/symbol pairs. Legs share a calendar via date intersection and are combined in $1-unit returns space, then scaled to the initial capital.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={portfolio.weightScheme} />
          <StatusBadge status={portfolio.rebalance} />
          <StatusBadge status={`benchmark ${portfolio.benchmarkSymbol}`} />
          <span className="text-[12px] text-ink-soft">{dataNote}</span>
        </div>
      </header>

      <PlainEnglish>
        Instead of betting on one strategy, this combines the best few into a single mix — the classic
        &ldquo;don&rsquo;t put all your eggs in one basket.&rdquo; The catch it checks for: if the pieces all move
        together (high <Term term="correlation">correlation</Term>), you&rsquo;re not really diversified. The{" "}
        <Term term="neff">effective bets</Term> number tells you how many genuinely independent bets the mix really
        amounts to — the higher, the safer.
      </PlainEnglish>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total return" value={pct(portfolio.metrics.totalReturn)} tone="positive" termId="return" />
        <MetricCard label="Annualized" value={pct(portfolio.metrics.annualizedReturn)} tone="positive" termId="annualized" />
        <MetricCard label={`vs ${portfolio.benchmarkSymbol}`} value={pct(portfolio.metrics.excessReturn)} tone="accent" termId="benchmark" />
        <MetricCard label="Sharpe" value={num(portfolio.metrics.sharpe)} termId="sharpe" />
        <MetricCard label="Volatility" value={pctPlain(portfolio.metrics.volatility)} termId="volatility" />
        <MetricCard label="Max drawdown" value={pct(portfolio.metrics.maxDrawdown)} termId="drawdown" />
        <MetricCard label="Avg correlation" value={num(portfolio.averagePairwiseCorrelation)} termId="correlation" />
        <MetricCard label="Effective bets" value={num(portfolio.effectiveBets, 1)} tone="accent" termId="neff" />
      </section>

      <section className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[12.5px] ${levelClass}`}>
        <span className="uppercase tracking-wider text-ink-soft">Diversification</span>
        <span className="num text-right">
          {portfolio.legs.length} legs ≈ {num(portfolio.effectiveBets, 1)} independent bets · {level} overlap ·
          max weight {pctPlain(concentration)}
        </span>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr]">
        <PortfolioCurveChart data={portfolio.curve} benchmarkSymbol={portfolio.benchmarkSymbol} />
        <CorrelationMatrix cells={portfolio.correlation} />
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">Leg contributions</div>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-left">Strategy</th>
              <th className="px-4 py-3 text-right">Weight</th>
              <th className="px-4 py-3 text-right">Annualized</th>
              <th className="px-4 py-3 text-right">Sharpe</th>
              <th className="px-4 py-3 text-right">Max drawdown</th>
              <th className="px-4 py-3 text-right">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-soft">
            {portfolio.legs.map((leg) => (
              <tr key={`${leg.symbol}-${leg.strategyId}`}>
                <td className="px-4 py-3 font-medium text-ink">{leg.symbol}</td>
                <td className="px-4 py-3 text-ink-muted">{leg.strategyName}</td>
                <td className="num px-4 py-3 text-right">{pct(leg.weight)}</td>
                <td className="num px-4 py-3 text-right">{pct(leg.legAnnualizedReturn)}</td>
                <td className="num px-4 py-3 text-right">{num(leg.legSharpe)}</td>
                <td className="num px-4 py-3 text-right">{pct(leg.legMaxDrawdown)}</td>
                <td className="num px-4 py-3 text-right">{pct(leg.contributionReturn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="panel-title">Methodology</div>
        <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
          <li>• Eligible legs: radar candidates and continue-observing strategies with Sharpe &gt; 0.5, capped at four.</li>
          <li>• Legs the concentration gate flagged as near-duplicates (&gt; 80% return correlation with a higher-ranked leg) are excluded — the portfolio reuses the same diversification decision as the paper-trade queue.</li>
          <li>• Effective bets = N / (1 + (N−1)·ρ̄), the same N_eff measure shown on the radar panel and home overview.</li>
          <li>• Weights are proportional to the composite radar score; falls back to equal-weight if all scores are non-positive.</li>
          <li>• Calendar = intersection of every leg&apos;s equity-curve dates so the blend uses only days when all legs traded.</li>
          <li>• Each leg&apos;s equity is normalized to a $1 base; the portfolio re-aggregates daily — no intra-day rebalancing assumption.</li>
          <li>• Benchmark is SPY (or the first available substitute) sampled on the same calendar.</li>
          <li>• Correlation cells use Pearson on daily returns; the off-diagonal average drives the diversification badge.</li>
        </ul>
      </section>
    </div>
  );
}
