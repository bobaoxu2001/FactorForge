import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYahooHistoricalPrices } from "./yahoo";

describe("fetchYahooHistoricalPrices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses adjusted close and adjusts OHLC consistently when Yahoo provides adjusted data", async () => {
    const rows = 45;
    const timestamps = Array.from({ length: rows }, (_, index) => 1_700_000_000 + index * 86_400);
    const close = Array.from({ length: rows }, (_, index) => 100 + index);
    const adjclose = close.map((value) => value / 2);

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            timestamp: timestamps,
            indicators: {
              quote: [{
                open: close,
                high: close.map((value) => value + 2),
                low: close.map((value) => value - 2),
                close,
                volume: close.map(() => 1000),
              }],
              adjclose: [{ adjclose }],
            },
          }],
        },
      }),
    })));

    const result = await fetchYahooHistoricalPrices("AAPL", "1y");

    expect(result.isFallback).toBe(false);
    expect(result.quality.adjusted).toBe(true);
    expect(result.prices[0]).toMatchObject({
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      rawClose: 100,
      adjustedClose: 50,
      adjustmentRatio: 0.5,
    });
  });
});
