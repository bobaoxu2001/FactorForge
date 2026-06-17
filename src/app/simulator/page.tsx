import PageHeader from "@/components/layout/PageHeader";
import PlainEnglish from "@/components/learn/PlainEnglish";
import SimTradingDesk, { type SimQuote } from "@/components/sim/SimTradingDesk";
import { UNIVERSE } from "@/data/watchlist";
import { getWatchlistPrices } from "@/lib/data/marketData";

// Prices are fetched per request so the desk always fills at the freshest close.
export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const prices = await getWatchlistPrices("3y");

  const quotes: SimQuote[] = UNIVERSE.map((c) => {
    const result = prices[c.symbol];
    const last = result?.prices.at(-1);
    return {
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
      price: last?.close ?? 0,
      asOf: last?.date ?? null,
      isFallback: result?.isFallback ?? true,
    };
  }).filter((q) => q.price > 0);

  const asOf = quotes.map((q) => q.asOf).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  const anyFallback = quotes.some((q) => q.isFallback);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Trade Simulator"
        title="Paper trading desk"
        subtitle={`Start with virtual cash, buy and sell any of the ${quotes.length} universe names at their latest close, and watch your return update live. Simulation only — virtual money, no broker, no real orders. Your book is saved in your browser.`}
      />

      <PlainEnglish>
        This is a stock-market sandbox. You get <strong>$100,000 of pretend money</strong>, &ldquo;buy&rdquo; and
        &ldquo;sell&rdquo; real companies at their most recent market price, and the desk keeps score: how much your
        account is worth and your total return so far. Nothing here touches real money or a real broker — it&rsquo;s a
        safe way to see how a portfolio moves.
      </PlainEnglish>

      <SimTradingDesk quotes={quotes} asOf={asOf} anyFallback={anyFallback} />
    </div>
  );
}
