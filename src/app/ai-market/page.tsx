import MarketInsightCard from "@/components/cards/MarketInsightCard";
import StatusBadge from "@/components/badges/StatusBadge";
import { getResearchDataset } from "@/lib/research";
import { pct, num } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function AIMarketPage() {
  const { factors, marketSummary, metadata } = await getResearchDataset();
  const above = factors.filter((factor) => factor.aboveSma200).length;
  const avgMom20 = factors.reduce((sum, factor) => sum + (factor.momentum20d ?? 0), 0) / Math.max(factors.length, 1);
  const avgVol = factors.reduce((sum, factor) => sum + (factor.volatility20d ?? 0), 0) / Math.max(factors.length, 1);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L4 AI Market</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Market Summary From Real OHLCV Data</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          No OpenAI or Claude call is used yet. The text is generated deterministically from real factor and backtest metrics.
        </p>
      </header>

      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={marketSummary.tone} />
          <span className="text-[12px] text-ink-muted">{marketSummary.dataNote}</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{marketSummary.summary}</p>
        <p className="mt-2 text-[13px] text-ink-muted">{marketSummary.risk}</p>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MarketInsightCard label="Above SMA200" value={`${above}/${factors.length}`} detail="Trend filter across the default watchlist." />
        <MarketInsightCard label="Average 20d return" value={pct(avgMom20)} detail="Calculated from 20-day close-to-close returns." />
        <MarketInsightCard label="Average 20d volatility" value={pct(avgVol)} detail="Annualized from daily returns." />
        <MarketInsightCard label="Adjusted sources" value={`${metadata.adjustedCount}/${metadata.symbolCount}`} detail="Corporate-action-adjusted price series used when available." />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {factors.map((factor) => (
          <div key={factor.symbol} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-ink">{factor.symbol}</div>
              <StatusBadge status={factor.aboveSma200 ? "trend ok" : "trend weak"} />
            </div>
            <div className="mt-3 space-y-1.5 text-[12px] text-ink-muted">
              <div className="flex justify-between"><span>Mom 20d</span><span className="num text-ink">{factor.momentum20d === null ? "n/a" : pct(factor.momentum20d)}</span></div>
              <div className="flex justify-between"><span>Vol 20d</span><span className="num text-ink">{factor.volatility20d === null ? "n/a" : pct(factor.volatility20d)}</span></div>
              <div className="flex justify-between"><span>RSI</span><span className="num text-ink">{factor.rsi14 === null ? "n/a" : num(factor.rsi14, 1)}</span></div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
