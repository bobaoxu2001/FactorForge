import type { HistoricalPriceResult, PriceRange } from "@/types/market";

export type ProviderName = "yahoo" | "polygon" | "alphaVantage" | "fallback";

export interface MarketProvider {
  readonly name: ProviderName;
  /** True if this provider is configured (e.g. API key present). */
  isConfigured(): boolean;
  fetchHistorical(symbol: string, range: PriceRange): Promise<HistoricalPriceResult>;
}
