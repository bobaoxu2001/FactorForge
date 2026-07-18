import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNIVERSE } from "@/data/watchlist";
import { getSnapshotFundamentals, parseQuoteSummary } from "./fundamentals";

const CACHE_KEY = "__factorforgeFundamentalsCache";

describe("parseQuoteSummary", () => {
  it("normalizes raw Yahoo fields and labels the row as live", () => {
    const snapshot = parseQuoteSummary("AAPL", {
      quoteSummary: {
        result: [
          {
            summaryDetail: {
              trailingPE: { raw: 30.5 },
              forwardPE: { raw: 27.1 },
              dividendYield: { raw: 0.005 },
              marketCap: { raw: 3e12 },
            },
            defaultKeyStatistics: { priceToBook: { raw: 40.2 }, enterpriseToEbitda: { raw: 25.3 } },
            financialData: {
              profitMargins: { raw: 0.26 },
              operatingMargins: { raw: 0.31 },
              returnOnEquity: { raw: 1.2 },
              revenueGrowth: { raw: 0.08 },
              earningsGrowth: { raw: 0.11 },
            },
          },
        ],
      },
    });

    expect(snapshot).toMatchObject({
      symbol: "AAPL",
      source: "yahoo",
      trailingPE: 30.5,
      forwardPE: 27.1,
      priceToBook: 40.2,
      evToEbitda: 25.3,
      profitMargin: 0.26,
      operatingMargin: 0.31,
      returnOnEquity: 1.2,
      revenueGrowthYoY: 0.08,
      earningsGrowthYoY: 0.11,
      dividendYield: 0.005,
      marketCap: 3e12,
    });
  });

  it("returns nulls for missing fields instead of guessing", () => {
    const snapshot = parseQuoteSummary("XYZ", { quoteSummary: { result: [{}] } });
    expect(snapshot.trailingPE).toBeNull();
    expect(snapshot.returnOnEquity).toBeNull();
  });

  it("throws on an empty payload so the tier can fall through", () => {
    expect(() => parseQuoteSummary("XYZ", { quoteSummary: { result: [] } })).toThrow();
  });
});

describe("getSnapshotFundamentals — committed fixture", () => {
  it("covers every single-name stock in the universe and no ETFs (drift guard)", () => {
    const snapshot = getSnapshotFundamentals();
    const stocks = UNIVERSE.filter((c) => c.kind === "stock").map((c) => c.symbol);
    expect(Object.keys(snapshot).sort()).toEqual([...stocks].sort());
    expect(snapshot.SPY).toBeUndefined();
    expect(snapshot.QQQ).toBeUndefined();
  });

  it("labels every row as a snapshot with an as-of date", () => {
    for (const row of Object.values(getSnapshotFundamentals())) {
      expect(row.source).toBe("snapshot");
      expect(row.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("getUniverseFundamentals — live tier fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown> & typeof globalThis)[CACHE_KEY as never];
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown> & typeof globalThis)[CACHE_KEY as never];
    delete process.env.FUNDAMENTALS_WAIT_MS;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("degrades to the labeled snapshot when the live handshake fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network unreachable");
    }));

    const mod = await import("./fundamentals");
    const result = await mod.getUniverseFundamentals();

    expect(Object.keys(result).length).toBeGreaterThan(0);
    expect(Object.values(result).every((row) => row.source === "snapshot")).toBe(true);
  });

  it("skips the live tier entirely when the wait budget is zero", async () => {
    process.env.FUNDAMENTALS_WAIT_MS = "0";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const mod = await import("./fundamentals");
    const result = await mod.getUniverseFundamentals();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Object.values(result).every((row) => row.source === "snapshot")).toBe(true);
  });
});
