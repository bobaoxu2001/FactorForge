import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoricalPriceResult } from "@/types/market";

// Exercises the watchlist fan-out layer above the composite provider:
// mixed-provider universes, partial-universe fallbacks, cache behavior after a
// rejection, and the concurrency cap. The composite provider itself is mocked
// per symbol so every scenario is deterministic and offline.

const CACHE_KEY = "__factorforgeWatchlistPriceCache";

function makeResult(
  symbol: string,
  source: HistoricalPriceResult["quality"]["source"],
  overrides: Partial<HistoricalPriceResult> = {},
): HistoricalPriceResult {
  const isFallback = source === "fallback";
  return {
    symbol,
    range: "3y",
    prices: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(2024, 0, 2 + i).toISOString().slice(0, 10),
      open: 100,
      high: 100,
      low: 100,
      close: 100 + i,
      volume: 1_000_000,
    })),
    provider: source,
    isFallback,
    status: isFallback ? "fallback" : "ok",
    message: isFallback ? "synthetic" : "ok",
    updatedAt: "",
    quality: { adjusted: !isFallback, source, fetchedAt: "", rows: 30, firstDate: "", lastDate: "" },
    ...overrides,
  };
}

describe("getWatchlistPrices — watchlist fan-out", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown> & typeof globalThis)[CACHE_KEY as never];
    // Skip the snapshot race so the mocked composite results are what we assert on.
    process.env.MARKET_LIVE_WAIT_MS = "0";
    delete process.env.MARKET_FETCH_CONCURRENCY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete (globalThis as Record<string, unknown> & typeof globalThis)[CACHE_KEY as never];
    vi.restoreAllMocks();
  });

  it("keeps per-symbol provider labels in a mixed-provider universe", async () => {
    vi.doMock("@/data/watchlist", () => ({ DEFAULT_SYMBOLS: ["AAA", "BBB", "CCC"] }));
    const bySymbol: Record<string, HistoricalPriceResult> = {
      AAA: makeResult("AAA", "yahoo"),
      BBB: makeResult("BBB", "polygon"),
      CCC: makeResult("CCC", "fallback"),
    };
    vi.doMock("./providers/composite", () => ({
      fetchHistoricalPricesComposite: vi.fn(async (symbol: string) => bySymbol[symbol]),
    }));

    const mod = await import("./marketData");
    const prices = await mod.getWatchlistPrices("3y");

    expect(Object.keys(prices).sort()).toEqual(["AAA", "BBB", "CCC"]);
    expect(prices.AAA.quality.source).toBe("yahoo");
    expect(prices.BBB.quality.source).toBe("polygon");
    expect(prices.CCC.quality.source).toBe("fallback");
    // Partial universe: only the symbol that exhausted real providers is
    // labeled fallback — a fallback neighbor never taints real results.
    expect(prices.AAA.isFallback).toBe(false);
    expect(prices.BBB.isFallback).toBe(false);
    expect(prices.CCC.isFallback).toBe(true);
  });

  it("serves every symbol even when the whole universe degrades to fallback", async () => {
    vi.doMock("@/data/watchlist", () => ({ DEFAULT_SYMBOLS: ["AAA", "BBB"] }));
    vi.doMock("./providers/composite", () => ({
      fetchHistoricalPricesComposite: vi.fn(async (symbol: string) => makeResult(symbol, "fallback")),
    }));

    const mod = await import("./marketData");
    const prices = await mod.getWatchlistPrices("3y");

    expect(Object.keys(prices)).toHaveLength(2);
    expect(Object.values(prices).every((r) => r.isFallback)).toBe(true);
    expect(Object.values(prices).every((r) => r.status === "fallback")).toBe(true);
  });

  it("caches the fan-out and does not refetch within the TTL", async () => {
    vi.doMock("@/data/watchlist", () => ({ DEFAULT_SYMBOLS: ["AAA", "BBB"] }));
    const fetchFn = vi.fn(async (symbol: string) => makeResult(symbol, "yahoo"));
    vi.doMock("./providers/composite", () => ({ fetchHistoricalPricesComposite: fetchFn }));

    const mod = await import("./marketData");
    await mod.getWatchlistPrices("3y");
    await mod.getWatchlistPrices("3y");

    expect(fetchFn).toHaveBeenCalledTimes(2); // once per symbol, not per call
  });

  it("does not poison the cache when the fan-out rejects", async () => {
    vi.doMock("@/data/watchlist", () => ({ DEFAULT_SYMBOLS: ["AAA"] }));
    const fetchFn = vi
      .fn<(symbol: string) => Promise<HistoricalPriceResult>>()
      .mockRejectedValueOnce(new Error("transient network explosion"))
      .mockImplementation(async (symbol: string) => makeResult(symbol, "yahoo"));
    vi.doMock("./providers/composite", () => ({ fetchHistoricalPricesComposite: fetchFn }));

    const mod = await import("./marketData");
    await expect(mod.getWatchlistPrices("3y")).rejects.toThrow("transient network explosion");

    // The failed promise must have been evicted so the next call retries.
    const prices = await mod.getWatchlistPrices("3y");
    expect(prices.AAA.quality.source).toBe("yahoo");
  });

  it("respects MARKET_FETCH_CONCURRENCY as a cap on in-flight fetches", async () => {
    process.env.MARKET_FETCH_CONCURRENCY = "1";
    vi.doMock("@/data/watchlist", () => ({ DEFAULT_SYMBOLS: ["AAA", "BBB", "CCC", "DDD"] }));

    let inFlight = 0;
    let maxInFlight = 0;
    vi.doMock("./providers/composite", () => ({
      fetchHistoricalPricesComposite: vi.fn(async (symbol: string) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return makeResult(symbol, "yahoo");
      }),
    }));

    const mod = await import("./marketData");
    const prices = await mod.getWatchlistPrices("3y");

    expect(Object.keys(prices)).toHaveLength(4);
    expect(maxInFlight).toBe(1);
  });

  it("falls back to the committed snapshot when live providers exceed the wait budget", async () => {
    // The snapshot path requires every watchlist symbol to exist in the
    // committed fixture, so pin the universe to real fixture symbols.
    process.env.MARKET_LIVE_WAIT_MS = "1";
    vi.doMock("@/data/watchlist", () => ({ DEFAULT_SYMBOLS: ["AAPL", "SPY"] }));
    vi.doMock("./providers/composite", () => ({
      fetchHistoricalPricesComposite: vi.fn(() => new Promise<HistoricalPriceResult>(() => {})),
    }));

    const mod = await import("./marketData");
    const prices = await mod.getWatchlistPrices("3y");

    const results = Object.values(prices);
    expect(results.length).toBeGreaterThan(0);
    // Snapshot data is real (not synthetic) and labeled as the snapshot source.
    expect(results.every((r) => !r.isFallback)).toBe(true);
    expect(results.every((r) => r.provider.includes("snapshot"))).toBe(true);
    expect(results.every((r) => r.quality.source === "yahoo")).toBe(true);
  });
});
