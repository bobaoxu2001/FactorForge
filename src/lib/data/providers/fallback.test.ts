import { describe, expect, it } from "vitest";
import { buildFallbackPrices } from "./fallback";

describe("buildFallbackPrices", () => {
  it("labels deterministic data as fallback and exposes quality metadata", () => {
    const result = buildFallbackPrices("AAPL", "1y", "network unavailable");

    expect(result.isFallback).toBe(true);
    expect(result.quality.source).toBe("fallback");
    expect(result.quality.adjusted).toBe(false);
    expect(result.quality.rows).toBe(result.prices.length);
    expect(result.prices[0].adjustmentRatio).toBe(1);
  });
});
