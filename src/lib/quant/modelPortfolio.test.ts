import { describe, expect, it } from "vitest";
import type { BacktestResult, EquityPoint } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import type { RadarCandidate } from "@/types/strategy";
import { buildModelPortfolioHeadline, buildModelPortfolioPerformance } from "./modelPortfolio";

function equityCurve(points: Array<[string, number]>): EquityPoint[] {
  return points.map(([date, equity]) => ({
    date,
    equity,
    cash: equity,
    positionValue: 0,
    drawdown: 0,
    benchmarkEquity: equity,
  }));
}

function makeResult(
  strategyId: string,
  strategyName: string,
  symbol: string,
  curve: Array<[string, number]>,
  opts: { isFallback?: boolean; adjusted?: boolean; provider?: string } = {},
): BacktestResult {
  return {
    symbol,
    strategyId,
    strategyName,
    description: "test strategy",
    type: "momentum",
    signals: [],
    trades: [],
    equityCurve: equityCurve(curve),
    metrics: {
      totalReturn: 0,
      annualizedReturn: 0,
      benchmarkReturn: 0,
      excessReturn: 0,
      maxDrawdown: 0,
      sharpe: 0,
      winRate: 0,
      profitFactor: 0,
      tradeCount: 0,
      averageHoldingDays: 0,
      volatility: 0,
      currentPosition: "flat",
      lastSignalDate: null,
    },
    riskFlags: [],
    recommendation: "",
    assumptions: {
      initialCapital: 100_000,
      positionFraction: 0.2,
      stopLossPct: 0.08,
      trailingStopPct: 0.12,
      maxHoldingDays: 45,
      execution: "next_open",
      slippageBps: 5,
      feePerTrade: 1,
    },
    dataStatus: {
      provider: opts.provider ?? "test",
      isFallback: opts.isFallback ?? false,
      message: "test",
      updatedAt: "",
      adjusted: opts.adjusted ?? true,
    },
  };
}

function makeCandidate(result: BacktestResult, rank: number, status: RadarCandidate["status"] = "radar candidate"): RadarCandidate {
  return { rank, score: 90 - rank, status, result, reasons: [], nextAction: "" };
}

