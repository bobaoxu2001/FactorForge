import { describe, expect, it } from "vitest";
import type { BacktestResult } from "@/types/backtest";
import type { PaperObservation, RadarCandidate } from "@/types/strategy";
import { buildDailyReview } from "./dailyReview";
import { buildPaperAccountSummary } from "./paperTrading";

function result(overrides: {
  id?: string;
  symbol?: string;
  totalReturn?: number;
  lastSignalDate?: string;
  lastSignalType?: "buy" | "sell" | "observe";
  isFallback?: boolean;
}): BacktestResult {
  const date = overrides.lastSignalDate ?? "2026-06-01";
  return {
    symbol: overrides.symbol ?? "AAPL",
    strategyId: overrides.id ?? "strategy-a",
    strategyName: "Quality Momentum Breakout",
    description: "test",
    type: "breakout",
    signals: [{ date, type: overrides.lastSignalType ?? "buy", price: 100, reason: "entry" }],
    trades: [],
    equityCurve: [],
    riskFlags: [],
    recommendation: "test",
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
      provider: "test",
      isFallback: overrides.isFallback ?? false,
      message: "test",
      updatedAt: "2026-06-01T00:00:00.000Z",
      adjusted: true,
    },
    metrics: {
      totalReturn: overrides.totalReturn ?? 0.02,
      annualizedReturn: 0.1,
      benchmarkReturn: 0.05,
      excessReturn: 0.05,
      maxDrawdown: -0.12,
      sharpe: 1.2,
      winRate: 0.58,
      profitFactor: 1.4,
      tradeCount: 8,
      averageHoldingDays: 11,
      volatility: 0.18,
      currentPosition: "long",
      lastSignalDate: date,
    },
  };
}

function observation(r: BacktestResult): PaperObservation {
  return {
    id: `${r.strategyId}-${r.symbol}`,
    status: "holding",
    candidate: { rank: 1, score: 86, status: "radar candidate", result: r, reasons: [], nextAction: "" },
    simulatedCapital: 100_000,
    simulatedReturn: r.metrics.totalReturn,
    currentSymbol: r.symbol,
    recentSignal: "test",
    nextCheck: "2026-06-02 09:35 ET",
    ledger: null,
  };
}

describe("buildDailyReview", () => {
  it("tallies winners/losers and finds the weakest leg", () => {
    const observations = [
      observation(result({ id: "a", symbol: "AAPL", totalReturn: 0.05 })),
      observation(result({ id: "b", symbol: "MSFT", totalReturn: 0.02 })),
      observation(result({ id: "c", symbol: "NVDA", totalReturn: -0.03 })),
    ];
    const account = buildPaperAccountSummary(observations);
    const review = buildDailyReview(observations, account);

    expect(review.bookSize).toBe(3);
    expect(review.winners).toBe(2);
    expect(review.losers).toBe(1);
    expect(review.weakest).toEqual({ label: "Quality Momentum Breakout", symbol: "NVDA", returnPct: -0.03 });
    expect(review.asOf).toBe("2026-06-01");
  });

  it("reports the largest same-batch cluster by signal date", () => {
    const observations = [
      observation(result({ id: "a", symbol: "AAPL", lastSignalDate: "2026-06-01" })),
      observation(result({ id: "b", symbol: "MSFT", lastSignalDate: "2026-06-01" })),
      observation(result({ id: "c", symbol: "NVDA", lastSignalDate: "2026-05-27" })),
    ];
    const review = buildDailyReview(observations, buildPaperAccountSummary(observations));
    expect(review.largestBatch).toEqual({ signalDate: "2026-06-01", count: 2 });
  });

  it("counts skipped signals and gate rejections in the tape", () => {
    const observations = [observation(result({ id: "a", totalReturn: 0.04 }))];
    const radarCandidates: RadarCandidate[] = [
      observations[0].candidate,
      { rank: 2, score: 72, status: "continue observing", result: result({ id: "obs" }), reasons: [], nextAction: "" },
      {
        rank: 3,
        score: 81,
        status: "radar candidate",
        result: result({ id: "dup" }),
        reasons: [],
        nextAction: "",
        redundancy: { correlatedWith: "a", correlation: 0.95, demoted: true },
      },
    ];
    const review = buildDailyReview(observations, buildPaperAccountSummary(observations), radarCandidates);
    expect(review.tape.skipped).toBe(1);
    expect(review.tape.rejected).toBe(1);
    expect(review.watchItems.join(" ")).toMatch(/rejected by the concentration gate/);
  });

  it("flags fallback data and the underwater leg in watch items", () => {
    const observations = [
      observation(result({ id: "a", symbol: "AAPL", totalReturn: 0.03, isFallback: true })),
      observation(result({ id: "b", symbol: "MSFT", totalReturn: -0.01 })),
    ];
    const review = buildDailyReview(observations, buildPaperAccountSummary(observations));
    const text = review.watchItems.join(" ");
    expect(text).toMatch(/underwater leg/);
    expect(text).toMatch(/fallback\/demo data/);
  });

  it("degrades cleanly on an empty book", () => {
    const review = buildDailyReview([], buildPaperAccountSummary([]));
    expect(review.bookSize).toBe(0);
    expect(review.winners).toBe(0);
    expect(review.weakest).toBeNull();
    expect(review.largestBatch).toBeNull();
    expect(review.watchItems.length).toBeGreaterThan(0);
  });
});
