import type { HistoricalPriceResult, PriceRange } from "@/types/market";
import { createLogger } from "@/lib/observability/logger";
import { buildFallbackPrices } from "./fallback";
import { fetchYahooHistoricalPrices } from "./yahoo";
import { fetchPolygonHistoricalPrices } from "./polygon";
import { fetchAlphaVantageHistoricalPrices } from "./alphaVantage";

const log = createLogger("composite-provider");

interface ProviderAttempt {
  name: string;
  enabled: boolean;
  call: () => Promise<HistoricalPriceResult>;
}

/**
 * Fan-out across real-data providers in priority order:
 *   1. Yahoo Finance chart (no key, our default)
 *   2. Polygon.io aggregates       (requires POLYGON_API_KEY)
 *   3. Alpha Vantage daily         (requires ALPHA_VANTAGE_API_KEY)
 *   4. Deterministic synthetic     (always — labeled `isFallback: true`)
 *
 * Each tier is tried in order; the first non-fallback success wins.
 * Errors and per-tier reasons are logged with structure so the
 * /admin/cache page can correlate them later.
 */
export async function fetchHistoricalPricesComposite(
  symbol: string,
  range: PriceRange,
): Promise<HistoricalPriceResult> {
  const attempts: ProviderAttempt[] = [
    { name: "yahoo",        enabled: true,                                       call: () => fetchYahooHistoricalPrices(symbol, range) },
    { name: "polygon",      enabled: Boolean(process.env.POLYGON_API_KEY),       call: () => fetchPolygonHistoricalPrices(symbol, range) },
    { name: "alphaVantage", enabled: Boolean(process.env.ALPHA_VANTAGE_API_KEY), call: () => fetchAlphaVantageHistoricalPrices(symbol, range) },
  ];

  const reasons: Array<{ name: string; error?: string; skipped?: boolean }> = [];
  for (const attempt of attempts) {
    if (!attempt.enabled) {
      reasons.push({ name: attempt.name, skipped: true });
      continue;
    }
    try {
      const result = await attempt.call();
      // Yahoo's provider already builds its own fallback on failure — recognize
      // that and continue rather than treating it as a real-data success.
      if (result.isFallback) {
        reasons.push({ name: attempt.name, error: `provider returned fallback: ${result.message}` });
        log.info("provider downgraded to fallback, trying next tier", { symbol, provider: attempt.name });
        continue;
      }
      log.info("provider hit", { symbol, range, provider: attempt.name, rows: result.prices.length });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reasons.push({ name: attempt.name, error: message });
      log.warn("provider failed, falling through", { symbol, range, provider: attempt.name, error: message });
    }
  }

  const summary = reasons
    .map((r) => (r.skipped ? `${r.name}: skipped (no key)` : `${r.name}: ${r.error ?? "unknown"}`))
    .join(" | ");
  log.warn("all real-data providers exhausted, using synthetic fallback", { symbol, reasons: summary });
  return buildFallbackPrices(symbol, range, `All real-data providers failed: ${summary}`);
}