function benchmark(symbol: string, closes: Array<[string, number]>): HistoricalPriceResult {
  const prices = closes.map(([date, close]) => ({ date, open: close, high: close, low: close, close, volume: 1_000_000 }));
  return {
    symbol,
    range: "3y",
    prices,
    provider: "test-bench",
    isFallback: false,
    status: "ok",
    message: "test",
    updatedAt: "",
    quality: {
      adjusted: true,
      source: "yahoo",
      fetchedAt: "",
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}

const DATES = ["2026-04-30", "2026-05-01", "2026-05-04", "2026-05-05"] as const;

function baseInput() {
  const a = makeResult("alpha", "Alpha", "AAA", [
    ["2026-04-30", 95],
    ["2026-05-01", 100],
    ["2026-05-04", 110],
    ["2026-05-05", 120],
  ]);
  const b = makeResult("beta", "Beta", "BBB", [
    ["2026-04-30", 190],
    ["2026-05-01", 200],
    ["2026-05-04", 200],
    ["2026-05-05", 220],
  ]);
  const pricesBySymbol: Record<string, HistoricalPriceResult> = {
    SPY: benchmark("SPY", [
      ["2026-04-30", 396],
      ["2026-05-01", 400],
      ["2026-05-04", 404],
      ["2026-05-05", 408],
    ]),
    QQQ: benchmark("QQQ", [
      ["2026-04-30", 348],
      ["2026-05-01", 350],
      ["2026-05-04", 360],
      ["2026-05-05", 364],
    ]),
  };
  return {
    radarCandidates: [makeCandidate(a, 1), makeCandidate(b, 2)],
    strategyResults: [a, b],
    pricesBySymbol,
    generatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("buildModelPortfolioPerformance — Since May simulated model portfolio", () => {
  it("equal-weights normalized strategy curves and indexes the portfolio to 100 on the start date", () => {
    const data = buildModelPortfolioPerformance(baseInput());
    expect(data.available).toBe(true);
    expect(data.startDate).toBe("2026-05-01");
    expect(data.endDate).toBe("2026-05-05");
    expect(data.startAdjusted).toBe(false);
    expect(data.tradingDays).toBe(3);
    expect(data.strategyCount).toBe(2);
    // start indexed to 100; values are the equal-weight average of normalized curves
    expect(data.equityCurve[0].value).toBeCloseTo(100, 6);
    expect(data.equityCurve[1].value).toBeCloseTo(105, 6); // (1.10 + 1.00) / 2 * 100
    expect(data.equityCurve[2].value).toBeCloseTo(115, 6); // (1.20 + 1.10) / 2 * 100
    expect(data.totalReturn).toBeCloseTo(0.15, 6);
  });

  it("reports SPY and QQQ benchmarks with SPY as the primary excess-return reference", () => {
    const data = buildModelPortfolioPerformance(baseInput());
    const spy = data.benchmarks.find((b) => b.symbol === "SPY");
    const qqq = data.benchmarks.find((b) => b.symbol === "QQQ");
    expect(spy?.totalReturn).toBeCloseTo(0.02, 6); // 408 / 400 - 1
    expect(qqq?.totalReturn).toBeCloseTo(0.04, 6); // 364 / 350 - 1
    expect(data.primaryBenchmarkSymbol).toBe("SPY");
    expect(data.benchmarkReturn).toBeCloseTo(0.02, 6);
    expect(data.excessReturn).toBeCloseTo(0.13, 6); // 0.15 - 0.02
    // benchmark curve is normalized to 100 at the start, same calendar as the portfolio
    expect(data.benchmarkCurve[0].spy).toBeCloseTo(100, 6);
    expect(data.benchmarkCurve[2].spy).toBeCloseTo(102, 6); // 408 / 400 * 100
    expect(data.benchmarkCurve.length).toBe(data.equityCurve.length);
  });

  it("computes drawdown, win rate, and Sharpe from the portfolio curve", () => {
    const data = buildModelPortfolioPerformance(baseInput());
    expect(data.maxDrawdown).toBeCloseTo(0, 6); // monotonic up
    expect(data.currentDrawdown).toBeCloseTo(0, 6);
    expect(data.winRate).toBeCloseTo(1, 6); // every day positive
    expect(Number.isFinite(data.sharpe)).toBe(true);
  });

  it("rolls the start forward to the first session after May 1 when May 1 is not a trading day", () => {
    const input = baseInput();
    // Drop the May 1 bar from every strategy so May 1 is no longer a trading day.
    const trim = (curve: Array<[string, number]>) => curve.filter(([date]) => date !== "2026-05-01");
    const a = makeResult("alpha", "Alpha", "AAA", trim([
      ["2026-04-30", 95],
      ["2026-05-01", 100],
      ["2026-05-04", 110],
      ["2026-05-05", 120],
    ]));
    const b = makeResult("beta", "Beta", "BBB", trim([
      ["2026-04-30", 190],
      ["2026-05-01", 200],
      ["2026-05-04", 200],
      ["2026-05-05", 220],
    ]));
    const data = buildModelPortfolioPerformance({
      ...input,
      radarCandidates: [makeCandidate(a, 1), makeCandidate(b, 2)],
      strategyResults: [a, b],
    });
    expect(data.startDate).toBe("2026-05-04");
    expect(data.startAdjusted).toBe(true);
    expect(data.notes.some((note) => note.includes("rolled forward"))).toBe(true);
  });

  it("falls back to the catalog's best-per-strategy runs when the radar shortlist is thin", () => {
    const input = baseInput();
    const data = buildModelPortfolioPerformance({ ...input, radarCandidates: [] });
    expect(data.available).toBe(true);
    expect(data.strategyCount).toBe(2);
  });

  it("excludes rejected and concentration-demoted candidates from the blend", () => {
    const input = baseInput();
    const a = input.strategyResults[0];
    const b = input.strategyResults[1];
    const rejected = makeCandidate(a, 1, "rejected");
    const demoted: RadarCandidate = {
      ...makeCandidate(b, 2),
      redundancy: { correlatedWith: "alpha", correlation: 0.97, demoted: true },
    };
    // Both radar entries are unusable → it should fall back to strategyResults, not silently drop to zero.
    const data = buildModelPortfolioPerformance({ ...input, radarCandidates: [rejected, demoted] });
    expect(data.available).toBe(true);
    expect(data.strategyCount).toBe(2);
  });

  it("reports unavailable when there is no trading data on or after May 1", () => {
    const aprilOnly = makeResult("alpha", "Alpha", "AAA", [
      ["2026-04-28", 100],
      ["2026-04-29", 101],
      ["2026-04-30", 102],
    ]);
    const data = buildModelPortfolioPerformance({
      radarCandidates: [],
      strategyResults: [aprilOnly],
      pricesBySymbol: {},
    });
    expect(data.available).toBe(false);
    expect(data.equityCurve).toHaveLength(0);
    expect(data.notes[0]).toMatch(/not enough/i);
  });

  it("derives the May 1 start year from the freshest data date, not the wall clock", () => {
    const input = baseInput();
    const data = buildModelPortfolioPerformance(input);
    expect(data.requestedStartDate).toBe("2026-05-01");
  });

  it("flags fallback/demo data in the data-quality block", () => {
    const a = makeResult("alpha", "Alpha", "AAA", [
      ["2026-05-01", 100],
      ["2026-05-04", 110],
    ], { isFallback: true });
    const b = makeResult("beta", "Beta", "BBB", [
      ["2026-05-01", 200],
      ["2026-05-04", 220],
    ]);
    const data = buildModelPortfolioPerformance({
      radarCandidates: [makeCandidate(a, 1), makeCandidate(b, 2)],
      strategyResults: [a, b],
      pricesBySymbol: {},
    });
    expect(data.dataQuality.isFallback).toBe(true);
    expect(data.dataQuality.label).toMatch(/fallback/i);
  });

  it("writes a carefully-worded, research-only headline with no real-money claim", () => {
    const headline = buildModelPortfolioHeadline(buildModelPortfolioPerformance(baseInput()));
    expect(headline).toContain("simulated model portfolio");
    expect(headline).toContain("not a live trading account");
    expect(headline.toLowerCase()).not.toContain("guaranteed");
    expect(headline.toLowerCase()).not.toContain("we made");
  });
});
