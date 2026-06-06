import type { HistoricalPriceResult, PriceRange } from "@/types/market";
import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import fixtureSnapshot from "@/__fixtures__/yahoo-snapshot.json";
import { fetchHistoricalPricesComposite } from "./providers/composite";

const LIVE_DATA_WAIT_MS = 2_000;
const WATCHLIST_PRICE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

interface CachedWatchlistPrices {
  expiresAt: number;
  promise: Promise<Record<string, HistoricalPriceResult>>;
}

const watchlistPriceCacheKey = "__factorforgeWatchlistPriceCache";
const globalWatchlistPriceCache = globalThis as typeof globalThis & {
  __factorforgeWatchlistPriceCache?: Map<string, CachedWatchlistPrices>;
};
const watchlistPriceCache =
  globalWatchlistPriceCache[watchlistPriceCacheKey] ?? new Map<string, CachedWatchlistPrices>();
globalWatchlistPriceCache[watchlistPriceCacheKey] = watchlistPriceCache;

export async function getHistoricalPrices(
  symbol: string,
  range: PriceRange = "3y",
): Promise<HistoricalPriceResult> {
  const normalized = symbol.trim().toUpperCase();
  return fetchHistoricalPricesComposite(normalized, range);
}

// Fan-out fetches respect a small concurrency cap. The fallback providers
// (Polygon / Alpha Vantage free tiers) rate-limit aggressively — ~5 requests/min —
// so blasting all watchlist symbols at once with Promise.all tends to trigger 429s the
// moment Yahoo is unavailable. A cap of 8 keeps live Yahoo demos crisp while
// still avoiding an unbounded burst. Override with MARKET_FETCH_CONCURRENCY.
function fetchConcurrency(): number {
  const raw = Number(process.env.MARKET_FETCH_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 8;
}

function liveDataWaitMs(): number {
  const raw = Number(process.env.MARKET_LIVE_WAIT_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return LIVE_DATA_WAIT_MS;
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
  const cacheKey = `${range}::${fetchConcurrency()}::${liveDataWaitMs()}`;
  const now = Date.now();
  const cached = watchlistPriceCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = getWatchlistPricesUncached(range);
  watchlistPriceCache.set(cacheKey, { expiresAt: now + WATCHLIST_PRICE_CACHE_MAX_AGE_MS, promise });

  try {
    return await promise;
  } catch (error) {
    watchlistPriceCache.delete(cacheKey);
    throw error;
  }
}

async function getWatchlistPricesUncached(range: PriceRange): Promise<Record<string, HistoricalPriceResult>> {
  const liveResults = mapWithConcurrency(DEFAULT_SYMBOLS, fetchConcurrency(), (symbol) => getHistoricalPrices(symbol, range));

  const waitMs = liveDataWaitMs();
  if (range !== "3y" || waitMs === 0) {
    const results = await liveResults;
    return Object.fromEntries(results.map((result) => [result.symbol, result]));
  }

  const results = await Promise.race([
    liveResults,
    new Promise<HistoricalPriceResult[]>((resolve) => {
      setTimeout(() => resolve(buildSnapshotPrices(waitMs)), waitMs);
    }),
  ]);

  return Object.fromEntries(results.map((result) => [result.symbol, result]));
}

function buildSnapshotPrices(waitMs: number): HistoricalPriceResult[] {
  const snapshot = fixtureSnapshot as Record<string, HistoricalPriceResult>;
  return DEFAULT_SYMBOLS.map((symbol) => {
    const result = snapshot[symbol];
    if (!result) throw new Error(`Missing committed Yahoo snapshot for ${symbol}`);
    return {
      ...result,
      provider: "Yahoo Finance chart API snapshot",
      message: `Committed real Yahoo snapshot used after live provider exceeded ${Math.round(waitMs / 1000)}s demo wait budget; coverage dates remain visible.`,
      status: "ok",
      isFallback: false,
      quality: {
        ...result.quality,
        source: "yahoo",
      },
    };
  });
}
