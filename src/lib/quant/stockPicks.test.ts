import { describe, expect, it } from "vitest";
import type { FactorSnapshot } from "@/types/market";
import type { SignalConsensusReport } from "@/lib/quant/signalConsensus";
import { buildStockPicks, percentileRank, rsiBalanceScore, type StockPickInputs } from "./stockPicks";

function makeSnapshot(symbol: string, overrides: Partial<FactorSnapshot> = {}): FactorSnapshot {
  return {
    symbol,
    date: "2026-07-17",
    momentum20d: 0.03,
    momentum60d: 0.08,
    volatility20d: 0.18,
    volumeSurge: 1.0,
    aboveSma200: true,
    rsi14: 55,
    provider: "yahoo",
    isFallback: false,
    adjusted: true,
    ...overrides,
  };
}

function makeConsensus(picks: Array<{ symbol: string; agreeCount: number; types?: string[] }>): SignalConsensusReport {
  return {
    asOf: "2026-07-17",
    strategyCount: 5,
    symbolsScanned: 28,
    picks: picks.map((p) => ({
      symbol: p.symbol,
      agreeCount: p.agreeCount,
      strategyTypes: p.types ?? ["trend"],
      legs: [],
      averageScore: 70,
      resonance: p.agreeCount >= 2,
    })),
    consensusCount: picks.filter((p) => p.agreeCount >= 2).length,
    topPick: null,
    verdict: "test",
  };
}

function makeInputs(overrides: Partial<StockPickInputs> = {}): StockPickInputs {
  return {
    factors: [makeSnapshot("AAPL"), makeSnapshot("MSFT"), makeSnapshot("JNJ")],
    consensus: makeConsensus([]),
    regime: { regime: "stable", stressScore: 20 },
    generatedAt: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildStockPicks", () => {
  it("ranks stronger momentum above weaker in a stable regime, all else equal", () => {
    const report = buildStockPicks(
      makeInputs({
        factors: [
          makeSnapshot("AAPL", { momentum60d: 0.02 }),
          makeSnapshot("MSFT", { momentum60d: 0.2 }),
          makeSnapshot("JNJ", { momentum60d: 0.1 }),
        ],
      }),
    );
    expect(report.picks.map((p) => p.symbol)).toEqual(["MSFT", "JNJ", "AAPL"]);
    expect(report.picks[0].rank).toBe(1);
  });

  it("excludes benchmark ETFs from the cross-section", () => {
    const report = buildStockPicks(
      makeInputs({ factors: [makeSnapshot("AAPL"), makeSnapshot("SPY"), makeSnapshot("QQQ")] }),
    );
    expect(report.picks.map((p) => p.symbol)).toEqual(["AAPL"]);
  });

  it("excludes names with incomplete factor rows and counts them in coverage", () => {
    const report = buildStockPicks(
      makeInputs({
        factors: [makeSnapshot("AAPL"), makeSnapshot("MSFT", { rsi14: null })],
      }),
    );
    expect(report.picks.map((p) => p.symbol)).toEqual(["AAPL"]);
    expect(report.coverage).toMatchObject({ scanned: 2, scored: 1, excluded: 1 });
  });

  it("shifts rank toward low-volatility names under the stress regime", () => {
    const factors = [
      // Hot: best momentum, worst volatility.
      makeSnapshot("NVDA", { momentum60d: 0.3, volatility20d: 0.5 }),
      // Calm: modest momentum, lowest volatility.
      makeSnapshot("JNJ", { momentum60d: 0.05, volatility20d: 0.1 }),
      makeSnapshot("AAPL", { momentum60d: 0.12, volatility20d: 0.25 }),
    ];
    const stable = buildStockPicks(makeInputs({ factors }));
    const stress = buildStockPicks(makeInputs({ factors, regime: { regime: "stress", stressScore: 80 } }));

    expect(stable.picks[0].symbol).toBe("NVDA");
    expect(stress.picks[0].symbol).toBe("JNJ");
  });

  it("lifts a name's score when independent strategies hold it", () => {
    const factors = [makeSnapshot("AAPL"), makeSnapshot("MSFT")];
    const without = buildStockPicks(makeInputs({ factors }));
    const withEvidence = buildStockPicks(
      makeInputs({ factors, consensus: makeConsensus([{ symbol: "AAPL", agreeCount: 3, types: ["trend", "breakout"] }]) }),
    );

    const scoreOf = (report: ReturnType<typeof buildStockPicks>, symbol: string) =>
      report.picks.find((p) => p.symbol === symbol)!.compositeScore;
    expect(scoreOf(withEvidence, "AAPL")).toBeGreaterThan(scoreOf(without, "AAPL"));
    expect(withEvidence.picks.find((p) => p.symbol === "AAPL")!.heldByStrategies).toBe(3);
  });

  it("caps fallback-data names at the monitor tier and says why", () => {
    const report = buildStockPicks(
      makeInputs({
        factors: [
          makeSnapshot("AAPL", { isFallback: true, momentum60d: 0.5, volumeSurge: 2 }),
          makeSnapshot("MSFT", { momentum60d: 0.01 }),
        ],
        consensus: makeConsensus([{ symbol: "AAPL", agreeCount: 3 }]),
      }),
    );
    const aapl = report.picks.find((p) => p.symbol === "AAPL")!;
    expect(aapl.tier).toBe("monitor");
    expect(aapl.isFallbackData).toBe(true);
    expect(aapl.caveats.some((c) => c.includes("fallback"))).toBe(true);
    expect(report.coverage.fallbackData).toBe(1);
  });

  it("uses weights that sum to 1 under every regime", () => {
    for (const regime of ["stable", "caution", "stress"] as const) {
      const report = buildStockPicks(makeInputs({ regime: { regime, stressScore: 50 } }));
      const total = Object.values(report.weights).reduce((sum, w) => sum + w, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("degrades honestly when nothing can be scored", () => {
    const report = buildStockPicks(makeInputs({ factors: [makeSnapshot("SPY")] }));
    expect(report.picks).toEqual([]);
    expect(report.verdict).toContain("No universe name");
  });

  it("names the top pick in the verdict without forecasting", () => {
    const report = buildStockPicks(makeInputs());
    expect(report.verdict).toContain(report.picks[0].symbol);
    expect(report.verdict).toContain("not investment advice");
  });
});

describe("percentileRank", () => {
  it("is 50 for a single-element cross-section and monotone otherwise", () => {
    expect(percentileRank(5, [5])).toBe(50);
    expect(percentileRank(1, [1, 2, 3])).toBe(0);
    expect(percentileRank(3, [1, 2, 3])).toBe(100);
    expect(percentileRank(2, [1, 2, 3])).toBe(50);
  });
});

describe("rsiBalanceScore", () => {
  it("rewards the constructive band and penalizes extremes", () => {
    expect(rsiBalanceScore(55)).toBe(100);
    expect(rsiBalanceScore(40)).toBe(100);
    expect(rsiBalanceScore(70)).toBe(100);
    expect(rsiBalanceScore(85)).toBeLessThan(50);
    expect(rsiBalanceScore(20)).toBeLessThan(50);
    expect(rsiBalanceScore(85)).toBeLessThan(rsiBalanceScore(75));
  });
});
