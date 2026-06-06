import { describe, expect, it } from "vitest";
import type { BacktestResult } from "@/types/backtest";
import type { RadarCandidate } from "@/types/strategy";
import { buildPaperAccountSummary, buildPaperObservations } from "./paperTrading";

function candidate(status: RadarCandidate["status"], overrides: Partial<BacktestResult["metrics"]> = {}): RadarCandidate {
  const result: BacktestResult = {
    symbol: "AAPL",
    strategyId: `strategy-${status}`,
    strategyName: "Quality Momentum Breakout",
    description: "test",
    type: "breakout",
    signals: [{ date: "2024-01-03", type: "buy", price: 100, reason: "test signal" }],
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
      isFallback: false,
      message: "test",
      updatedAt: "2024-01-01T00:00:00.000Z",
      adjusted: true,
    },
    metrics: {
      totalReturn: 0.12,
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
      lastSignalDate: "2024-01-03",
      ...overrides,
    },
  };

  return {
    rank: 1,
    score: 86,
    status,
    result,
    reasons: ["test"],
    nextAction: "Eligible for simulated observation review",
  };
}

describe("paper observation controls", () => {
  it("admits only radar candidates into simulated observation", () => {
    const observations = buildPaperObservations([
      candidate("radar candidate"),
      candidate("continue observing"),
      candidate("rejected"),
    ]);

    expect(observations).toHaveLength(1);
    expect(observations[0].status).toBe("holding");
  });

  it("uses local paper ledger return when a ledger snapshot exists", () => {
    const c = candidate("radar candidate");
    const observations = buildPaperObservations([c], 1, {
      ledgerSnapshots: {
        [`${c.result.strategyId}-${c.result.symbol}`]: {
          source: "persistent",
          positionId: `${c.result.strategyId}-${c.result.symbol}`,
          status: "open",
          promotedAt: Date.parse("2026-06-01T00:00:00.000Z"),
          promotedAtIso: "2026-06-01T00:00:00.000Z",
          entryDate: "2026-06-01",
          entryPrice: 100,
          currentDate: "2026-06-04",
          currentPrice: 103,
          shares: 200,
          allocatedCapital: 20_000,
          marketValue: 20_600,
          unrealizedPnl: 600,
          returnPct: 0.03,
          daysLive: 3,
          note: "test ledger",
        },
      },
    });

    expect(observations[0].simulatedReturn).toBe(0.03);
    expect(observations[0].ledger?.source).toBe("persistent");
  });

  it("summarizes account-level risk guardrails", () => {
    const observations = buildPaperObservations([
      candidate("radar candidate"),
      candidate("radar candidate", { maxDrawdown: -0.18 }),
    ]);
    const account = buildPaperAccountSummary(observations);

    expect(account.simulatedCapital).toBe(100_000);
    expect(account.exposurePct).toBe(0.4);
    expect(account.maxObservedDrawdown).toBe(-0.18);
    expect(account.riskBudgetStatus).toBe("within limits");
    expect(account.guardrails.some((item) => item.includes("radar candidates"))).toBe(true);
  });

  it("caps observation slots at the requested maxSlots (N_eff gate)", () => {
    const distinct = (id: string): RadarCandidate => {
      const c = candidate("radar candidate");
      return { ...c, result: { ...c.result, strategyId: id } };
    };
    const candidates = [distinct("a"), distinct("b"), distinct("c")];

    // Effective bets ≈ 1 → only one slot, even though three candidates qualify.
    const observations = buildPaperObservations(candidates, 1);
    expect(observations).toHaveLength(1);

    const account = buildPaperAccountSummary(observations, {
      maxSlots: 1,
      slotNote: "Observation slots capped at the effective number of independent bets (N_eff 1.0) → 1 of 3.",
    });
    expect(account.observationSlots).toBe(1);
    expect(account.guardrails.some((g) => g.includes("N_eff"))).toBe(true);
  });
});
