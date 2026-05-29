import type { HistoricalPriceResult, PriceRange } from "@/types/market";
import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import { fetchHistoricalPricesComposite } from "./providers/composite";

export async function getHistoricalPrices(
  symbol: string,
  range: PriceRange = "3y",
): Promise<HistoricalPriceResult> {
  const normalized = symbol.trim().toUpperCase();
  return fetchHistoricalPricesComposite(normalized, range);
}

// Fan-out fetches respect a small concurrency cap. The fallback providers
// (Polygon / Alpha Vantage free tiers) rate-limit aggressively — ~5 requests/min —
// so blasting all watchlist symbols at once with Promise.all guarantees 429s the
// moment Yahoo is unavailable. A cap of 4 keeps us under that ceiling while still
// overlapping network latency. Override with MARKET_FETCH_CONCURRENCY.
function fetchConcurrency(): number {
  const raw = Number(process.env.MARKET_FETCH_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 4;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function runner(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

export async function getWatchlistPrices(range: PriceRange = "3y") {
  const results = await mapWithConcurrency(DEFAULT_SYMBOLS, fetchConcurrency(), (symbol) =>
    getHistoricalPrices(symbol, range),
  );
  return Object.fromEntries(results.map((result) => [result.symbol, result]));
}
