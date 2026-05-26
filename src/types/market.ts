export type PriceRange = "1y" | "3y";

export interface MarketPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  rawClose?: number;
  adjustedClose?: number;
  adjustmentRatio?: number;
  volume: number;
}

export interface MarketDataQuality {
  adjusted: boolean;
  source: "yahoo" | "fallback";
  fetchedAt: string;
  rows: number;
  firstDate: string | null;
  lastDate: string | null;
}

export interface HistoricalPriceResult {
  symbol: string;
  range: PriceRange;
  prices: MarketPrice[];
  provider: string;
  isFallback: boolean;
  status: "ok" | "fallback" | "error";
  message: string;
  updatedAt: string;
  quality: MarketDataQuality;
}

export interface FactorSnapshot {
  symbol: string;
  date: string;
  momentum20d: number | null;
  momentum60d: number | null;
  volatility20d: number | null;
  volumeSurge: number | null;
  aboveSma200: boolean;
  rsi14: number | null;
  provider: string;
  isFallback: boolean;
  adjusted: boolean;
}
