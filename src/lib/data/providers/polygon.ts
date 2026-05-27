import type { HistoricalPriceResult, MarketPrice, PriceRange } from "@/types/market";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("polygon");

interface PolygonAggsResponse {
  status?: string;
  resultsCount?: number;
  results?: Array<{
    t: number; // ms epoch (UTC midnight of trading day)
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }>;
  error?: string;
  message?: string;
}

function rangeDates(range: PriceRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCFullYear(to.getUTCFullYear() - (range === "3y" ? 3 : 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/**
 * Polygon.io aggregates API (free tier).
 *  - 5 requests per minute on the free key
 *  - Polygon's `adjusted=true` query param backfills splits + dividends.
 *
 * Throws on transport failure / empty payload; the composite provider
 * is responsible for catching and falling through to the next tier.
 */
export async function fetchPolygonHistoricalPrices(
  symbol: string,
  range: PriceRange,
): Promise<HistoricalPriceResult> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("POLYGON_API_KEY not configured");

  const { from, to } = rangeDates(range);
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;

  const response = await fetch(url, {
    headers: { "user-agent": "factorforge/0.1" },
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) {
    throw new Error(`Polygon HTTP ${response.status}`);
  }
  const payload = (await response.json()) as PolygonAggsResponse;
  if (payload.status === "ERROR" || !payload.results || payload.results.length === 0) {
    throw new Error(payload.error ?? payload.message ?? "Polygon empty result");
  }

  const prices: MarketPrice[] = payload.results
    .map<MarketPrice | null>((row) => {
      if (![row.o, row.h, row.l, row.c, row.v].every(Number.isFinite)) return null;
      return {
        date: new Date(row.t).toISOString().slice(0, 10),
        open: Number(row.o.toFixed(4)),
        high: Number(row.h.toFixed(4)),
        low: Number(row.l.toFixed(4)),
        close: Number(row.c.toFixed(4)),
        rawClose: row.c,
        adjustedClose: row.c, // Polygon already returns adjusted values
        adjustmentRatio: 1,
        volume: row.v,
      };
    })
    .filter((row): row is MarketPrice => row !== null);

  if (prices.length < 40) {
    throw new Error(`Polygon returned only ${prices.length} bars`);
  }

  const updatedAt = new Date().toISOString();
  log.info("polygon fetch ok", { symbol, range, rows: prices.length });
  return {
    symbol,
    range,
    prices,
    provider: "Polygon.io aggregates API",
    isFallback: false,
    status: "ok",
    message: "Real daily OHLCV from Polygon (split + dividend adjusted)",
    updatedAt,
    quality: {
      adjusted: true,
      source: "polygon",
      fetchedAt: updatedAt,
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}
