import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPolygonHistoricalPrices } from "./polygon";

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    t: Date.UTC(2024, 0, 2 + index),
    o: 100 + index,
    h: 102 + index,
    l: 98 + index,
    c: 101 + index,
    v: 1_000_000,
  }));
}

function stubFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => payload })));
}

describe("fetchPolygonHistoricalPrices", () => {
  beforeEach(() => {
    process.env.POLYGON_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.POLYGON_API_KEY;
    vi.unstubAllGlobals();
  });

  it("parses aggregates into adjusted MarketPrice rows with honest quality labels", async () => {
    stubFetch({ status: "OK", resultsCount: 45, results: makeRows(45) });

    const result = await fetchPolygonHistoricalPrices("AAPL", "1y");

    expect(result.isFallback).toBe(false);
    expect(result.status).toBe("ok");
    // Polygon serves adjusted=true, so the adapter labels quality accordingly.
    expect(result.quality).toMatchObject({ adjusted: true, source: "polygon", rows: 45 });
    expect(result.prices[0]).toMatchObject({
      date: "2024-01-02",
      open: 100,
      high: 102,
      low: 98,
      close: 101,
      rawClose: 101,
      adjustedClose: 101,
      adjustmentRatio: 1,
      volume: 1_000_000,
    });
    expect(result.quality.firstDate).toBe("2024-01-02");
    expect(result.quality.lastDate).toBe(result.prices[result.prices.length - 1].date);
  });

  it("drops rows with non-finite fields instead of poisoning the series", async () => {
    const rows = makeRows(45);
    (rows[3] as { c: number }).c = NaN;
    stubFetch({ status: "OK", resultsCount: rows.length, results: rows });

    const result = await fetchPolygonHistoricalPrices("AAPL", "1y");

    expect(result.prices).toHaveLength(44);
    expect(result.prices.every((p) => Number.isFinite(p.close))).toBe(true);
  });

  it("throws without an API key so the composite tier can fall through", async () => {
    delete process.env.POLYGON_API_KEY;
    await expect(fetchPolygonHistoricalPrices("AAPL", "1y")).rejects.toThrow("POLYGON_API_KEY not configured");
  });

  it("throws on HTTP failure, API error payloads, and empty results", async () => {
    stubFetch({}, false, 429);
    await expect(fetchPolygonHistoricalPrices("AAPL", "1y")).rejects.toThrow("Polygon HTTP 429");

    stubFetch({ status: "ERROR", error: "Unknown API Key" });
    await expect(fetchPolygonHistoricalPrices("AAPL", "1y")).rejects.toThrow("Unknown API Key");

    stubFetch({ status: "OK", resultsCount: 0, results: [] });
    await expect(fetchPolygonHistoricalPrices("AAPL", "1y")).rejects.toThrow("Polygon empty result");
  });

  it("throws when too few bars survive to support the research pipeline", async () => {
    stubFetch({ status: "OK", resultsCount: 10, results: makeRows(10) });
    await expect(fetchPolygonHistoricalPrices("AAPL", "1y")).rejects.toThrow("Polygon returned only 10 bars");
  });
});
