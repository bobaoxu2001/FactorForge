import { describe, expect, it } from "vitest";
import { buildPublicTrackRecord } from "./publicTrackRecord";
import type { DailyReview, PaperAccountSummary, PaperObservation, RadarCandidate } from "@/types/strategy";

function candidate(overrides: Partial<RadarCandidate> = {}): RadarCandidate {
  return {
    rank: 1,
    score: 84,
    status: "radar candidate",
    reasons: ["test"],
    nextAction: "Eligible for simulated observation review",
    result: {
      strategyId: "quality-breakout",
      strategyName: "Quality Breakout",
      description: "Test strategy",
      type: "breakout",
      symbol: "AAPL",
      signals: [],
      trades: [],
      equityCurve: [],
      metrics: {
        totalReturn: 0.2,
        annualizedReturn: 0.18,
        benchmarkReturn: 0.08,
        excessReturn: 0.1,
        volatility: 0.2,
        sharpe: 1.1,
        maxDrawdown: -0.12,
        winRate: 0.55,
        profitFactor: 1.6,
        tradeCount: 8,
        averageHoldingDays: 12,
        currentPosition: "long",
        lastSignalDate: "2026-06-03",
      },
      riskFlags: [],
      recommendation: "Radar candidate",
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
        provider: "fixture",
        isFallback: false,
        message: "fixture",
        updatedAt: "2026-06-04T00:00:00.000Z",
        adjusted: true,
      },
    },
    ...overrides,
  };
}

function observation(overrides: Partial<PaperObservation> = {}): PaperObservation {
  const baseCandidate = candidate();
  return {
    id: "quality-breakout-AAPL",
    status: "holding",
    candidate: baseCandidate,
    simulatedCapital: 100_000,
    simulatedReturn: 0.2,
    currentSymbol: "AAPL",
    recentSignal: "2026-06-03 · buy · test",
    nextCheck: "2026-06-05 09:35 ET",
    ledger: {
      source: "persistent",
      positionId: "quality-breakout-AAPL",
      status: "open",
      promotedAt: Date.parse("2026-06-01T00:00:00Z"),
      promotedAtIso: "2026-06-01T00:00:00.000Z",
      entryDate: "2026-06-01",
      entryPrice: 100,
      currentDate: "2026-06-04",
      currentPrice: 112,
      shares: 200,
      allocatedCapital: 20_000,
      marketValue: 22_400,
      unrealizedPnl: 2_400,
      returnPct: 0.12,
      daysLive: 3,
      note: "Tracked from local paper ledger.",
    },
    ...overrides,
  };
}

const account: PaperAccountSummary = {
  simulatedCapital: 100_000,
  observationSlots: 3,
  activeObservations: 2,
  totalAllocatedCapital: 40_000,
  exposurePct: 0.4,
  concentrationPct: 0.2,
  maxObservedDrawdown: -0.14,
  averageRadarScore: 82,
  riskBudgetStatus: "within limits",
  guardrails: [],
};

const dailyReview: DailyReview = {
  asOf: "2026-06-04",
  bookSize: 2,
  winners: 1,
  losers: 1,
  deployedExposurePct: 0.4,
  weakest: null,
  largestBatch: null,
  tape: { entries: 0, exits: 0, skipped: 0, rejected: 0 },
  watchItems: [],
};

describe("buildPublicTrackRecord", () => {
  it("summarizes ledger-backed paper performance from promotion date", () => {
    const record = buildPublicTrackRecord({
      observations: [
        observation(),
        observation({
          id: "defensive-pullback-CAT",
          candidate: candidate({
            score: 80,
            result: {
              ...candidate().result,
              strategyId: "defensive-pullback",
              strategyName: "Defensive Pullback",
              symbol: "CAT",
              metrics: { ...candidate().result.metrics, maxDrawdown: -0.14 },
            },
          }),
          ledger: {
            ...observation().ledger!,
            positionId: "defensive-pullback-CAT",
            entryDate: "2026-06-02",
            currentDate: "2026-06-04",
            marketValue: 19_200,
            unrealizedPnl: -800,
            returnPct: -0.04,
          },
        }),
      ],
      account,
      dailyReview,
      generatedAt: "2026-06-04T12:00:00.000Z",
    });

    expect(record.promotedCount).toBe(2);
    expect(record.ledgerTrackedCount).toBe(2);
    expect(record.unrealizedPnl).toBe(1_600);
    expect(record.ledgerReturnPct).toBeCloseTo(0.04);
    expect(record.oldestEntryDate).toBe("2026-06-01");
    expect(record.latestMarkDate).toBe("2026-06-04");
    expect(record.rows[0]).toMatchObject({ symbol: "AAPL", rank: 1, returnPct: 0.12 });
    expect(record.rows[1]).toMatchObject({ symbol: "CAT", rank: 2, returnPct: -0.04 });
    expect(record.shareLine).toContain("+4.0% ledger return");
  });

  it("keeps public disclosures explicit", () => {
    const record = buildPublicTrackRecord({
      observations: [observation()],
      account,
      dailyReview,
      generatedAt: "2026-06-04T12:00:00.000Z",
    });

    expect(record.disclosureItems.join(" ")).toMatch(/not a brokerage statement/i);
    expect(record.disclosureItems.join(" ")).toMatch(/No live orders/i);
  });
});
