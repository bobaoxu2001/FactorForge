import "server-only";
import { createHash } from "node:crypto";
import type { BacktestResult } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import { getDb } from "./db";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface BacktestCacheKey {
  strategyId: string;
  market: HistoricalPriceResult;
  benchmark: HistoricalPriceResult;
}

export function buildBacktestCacheKey(key: BacktestCacheKey): { cacheKey: string; fingerprint: string } {
  const fingerprint = JSON.stringify({
    s: key.strategyId,
    m: {
      sym: key.market.symbol,
      rows: key.market.prices.length,
      first: key.market.quality.firstDate,
      last: key.market.quality.lastDate,
      fb: key.market.isFallback,
      adj: key.market.quality.adjusted,
    },
    b: {
      sym: key.benchmark.symbol,
      rows: key.benchmark.prices.length,
      last: key.benchmark.quality.lastDate,
      fb: key.benchmark.isFallback,
    },
  });
  const hash = createHash("sha1").update(fingerprint).digest("hex").slice(0, 16);
  return {
    cacheKey: `${key.strategyId}::${key.market.symbol}::${hash}`,
    fingerprint,
  };
}

export function readBacktestFromCache(cacheKey: string): BacktestResult | null {
  const db = getDb();
  if (!db) return null;
  try {
    const row = db
      .prepare<[string], { payload: string; created_at: number }>(
        "SELECT payload, created_at FROM backtest_cache WHERE cache_key = ?",
      )
      .get(cacheKey);
    if (!row) return null;
    if (Date.now() - row.created_at > CACHE_TTL_MS) return null;
    return JSON.parse(row.payload) as BacktestResult;
  } catch {
    return null;
  }
}

export function writeBacktestToCache(cacheKey: string, fingerprint: string, result: BacktestResult): void {
  const db = getDb();
  if (!db) return;
  try {
    db.prepare(
      `INSERT INTO backtest_cache (cache_key, strategy_id, symbol, fingerprint, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         fingerprint = excluded.fingerprint,
         payload = excluded.payload,
         created_at = excluded.created_at`,
    ).run(cacheKey, result.strategyId, result.symbol, fingerprint, JSON.stringify(result), Date.now());
  } catch {
    // swallow — persistence is best-effort
  }
}

export interface CacheStats {
  rowCount: number;
  oldestCreatedAt: number | null;
  newestCreatedAt: number | null;
}

export function getCacheStats(): CacheStats {
  const db = getDb();
  if (!db) return { rowCount: 0, oldestCreatedAt: null, newestCreatedAt: null };
  try {
    const row = db
      .prepare<[], { c: number; oldest: number | null; newest: number | null }>(
        "SELECT COUNT(*) as c, MIN(created_at) as oldest, MAX(created_at) as newest FROM backtest_cache",
      )
      .get();
    return {
      rowCount: row?.c ?? 0,
      oldestCreatedAt: row?.oldest ?? null,
      newestCreatedAt: row?.newest ?? null,
    };
  } catch {
    return { rowCount: 0, oldestCreatedAt: null, newestCreatedAt: null };
  }
}
