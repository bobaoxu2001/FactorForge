import { describe, expect, it } from "vitest";
import { calendarDaysBetween, PRICE_STALE_AFTER_DAYS, priceFreshness } from "./freshness";
import { buildSnapshotPrices } from "./marketData";

describe("price freshness", () => {
  it("counts calendar days in UTC", () => {
    expect(calendarDaysBetween("2026-10-30", new Date("2026-11-01T15:00:00Z"))).toBe(2);
    expect(calendarDaysBetween("2026-11-01", new Date("2026-11-01T00:00:01Z"))).toBe(0);
  });

  it("tolerates a weekend plus a holiday but flags older bars", () => {
    expect(priceFreshness("2026-10-30", new Date("2026-11-03T12:00:00Z")).stale).toBe(false);
    expect(priceFreshness("2026-10-20", new Date("2026-11-03T12:00:00Z")).stale).toBe(true);
    expect(PRICE_STALE_AFTER_DAYS).toBeGreaterThanOrEqual(4);
  });

  it("treats a missing last date as stale", () => {
    expect(priceFreshness(null).stale).toBe(true);
  });
});

describe("committed snapshot tier", () => {
  it("surfaces the snapshot age instead of presenting old bars as current", () => {
    const farFuture = new Date("2030-01-01T00:00:00Z");
    const results = buildSnapshotPrices(2_000, farFuture);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.isFallback).toBe(false);
      expect(result.quality.stale).toBe(true);
      expect(result.quality.ageDays).toBeGreaterThan(PRICE_STALE_AFTER_DAYS);
      expect(result.message).toMatch(/STALE: last bar/);
    }
  });

  it("does not flag the snapshot when it is fresh relative to the clock", () => {
    const results = buildSnapshotPrices(2_000, new Date("2026-07-18T12:00:00Z"));
    expect(results.every((result) => result.quality.stale === false)).toBe(true);
    expect(results.every((result) => !/STALE/.test(result.message))).toBe(true);
  });
});
