import { describe, expect, it } from "vitest";
import type { BacktestResult, EquityPoint } from "@/types/backtest";
import type { FactorSnapshot, HistoricalPriceResult } from "@/types/market";
import {
  buildMarketStressReport,
  buildStressInsightCards,
  buildStrategyStressDiagnostics,
} from "./marketStress";

function makePrices(symbol: string, closes: number[], isFallback = false): HistoricalPriceResult {
  const prices = closes.map((close, i) => ({
    date: `2024-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    open: close, high: close, low: close, close, volume: 1_000_000,
  }));
  return {
    symbol, range: "3y", prices, provider: "test", isFallback,
    status: "ok", message: "", updatedAt: "2024-01-01T00:00:00.000Z",
    quality: { adjusted: true, source: "yahoo", fetchedAt: "", rows: closes.length, firstDate: null, lastDate: null },
  };
}

function downSeries(): number[] {
  const out: number[] = [];
  let p = 140;
  for (let i = 0; i < 80; i += 1) {
    const drift = i > 68 ? -0.02 : -0.003;
    p *= 1 + drift + (i % 2 ? 0.012 : -0.012);
    out.push(p);
  }
  return out;
}

function upSeries(): number[] {
  const out: number[] = [];
  let p = 80;
  for (let i = 0; i < 80; i += 1) {
    p *= 1 + 0.004 + (i % 2 ? 0.001 : -0.001);
    out.push(p);
  }
  return out;
}

function factor(symbol: string, overrides: Partial<FactorSnapshot>): FactorSnapshot {
  return {
    symbol, date: "2024-03-20",
    momentum20d: 0, momentum60d: 0, volatility20d: 0.2, volumeSurge: 1,
    aboveSma200: false, rsi14: 50, provider: "test", isFallback: false, adjusted: true,
    ...overrides,
  };
}

describe("buildMarketStressReport", () => {
  it("classifies a weak, declining tape as risk-off stress", () => {
    const prices = {
      AAA: makePrices("AAA", downSeries()),
      BBB: makePrices("BBB", downSeries()),
      CCC: makePrices("CCC", downSeries()),
    };
    const factors = ["AAA", "BBB", "CCC"].map((s) =>
      factor(s, { aboveSma200: false, momentum20d: -0.05, volatility20d: 0.5, volumeSurge: 1.4 }),
    );
    const report = buildMarketStressReport(prices, factors);
    expect(report.regime).toBe("risk-off");
    expect(report.tone).toBe("stress");
    expect(report.stressScore).toBeGreaterThanOrEqual(62);
    expect(report.breadthState).toBe("weakening");
    expect(report.momentumState).toBe("under pressure");
  });

  it("classifies a broad, calm uptrend as risk-on", () => {
    const prices = {
      AAA: makePrices("AAA", upSeries()),
      BBB: makePrices("BBB", upSeries()),
      CCC: makePrices("CCC", upSeries()),
    };
    const factors = ["AAA", "BBB", "CCC"].map((s) =>
      factor(s, { aboveSma200: true, momentum20d: 0.05, volatility20d: 0.12, volumeSurge: 1 }),
    );
    const report = buildMarketStressReport(prices, factors);
    expect(report.regime).toBe("risk-on");
    expect(report.tone).toBe("stable");
    expect(report.breadthState).toBe("broad");
  });

  it("always emits six insight cards with bounded confidence", () => {
    const prices = { AAA: makePrices("AAA", downSeries()) };
    const report = buildMarketStressReport(prices, [factor("AAA", { momentum20d: -0.04 })]);
    const cards = buildStressInsightCards(report);
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.confidence).toBeGreaterThan(0);
      expect(card.confidence).toBeLessThanOrEqual(100);
      expect(card.researchAction.length).toBeGreaterThan(0);
    }
  });
});

function deepDrawdownResult(): BacktestResult {
  // Rises to a peak, then falls ~30% and stays underwater.
  const curve: EquityPoint[] = [];
  let equity = 100_000;
  let peak = equity;
  let bench = 100_000;
  for (let i = 0; i < 120; i += 1) {
    const up = i < 60;
    equity *= up ? 1.004 : 0.994;
    bench *= 1.002;
    peak = Math.max(peak, equity);
    curve.push({
      date: `d${i}`, equity, cash: 0, positionValue: equity,
      drawdown: peak > 0 ? equity / peak - 1 : 0, benchmarkEquity: bench,
    });
  }
  return {
    symbol: "TST", strategyId: "deep-dd", strategyName: "Deep DD", description: "", type: "momentum",
    signals: [], trades: [{
      entryDate: "d10", exitDate: "d20", entryPrice: 10, exitPrice: 9, shares: 1, fees: 1, slippage: 0,
      pnl: -1, returnPct: -0.1, holdingDays: 10, exitReason: "stop loss",
    }],
    equityCurve: curve, riskFlags: ["fallback/demo data"], recommendation: "",
    assumptions: { initialCapital: 100_000, positionFraction: 0.2, stopLossPct: 0.08, trailingStopPct: 0.12, maxHoldingDays: 45, execution: "next_open", slippageBps: 5, feePerTrade: 1 },
    dataStatus: { provider: "test", isFallback: false, message: "", updatedAt: "", adjusted: true },
    metrics: {
      totalReturn: -0.1, annualizedReturn: -0.05, benchmarkReturn: 0.2, excessReturn: -0.3,
      maxDrawdown: -0.31, sharpe: 0.2, winRate: 0.3, profitFactor: 0.7, tradeCount: 1,
      averageHoldingDays: 10, volatility: 0.42, currentPosition: "long", lastSignalDate: null,
    },
  };
}

describe("buildStrategyStressDiagnostics", () => {
  it("flags a deep-drawdown strategy as under stress and discounts its stress score", () => {
    const prices = { AAA: makePrices("AAA", downSeries()) };
    const report = buildMarketStressReport(prices, [factor("AAA", { momentum20d: -0.05, volatility20d: 0.5 })]);
    const diag = buildStrategyStressDiagnostics(deepDrawdownResult(), report, 70);
    expect(diag.status).toBe("under stress");
    expect(diag.badges).toContain("High Drawdown Risk");
    expect(diag.paperSuitable).toBe(false);
    expect(diag.stressAdjustedScore).toBeLessThanOrEqual(70);
    expect(diag.stopLossTriggers).toBe(1);
  });
});
