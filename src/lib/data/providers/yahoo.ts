import type { HistoricalPriceResult, MarketPrice, PriceRange } from "@/types/market";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function providerTimeoutMs(): number {
  const raw = Number(process.env.MARKET_PROVIDER_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 2_000;
}

export async function fetchYahooHistoricalPrices(
  symbol: string,
  range: PriceRange,
): Promise<HistoricalPriceResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=1d&events=history&includeAdjustedClose=true`;

  // This provider throws on any failure rather than self-downgrading to synthetic
  // data. The composite layer owns the fallback decision so it can try the next
  // real-data tier (Polygon, Alpha Vantage) before giving up.
  const timeoutMs = providerTimeoutMs();
  const response = await fetch(url, {
    headers: { "user-agent": "ai-stock-platform/0.1 research-mvp" },
    next: { revalidate: 60 * 60 },
    signal: timeoutMs > 0 && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const adjustedCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const timestamps = result?.timestamp ?? [];

  if (!result || !quote || timestamps.length === 0) {
    throw new Error(payload.chart?.error?.description ?? "Yahoo Finance returned empty data");
  }

  const prices = timestamps
    .map<MarketPrice | null>((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const adjustedClose = adjustedCloses[index];
      const volume = quote.volume?.[index];
      if (
        !isFiniteNumber(open) ||
        !isFiniteNumber(high) ||
        !isFiniteNumber(low) ||
        !isFiniteNumber(close) ||
        !isFiniteNumber(volume)
      ) {
        return null;
      }
      const hasAdjustedClose = isFiniteNumber(adjustedClose) && close > 0;
      const adjustmentRatio = hasAdjustedClose ? adjustedClose / close : 1;
      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: Number((open * adjustmentRatio).toFixed(4)),
        high: Number((high * adjustmentRatio).toFixed(4)),
        low: Number((low * adjustmentRatio).toFixed(4)),
        close: Number((hasAdjustedClose ? adjustedClose : close).toFixed(4)),
        rawClose: close,
        adjustedClose: hasAdjustedClose ? adjustedClose : close,
        adjustmentRatio,
        volume,
      };
    })
    .filter((price): price is MarketPrice => price !== null);

  if (prices.length < 40) {
    throw new Error("Yahoo Finance returned insufficient daily bars");
  }

  const updatedAt = new Date().toISOString();
  const adjustedRows = prices.filter((price) => price.adjustmentRatio !== undefined && price.adjustmentRatio !== 1).length;

  return {
    symbol,
    range,
    prices,
    provider: "Yahoo Finance chart API",
    isFallback: false,
    status: "ok",
    message: adjustedRows > 0 ? "Real daily OHLCV data loaded and adjusted for corporate actions" : "Real daily OHLCV data loaded",
    updatedAt,
    quality: {
      adjusted: adjustedRows > 0,
      source: "yahoo",
      fetchedAt: updatedAt,
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}
