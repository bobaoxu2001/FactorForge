import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoricalPriceResult } from "@/types/market";

// We mock the three real-data providers and the synthetic fallback so we can
// drive the composite path deterministically. Module mocks must be set BEFORE
// the dynamic import inside each test.

describe("composite provider — fan-out cascade", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.POLYGON_API_KEY;
    delete process.env.ALPHA_VANTAGE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  function makeReal(symbol: string, source: HistoricalPriceResult["quality"]["source"]): HistoricalPriceResult {
    return {
      symbol,
      range: "3y",
      prices: Array.from({ length: 60 }, (_, i) => ({
        date: new Date(2024, 0, 2 + i).toISOString().slice(0, 10),
        open: 100,
        high: 100,
        low: 100,
        close: 100 + i,
        volume: 1_000_000,
      })),
      provider: source,
      isFallback: false,
      status: "ok",
      message: "ok",
      updatedAt: "",
      quality: { adjusted: true, source, fetchedAt: "", rows: 60, firstDate: "", lastDate: "" },
    };
  }
  function makeFallback(symbol: string, message: string): HistoricalPriceResult {
    const r = makeReal(symbol, "fallback");
    r.isFallback = true;
    r.status = "fallback";
    r.message = message;
    r.quality.source = "fallback";
    r.quality.adjusted = false;
    return r;
  }

  it("returns yahoo first when yahoo succeeds with real data", async () => {
    vi.doMock("./yahoo", () => ({ fetchYahooHistoricalPrices: vi.fn(async () => makeReal("AAPL", "yahoo")) }));
    vi.doMock("./polygon", () => ({ fetchPolygonHistoricalPrices: vi.fn(async () => { throw new Error("should not be called"); }) }));
    vi.doMock("./alphaVantage", () => ({ fetchAlphaVantageHistoricalPrices: vi.fn(async () => { throw new Error("should not be called"); }) }));
    vi.doMock("./fallback", () => ({ buildFallbackPrices: vi.fn(() => { throw new Error("should not be called"); }) }));

    const mod = await import("./composite");
    const result = await mod.fetchHistoricalPricesComposite("AAPL", "3y");
    expect(result.isFallback).toBe(false);
    expect(result.quality.source).toBe("yahoo");
  });

  it("falls through to polygon when yahoo downgrades to fallback and POLYGON_API_KEY is set", async () => {
    process.env.POLYGON_API_KEY = "test-key";
    vi.doMock("./yahoo", () => ({
      fetchYahooHistoricalPrices: vi.fn(async () => makeFallback("AAPL", "yahoo http 500")),
    }));
    const polygonFn = vi.fn(async () => makeReal("AAPL", "polygon"));
    vi.doMock("./polygon", () => ({ fetchPolygonHistoricalPrices: polygonFn }));
    vi.doMock("./alphaVantage", () => ({ fetchAlphaVantageHistoricalPrices: vi.fn(async () => { throw new Error("nope"); }) }));
    vi.doMock("./fallback", () => ({ buildFallbackPrices: vi.fn(() => { throw new Error("should not reach"); }) }));

    const mod = await import("./composite");
    const result = await mod.fetchHistoricalPricesComposite("AAPL", "3y");
    expect(polygonFn).toHaveBeenCalledOnce();
    expect(result.quality.source).toBe("polygon");
  });

  it("falls through to alphaVantage when yahoo + polygon both fail", async () => {
    process.env.POLYGON_API_KEY = "p";
    process.env.ALPHA_VANTAGE_API_KEY = "a";
    vi.doMock("./yahoo", () => ({ fetchYahooHistoricalPrices: vi.fn(async () => { throw new Error("yahoo down"); }) }));
    vi.doMock("./polygon", () => ({ fetchPolygonHistoricalPrices: vi.fn(async () => { throw new Error("polygon 429"); }) }));
    const avFn = vi.fn(async () => makeReal("AAPL", "alphaVantage"));
    vi.doMock("./alphaVantage", () => ({ fetchAlphaVantageHistoricalPrices: avFn }));
    vi.doMock("./fallback", () => ({ buildFallbackPrices: vi.fn(() => { throw new Error("should not reach"); }) }));

    const mod = await import("./composite");
    const result = await mod.fetchHistoricalPricesComposite("AAPL", "3y");
    expect(avFn).toHaveBeenCalledOnce();
    expect(result.quality.source).toBe("alphaVantage");
  });

  it("uses the synthetic fallback only after every real-data provider is exhausted", async () => {
    process.env.POLYGON_API_KEY = "p";
    process.env.ALPHA_VANTAGE_API_KEY = "a";
    vi.doMock("./yahoo", () => ({ fetchYahooHistoricalPrices: vi.fn(async () => { throw new Error("yahoo dns"); }) }));
    vi.doMock("./polygon", () => ({ fetchPolygonHistoricalPrices: vi.fn(async () => { throw new Error("polygon 401"); }) }));
    vi.doMock("./alphaVantage", () => ({ fetchAlphaVantageHistoricalPrices: vi.fn(async () => { throw new Error("av quota"); }) }));
    const fbFn = vi.fn(() => makeFallback("AAPL", "all real-data failed"));
    vi.doMock("./fallback", () => ({ buildFallbackPrices: fbFn }));

    const mod = await import("./composite");
    const result = await mod.fetchHistoricalPricesComposite("AAPL", "3y");
    expect(fbFn).toHaveBeenCalledOnce();
    expect(result.isFallback).toBe(true);
  });

  it("skips a provider that has no API key configured", async () => {
    // No POLYGON_API_KEY, no ALPHA_VANTAGE_API_KEY: only yahoo + fallback
    const yahooFn = vi.fn(async () => { throw new Error("yahoo offline"); });
    const polygonFn = vi.fn(async () => makeReal("AAPL", "polygon"));
    const avFn = vi.fn(async () => makeReal("AAPL", "alphaVantage"));
    vi.doMock("./yahoo", () => ({ fetchYahooHistoricalPrices: yahooFn }));
    vi.doMock("./polygon", () => ({ fetchPolygonHistoricalPrices: polygonFn }));
    vi.doMock("./alphaVantage", () => ({ fetchAlphaVantageHistoricalPrices: avFn }));
    vi.doMock("./fallback", () => ({ buildFallbackPrices: vi.fn(() => makeFallback("AAPL", "synthetic")) }));

    const mod = await import("./composite");
    const result = await mod.fetchHistoricalPricesComposite("AAPL", "3y");
    expect(yahooFn).toHaveBeenCalledOnce();
    expect(polygonFn).not.toHaveBeenCalled();
    expect(avFn).not.toHaveBeenCalled();
    expect(result.isFallback).toBe(true);
  });
});
