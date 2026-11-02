import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAlphaVantageHistoricalPrices } from "./alphaVantage";

function makeSeries(count: number, startYear = new Date().getUTCFullYear()) {
  // Recent dates (relative to now) so the adapter's rolling range cutoff keeps them.
  const series: Record<string, Record<string, string>> = {};
  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.UTC(startYear, 0, 2 + index)).toISOString().slice(0, 10);
    series[date] = {
      "1. open": String(100 + index),
      "2. high": String(102 + index),
      "3. low": String(98 + index),
      "4. close": String(101 + index),
      "5. volume": String(1_000_000),
    };
  }
  return series;
}

function stubFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => payload })));
}

describe("fetchAlphaVantageHistoricalPrices", () => {
  beforeEach(() => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ALPHA_VANTAGE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("parses the daily series ascending and honestly labels it unadjusted", async () => {
    stubFetch({ "Time Series (Daily)": makeSeries(45) });

    const result = await fetchAlphaVantageHistoricalPrices("AAPL", "1y");

    expect(result.isFallback).toBe(false);
    expect(result.status).toBe("ok");
    // Free tier is NOT split/dividend adjusted; the adapter must say so.
    expect(result.quality).toMatchObject({ adjusted: false, source: "alphaVantage", rows: 45 });
    const dates = result.prices.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
    expect(result.prices[0]).toMatchObject({ open: 100, high: 102, low: 98, close: 101, adjustmentRatio: 1 });
  });

  it("drops the rows outside the requested range window", async () => {
    const recent = makeSeries(45);
    const stale = makeSeries(5, 2015); // far older than any rolling 1y/3y window
    stubFetch({ "Time Series (Daily)": { ...stale, ...recent } });

    const result = await fetchAlphaVantageHistoricalPrices("AAPL", "1y");

    expect(result.prices).toHaveLength(45);
    expect(result.prices.every((p) => p.date >= "2016-01-01")).toBe(true);
  });

  it("drops rows with non-numeric fields instead of poisoning the series", async () => {
    const series = makeSeries(45);
    const firstKey = Object.keys(series)[0];
    series[firstKey]["4. close"] = "not-a-number";
    stubFetch({ "Time Series (Daily)": series });

    const result = await fetchAlphaVantageHistoricalPrices("AAPL", "1y");

    expect(result.prices).toHaveLength(44);
    expect(result.prices.every((p) => Number.isFinite(p.close))).toBe(true);
  });

  it("throws without an API key so the composite tier can fall through", async () => {
    delete process.env.ALPHA_VANTAGE_API_KEY;
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow(
      "ALPHA_VANTAGE_API_KEY not configured",
    );
  });

  it("treats quota notes and error payloads as failures, never as data", async () => {
    stubFetch({ Note: "25 requests per day exceeded" });
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow("rate-limited");

    stubFetch({ Information: "Please subscribe to a premium plan" });
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow("rate-limited");

    stubFetch({ "Error Message": "Invalid API call" });
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow("Invalid API call");

    stubFetch({}, false, 503);
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow("Alpha Vantage HTTP 503");

    stubFetch({});
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow("empty time series");
  });

  it("throws when too few bars survive the range cutoff", async () => {
    stubFetch({ "Time Series (Daily)": makeSeries(10) });
    await expect(fetchAlphaVantageHistoricalPrices("AAPL", "1y")).rejects.toThrow(
      "Alpha Vantage returned only 10 bars",
    );
  });
});
