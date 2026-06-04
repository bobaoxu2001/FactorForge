import { describe, expect, it } from "vitest";
import type { BacktestResult } from "@/types/backtest";
import { buildSignalConsensus, type StrategyScan } from "./signalConsensus";

function result(symbol: string, position: "flat" | "long", date = "2026-06-01"): BacktestResult {
  return {
    symbol,
    strategyId: "x",
    strategyName: "x",
    description: "",
    type: "breakout",
    signals: [{ date, type: position === "long" ? "buy" : "sell", price: 10, reason: "entry" }],
    trades: [],
    equityCurve: [],
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
    dataStatus: { provider: "test", isFallback: false, message: "", updatedAt: "", adjusted: true },
    metrics: {
      totalReturn: 0.1,
      annualizedReturn: 0.1,
      benchmarkReturn: 0.05,
      excessReturn: 0.05,
      maxDrawdown: -0.1,
      sharpe: 1.2,
      winRate: 0.6,
      profitFactor: 1.4,
      tradeCount: 8,
      averageHoldingDays: 11,
      volatility: 0.18,
      currentPosition: position,
      lastSignalDate: date,
    },
  };
}

function scan(
  id: string,
  type: string,
  holdings: Array<{ symbol: string; position: "flat" | "long"; score: number }>,
): StrategyScan {
  return {
    strategyId: id,
    strategyName: `Strategy ${id}`,
    type,
    runs: holdings.map((h) => ({
      strategyId: id,
      strategyName: `Strategy ${id}`,
      type,
      score: h.score,
      result: result(h.symbol, h.position),
    })),
  };
}

describe("buildSignalConsensus", () => {
  it("counts only currently-held symbols and ranks resonance first", () => {
    const report = buildSignalConsensus([
      scan("a", "breakout", [
        { symbol: "AAPL", position: "long", score: 80 },
        { symbol: "MSFT", position: "long", score: 70 },
        { symbol: "NVDA", position: "flat", score: 90 },
      ]),
      scan("b", "mean reversion", [
        { symbol: "AAPL", position: "long", score: 60 },
        { symbol: "MSFT", position: "flat", score: 50 },
      ]),
    ]);

    expect(report.strategyCount).toBe(2);
    expect(report.symbolsScanned).toBe(3); // AAPL, MSFT, NVDA scanned
    // AAPL held by both strategies -> resonance, ranked first.
    expect(report.picks[0].symbol).toBe("AAPL");
    expect(report.picks[0].agreeCount).toBe(2);
    expect(report.picks[0].resonance).toBe(true);
    expect(report.consensusCount).toBe(1);
    // NVDA is flat in every strategy -> not a pick at all.
    expect(report.picks.some((p) => p.symbol === "NVDA")).toBe(false);
  });

  it("breaks ties by distinct strategy-type breadth, then average score", () => {
    const report = buildSignalConsensus([
      scan("a", "breakout", [{ symbol: "X", position: "long", score: 90 }, { symbol: "Y", position: "long", score: 90 }]),
      scan("b", "breakout", [{ symbol: "X", position: "long", score: 90 }]),
      scan("c", "momentum", [{ symbol: "Y", position: "long", score: 50 }]),
    ]);
    // X: 2 legs both breakout (1 distinct type). Y: 2 legs breakout+momentum (2 distinct types).
    // Same agreeCount (2) -> Y wins on type breadth.
    expect(report.picks[0].symbol).toBe("Y");
    expect(report.picks[0].strategyTypes).toEqual(["breakout", "momentum"]);
  });

  it("averages leg scores and orders legs best-first", () => {
    const report = buildSignalConsensus([
      scan("a", "breakout", [{ symbol: "Z", position: "long", score: 60 }]),
      scan("b", "momentum", [{ symbol: "Z", position: "long", score: 80 }]),
    ]);
    const z = report.picks.find((p) => p.symbol === "Z")!;
    expect(z.averageScore).toBe(70);
    expect(z.legs[0].score).toBe(80); // higher-scoring leg first
  });

  it("degrades to a clear verdict when nothing is held", () => {
    const report = buildSignalConsensus([
      scan("a", "breakout", [{ symbol: "AAPL", position: "flat", score: 80 }]),
    ]);
    expect(report.picks).toHaveLength(0);
    expect(report.topPick).toBeNull();
    expect(report.consensusCount).toBe(0);
    expect(report.verdict).toMatch(/nothing to confirm/);
  });

  it("flags single-strategy picks as non-resonance with an honest verdict", () => {
    const report = buildSignalConsensus([
      scan("a", "breakout", [{ symbol: "AAPL", position: "long", score: 80 }]),
      scan("b", "momentum", [{ symbol: "MSFT", position: "long", score: 70 }]),
    ]);
    expect(report.consensusCount).toBe(0);
    expect(report.picks.every((p) => !p.resonance)).toBe(true);
    expect(report.verdict).toMatch(/no cross-strategy confirmation yet/);
  });
});
