import { describe, expect, it } from "vitest";
import type { BacktestResult, EquityPoint } from "@/types/backtest";
import { buildStrategyIntel } from "./strategyIntel";

function makeResult(over: Partial<BacktestResult["metrics"]> = {}, type = "momentum"): BacktestResult {
  const curve: EquityPoint[] = [];
  let equity = 100_000;
  let bench = 100_000;
  let peak = equity;
  for (let i = 0; i < 120; i += 1) {
    equity *= i < 90 ? 1.003 : 0.997;
    bench *= 1.0015;
    peak = Math.max(peak, equity);
    curve.push({ date: `d${i}`, equity, cash: 0, positionValue: equity, drawdown: equity / peak - 1, benchmarkEquity: bench });
  }
  return {
    symbol: "NVDA",
    strategyId: "test-strat",
    strategyName: "Test Strategy",
    description: "",
    type,
    signals: [],
    trades: [],
    equityCurve: curve,
    riskFlags: [],
    recommendation: "",
    assumptions: { initialCapital: 100_000, positionFraction: 0.2, stopLossPct: 0.08, trailingStopPct: 0.12, maxHoldingDays: 45, execution: "next_open", slippageBps: 5, feePerTrade: 1 },
    dataStatus: { provider: "yahoo", isFallback: false, message: "", updatedAt: new Date().toISOString(), adjusted: true },
    metrics: {
      totalReturn: 0.25, annualizedReturn: 0.12, benchmarkReturn: 0.18, excessReturn: -0.06,
      maxDrawdown: -0.12, sharpe: 1.3, winRate: 0.6, profitFactor: 1.8, tradeCount: 18,
      averageHoldingDays: 12, volatility: 0.2, currentPosition: "long", lastSignalDate: null,
      ...over,
    },
  };
}

describe("buildStrategyIntel", () => {
  it("keeps all synthesized scores within bounds and returns four factor tilts", () => {
    const intel = buildStrategyIntel({ result: makeResult(), regime: { regime: "risk-on", stressScore: 25 } });
    for (const s of [intel.regimeFit.score, intel.confidence.score, intel.catalystSensitivity.score, intel.downsideRiskPriority.score]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
    expect(intel.factorExposure).toHaveLength(4);
    expect(intel.recentDecomposition.selectionComponent).toBeCloseTo(
      intel.recentDecomposition.strategyReturn - intel.recentDecomposition.benchmarkReturn,
      6,
    );
  });

  it("rates a momentum strategy as better-aligned in a risk-on than a risk-off regime", () => {
    const onFit = buildStrategyIntel({ result: makeResult(), regime: { regime: "risk-on", stressScore: 20 } }).regimeFit.score;
    const offFit = buildStrategyIntel({ result: makeResult(), regime: { regime: "risk-off", stressScore: 80 } }).regimeFit.score;
    expect(onFit).toBeGreaterThan(offFit);
  });

  it("classifies a strong radar candidate for observation and parks a rejected high-drawdown one", () => {
    const strong = buildStrategyIntel({
      result: makeResult({ tradeCount: 22, sharpe: 1.6, winRate: 0.62, maxDrawdown: -0.1 }),
      diagnostics: { baseScore: 84, stressAdjustedScore: 82, currentDrawdown: -0.02, downsideVolatility: 0.1, drawdownSensitivity: 30, volatilitySensitivity: 30, status: "stable" } as never,
      regime: { regime: "risk-on", stressScore: 20 },
      status: "radar candidate",
    });
    expect(strong.researchGate.kind).toBe("observe");

    const weak = buildStrategyIntel({
      result: makeResult({ tradeCount: 4, sharpe: -0.2, winRate: 0.3, maxDrawdown: -0.45 }),
      diagnostics: { baseScore: 30, stressAdjustedScore: 22, currentDrawdown: -0.2, downsideVolatility: 0.4, drawdownSensitivity: 85, volatilitySensitivity: 80, status: "under stress" } as never,
      regime: { regime: "risk-off", stressScore: 80 },
      status: "rejected",
    });
    expect(weak.researchGate.kind).toBe("watchlist");
  });

  it("flags low trade count as the binding research test", () => {
    const intel = buildStrategyIntel({ result: makeResult({ tradeCount: 3 }), regime: { regime: "neutral", stressScore: 50 } });
    expect(intel.suggestedResearchTest.toLowerCase()).toContain("sample");
  });
});
