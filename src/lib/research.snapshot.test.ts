import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { HistoricalPriceResult } from "@/types/market";
import { buildResearchDatasetFromPrices } from "./research";
import { effectiveBets } from "./quant/signalConcentration";
import { MAX_OBSERVATION_SLOTS } from "./quant/paperTrading";

const FIXTURE_PATH = path.join(process.cwd(), "src", "__fixtures__", "yahoo-snapshot.json");

function loadFixture(): Record<string, HistoricalPriceResult> {
  const raw = readFileSync(FIXTURE_PATH, "utf8");
  return JSON.parse(raw) as Record<string, HistoricalPriceResult>;
}

describe("research pipeline snapshot (real Yahoo data)", () => {
  it("loads the fixture with the full default watchlist of adjusted real-data series", () => {
    const fixture = loadFixture();
    const symbols = Object.keys(fixture);
    expect(symbols).toEqual(
      expect.arrayContaining(["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "JPM", "SPY", "QQQ"]),
    );
    for (const symbol of symbols) {
      const result = fixture[symbol];
      expect(result.isFallback).toBe(false);
      expect(result.prices.length).toBeGreaterThan(500);
    }
    // At least one symbol in a 3y window should have a corporate-action adjustment;
    // a snapshot with zero adjusted series would point at a normalization bug.
    const anyAdjusted = symbols.some((sym) => fixture[sym].quality.adjusted);
    expect(anyAdjusted).toBe(true);
  });

  it("runs the entire research pipeline end-to-end against the fixture", async () => {
    const fixture = loadFixture();
    const dataset = await buildResearchDatasetFromPrices(fixture);

    // Every catalog strategy must produce a usable backtest from the watchlist
    expect(dataset.strategyResults.length).toBe(5);
    for (const result of dataset.strategyResults) {
      expect(result.dataStatus.isFallback).toBe(false);
      expect(result.equityCurve.length).toBeGreaterThan(200);

      // metrics are real numbers, not NaN / Infinity
      expect(Number.isFinite(result.metrics.totalReturn)).toBe(true);
      expect(Number.isFinite(result.metrics.annualizedReturn)).toBe(true);
      expect(Number.isFinite(result.metrics.sharpe)).toBe(true);
      expect(Number.isFinite(result.metrics.maxDrawdown)).toBe(true);

      // Sanity bounds: maxDrawdown ∈ [-1, 0]; Sharpe within a plausible range
      expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(0);
      expect(result.metrics.maxDrawdown).toBeGreaterThan(-1);
      expect(result.metrics.sharpe).toBeGreaterThan(-5);
      expect(result.metrics.sharpe).toBeLessThan(8);
    }

    // Factor snapshots cover the whole watchlist
    expect(dataset.factors.length).toBe(Object.keys(fixture).length);
    for (const factor of dataset.factors) {
      expect(factor.isFallback).toBe(false);
    }

    // Radar verdicts are well-formed and sorted by score descending
    expect(dataset.radarCandidates.length).toBe(5);
    const ranks = dataset.radarCandidates.map((c) => c.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
    const scores = dataset.radarCandidates.map((c) => c.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);

    // Paper account summary obeys its own invariants
    expect(dataset.paperAccount.simulatedCapital).toBe(100_000);
    expect(dataset.paperAccount.exposurePct).toBeGreaterThanOrEqual(0);
    expect(dataset.paperAccount.exposurePct).toBeLessThanOrEqual(1);
    expect(["within limits", "watch exposure", "paused", "idle"]).toContain(
      dataset.paperAccount.riskBudgetStatus,
    );

    // Market summary degrades to the template in tests (no DEEPSEEK_API_KEY)
    expect(["risk-on", "defensive", "mixed"]).toContain(dataset.marketSummary.tone);
    expect(dataset.marketSummary.source).toBe("template");
    expect(dataset.marketSummary.summary.length).toBeGreaterThan(0);

    // Metadata reflects a pure real-data load
    expect(dataset.metadata.symbolCount).toBe(Object.keys(fixture).length);
    expect(dataset.metadata.fallbackCount).toBe(0);
    expect(dataset.metadata.realDataCount).toBe(Object.keys(fixture).length);
  });

  it("portfolio backtest holds the diversification invariants when eligible legs exist", async () => {
    const fixture = loadFixture();
    const dataset = await buildResearchDatasetFromPrices(fixture);
    if (!dataset.portfolio) {
      // It is legitimate for a fresh data snapshot to have <2 eligible legs.
      // We still want to observe the radar state in that case.
      const eligible = dataset.radarCandidates.filter(
        (c) => c.status === "radar candidate" || (c.status === "continue observing" && c.result.metrics.sharpe > 0.5),
      );
      expect(eligible.length).toBeLessThan(2);
      return;
    }

    const portfolio = dataset.portfolio;
    expect(portfolio.legs.length).toBeGreaterThanOrEqual(2);
    const weightSum = portfolio.legs.reduce((sum, leg) => sum + leg.weight, 0);
    expect(weightSum).toBeCloseTo(1, 4);
    portfolio.legs.forEach((leg) => {
      expect(leg.weight).toBeGreaterThan(0);
      expect(leg.weight).toBeLessThanOrEqual(1);
    });

    // Curve invariants
    expect(portfolio.curve.length).toBeGreaterThan(100);
    expect(portfolio.curve[0].equity).toBeGreaterThan(0);
    expect(Number.isFinite(portfolio.metrics.sharpe)).toBe(true);
    expect(portfolio.metrics.maxDrawdown).toBeLessThanOrEqual(0);

    // Correlation matrix is n × n and the diagonal is exactly 1
    const n = portfolio.legs.length;
    expect(portfolio.correlation.length).toBe(n * n);
    const diag = portfolio.correlation.filter(
      (cell) => cell.rowSymbol === cell.colSymbol && cell.rowStrategy === cell.colStrategy,
    );
    expect(diag.length).toBe(n);
    diag.forEach((cell) => expect(cell.correlation).toBeCloseTo(1, 6));

    // Off-diagonal correlations are bounded
    portfolio.correlation.forEach((cell) => {
      expect(cell.correlation).toBeGreaterThanOrEqual(-1.0001);
      expect(cell.correlation).toBeLessThanOrEqual(1.0001);
    });

    // Benchmark wiring
    expect(["SPY", "QQQ"]).toContain(portfolio.benchmarkSymbol);
  });

  it("holds the concentration invariants across radar, paper, and portfolio", async () => {
    const fixture = loadFixture();
    const dataset = await buildResearchDatasetFromPrices(fixture);
    const report = dataset.signalConcentration;
    expect(report).not.toBeNull();
    if (!report) return;

    // N_eff is bounded and self-consistent with the average correlation.
    expect(report.effectiveStrategies).toBeGreaterThanOrEqual(1);
    expect(report.effectiveStrategies).toBeLessThanOrEqual(report.strategyCount);
    expect(report.averagePairwiseCorrelation).toBeGreaterThanOrEqual(-1);
    expect(report.averagePairwiseCorrelation).toBeLessThanOrEqual(1);
    expect(["low", "medium", "high"]).toContain(report.level);
    expect(report.effectiveStrategies).toBeCloseTo(
      effectiveBets(report.strategyCount, report.averagePairwiseCorrelation),
      6,
    );

    // Gate -> paper consistency: a demoted near-duplicate must NEVER hold a paper slot.
    const demotedIds = new Set(
      dataset.radarCandidates.filter((c) => c.redundancy?.demoted).map((c) => c.result.strategyId),
    );
    dataset.paperObservations.forEach((obs) => {
      expect(demotedIds.has(obs.candidate.result.strategyId)).toBe(false);
    });

    // Gate -> portfolio consistency: a demoted near-duplicate must NEVER be a leg.
    if (dataset.portfolio) {
      dataset.portfolio.legs.forEach((leg) => {
        expect(demotedIds.has(leg.strategyId)).toBe(false);
      });
      // Portfolio N_eff is also self-consistent.
      expect(dataset.portfolio.effectiveBets).toBeCloseTo(
        effectiveBets(dataset.portfolio.legs.length, dataset.portfolio.averagePairwiseCorrelation),
        6,
      );
    }

    // Paper slots are capped at the effective number of independent bets.
    const slotCap = Math.max(1, Math.min(MAX_OBSERVATION_SLOTS, Math.floor(report.effectiveStrategies)));
    expect(dataset.paperObservations.length).toBeLessThanOrEqual(slotCap);
    expect(dataset.paperAccount.observationSlots).toBe(slotCap);
  });
});
