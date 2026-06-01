import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  UNIVERSE,
  DEFAULT_SYMBOLS,
  constituentOf,
  sectorOf,
  sectorCount,
  universeSectorBreakdown,
} from "./watchlist";
import { STRATEGY_CATALOG } from "./strategyCatalog";

describe("research universe", () => {
  it("derives DEFAULT_SYMBOLS from UNIVERSE with no duplicates", () => {
    expect(DEFAULT_SYMBOLS.length).toBe(UNIVERSE.length);
    expect(new Set(DEFAULT_SYMBOLS).size).toBe(DEFAULT_SYMBOLS.length);
  });

  it("is genuinely sector-diversified, not a tech monoculture", () => {
    // The whole point of widening the universe: enough independent sectors that
    // the cross-sectional factors and N_eff analysis are meaningful.
    expect(sectorCount()).toBeGreaterThanOrEqual(8);
    expect(UNIVERSE.length).toBeGreaterThanOrEqual(24);

    // No single sector may dominate the single-name universe (ETFs excluded).
    const stocks = UNIVERSE.filter((c) => c.kind === "stock");
    const breakdown = universeSectorBreakdown(stocks);
    const largest = breakdown[0];
    expect(largest.count / stocks.length).toBeLessThan(0.34);
  });

  it("includes the benchmark ETFs SPY and QQQ as ETF-kind constituents", () => {
    expect(constituentOf("SPY")?.kind).toBe("etf");
    expect(constituentOf("QQQ")?.kind).toBe("etf");
  });

  it("covers every strategy's default symbol", () => {
    for (const strategy of STRATEGY_CATALOG) {
      expect(DEFAULT_SYMBOLS).toContain(strategy.defaultSymbol);
    }
  });

  it("resolves sector/constituent lookups case-insensitively", () => {
    expect(sectorOf("aapl")).toBe("Technology");
    expect(sectorOf("xom")).toBe("Energy");
    expect(constituentOf("jpm")?.name).toBe("JPMorgan Chase");
    expect(sectorOf("NOTREAL")).toBeNull();
  });

  it("sector breakdown counts sum back to the universe size", () => {
    const breakdown = universeSectorBreakdown();
    const total = breakdown.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(total).toBe(UNIVERSE.length);
    // Sorted by descending count.
    const counts = breakdown.map((b) => b.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("matches the committed fixture exactly (rebuild the fixture if this fails)", () => {
    const fixturePath = path.join(process.cwd(), "src", "__fixtures__", "yahoo-snapshot.json");
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
    expect(Object.keys(fixture).sort()).toEqual([...DEFAULT_SYMBOLS].sort());
  });
});
