import type { HistoricalPriceResult, PriceRange } from "@/types/market";
import { DEFAULT_SYMBOLS } from "@/data/watchlist";
import { fetchYahooHistoricalPrices } from "./providers/yahoo";

export async function getHistoricalPrices(
  symbol: string,
  range: PriceRange = "3y",
): Promise<HistoricalPriceResult> {
  const normalized = symbol.trim().toUpperCase();
  return fetchYahooHistoricalPrices(normalized, range);
}

export async function getWatchlistPrices(range: PriceRange = "3y") {
  const results = await Promise.all(DEFAULT_SYMBOLS.map((symbol) => getHistoricalPrices(symbol, range)));
  return Object.fromEntries(results.map((result) => [result.symbol, result]));
}
