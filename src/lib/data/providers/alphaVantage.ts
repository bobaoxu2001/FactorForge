import type { HistoricalPriceResult, MarketPrice, PriceRange } from "@/types/market";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("alphaVantage");

interface AlphaVantageDailyResponse {
  "Time Series (Daily)"?: Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    }
  >;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

/**
 * Alpha Vantage TIME_SERIES_DAILY (free tier).
 *  - 25 API calls/day on the free key — use as last-resort real-data tier.
 *  - The free endpoint does NOT include split/dividend adjustment; the
 *    paid endpoint (TIME_SERIES_DAILY_ADJUSTED) does. We honestly mark
 *    quality.adjusted = false for the free path.
 *
 * Throws on transport failure / quota note; composite provider catches.
 */
export async function fetchAlphaVantageHistoricalPrices(
  symbol: string,
  range: PriceRange,
): Promise<HistoricalPriceResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY not configured");

  const outputsize = range === "3y" ? "full" : "compact";
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${apiKey}`;

  const response = await fetch(url, {
    headers: { "user-agent": "factorforge/0.1" },
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) throw new Error(`Alpha Vantage HTTP ${response.status}`);

  const payload = (await response.json()) as AlphaVantageDailyResponse;
  if (payload["Error Message"]) throw new Error(`Alpha Vantage error: ${payload["Error Message"]}`);
  if (payload.Note || payload.Information) {
    // Rate-limit notice
    throw new Error(`Alpha Vantage rate-limited: ${payload.Note ?? payload.Information}`);
  }
  const series = payload["Time Series (Daily)"];
  if (!series) throw new Error("Alpha Vantage empty time series");

  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - (range === "3y" ? 3 : 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const prices: MarketPrice[] = Object.entries(series)
    .filter(([date]) => date >= cutoffStr)
    .map<MarketPrice | null>(([date, row]) => {
      const open = Number(row["1. open"]);
      const high = Number(row["2. high"]);
      const low = Number(row["3. low"]);
      const close = Number(row["4. close"]);
      const volume = Number(row["5. volume"]);
      if (![open, high, low, close, volume].every(Number.isFinite)) return null;
      return {
        date,
        open: Number(open.toFixed(4)),
        high: Number(high.toFixed(4)),
        low: Number(low.toFixed(4)),
        close: Number(close.toFixed(4)),
        rawClose: close,
        adjustedClose: close,
        adjustmentRatio: 1,
        volume,
      };
    })
    .filter((row): row is MarketPrice => row !== null)
    .sort((a: MarketPrice, b: MarketPrice) => (a.date < b.date ? -1 : 1));

  if (prices.length < 40) throw new Error(`Alpha Vantage returned only ${prices.length} bars`);

  const updatedAt = new Date().toISOString();
  log.info("alphaVantage fetch ok", { symbol, range, rows: prices.length });
  return {
    symbol,
    range,
    prices,
    provider: "Alpha Vantage TIME_SERIES_DAILY",
    isFallback: false,
    status: "ok",
    message: "Real daily OHLCV from Alpha Vantage (free tier: NOT adjusted for corporate actions)",
    updatedAt,
    quality: {
      adjusted: false,
      source: "alphaVantage",
      fetchedAt: updatedAt,
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}
