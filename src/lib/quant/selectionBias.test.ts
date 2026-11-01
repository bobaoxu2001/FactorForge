import { describe, expect, it } from "vitest";
import type { BacktestResult } from "@/types/backtest";
import {
  deflatedSharpeForSelection,
  expectedMaxSharpe,
  inverseNormalCdf,
  normalCdf,
  probabilisticSharpe,
  returnMoments,
} from "./selectionBias";

/** Deterministic pseudo-random daily returns (LCG + Box–Muller), mean `drift`, sd `vol`. */
function returns(seed: number, n: number, drift: number, vol = 0.01): number[] {
  let state = seed;
  const uniform = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state + 0.5) / 4294967296;
  };
  return Array.from({ length: n }, () => drift + vol * Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform()));
}

function run(symbol: string, daily: number[]): BacktestResult {
  let equity = 100_000;
  const equityCurve = [{ date: "d0", equity, cash: equity, positionValue: 0, benchmarkEquity: equity, drawdown: 0 }];
  daily.forEach((r, i) => {
    equity *= 1 + r;
    equityCurve.push({ date: `d${i + 1}`, equity, cash: 0, positionValue: equity, benchmarkEquity: 100_000, drawdown: 0 });
  });
  const m = returnMoments(daily);
  return { symbol, metrics: { sharpe: (m?.sharpe ?? 0) * Math.sqrt(252) }, equityCurve } as unknown as BacktestResult;
}

describe("normal distribution helpers", () => {
  it("normalCdf matches known quantiles and inverts inverseNormalCdf", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 5);
    for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) expect(normalCdf(inverseNormalCdf(p))).toBeCloseTo(p, 6);
  });

  it("expected max Sharpe of 30 skill-less tries over 3 years is about 1.2", () => {
    expect(expectedMaxSharpe(30, 3)).toBeCloseTo(1.197, 2);
    expect(expectedMaxSharpe(1, 3)).toBe(0);
    expect(expectedMaxSharpe(150, 3)).toBeGreaterThan(expectedMaxSharpe(30, 3));
  });
});

describe("probabilistic Sharpe", () => {
  it("is 0.5 at the benchmark and rises with the estimated Sharpe", () => {
    const m = returnMoments(returns(7, 750, 0.0008))!;
    expect(probabilisticSharpe(m, m.sharpe)).toBeCloseTo(0.5, 6);
    expect(probabilisticSharpe(m, 0)!).toBeGreaterThan(probabilisticSharpe(m, m.sharpe / 2)!);
  });

  it("returns null moments for flat or too-short series", () => {
    expect(returnMoments([0, 0, 0, 0])).toBeNull();
    expect(returnMoments([0.01, -0.01])).toBeNull();
  });
});

describe("deflatedSharpeForSelection", () => {
  it("deflates the best of many noise runs below its naive probability", () => {
    const trials = Array.from({ length: 30 }, (_, i) => run(`S${i}`, returns(i + 1, 750, 0)));
    const best = trials.reduce((a, b) => (b.metrics.sharpe > a.metrics.sharpe ? b : a));
    const summary = deflatedSharpeForSelection(best, trials);
    expect(summary.trials).toBe(30);
    expect(summary.selectedSymbol).toBe(best.symbol);
    expect(summary.luckThreshold).toBeGreaterThan(0);
    expect(summary.dsr!).toBeLessThan(summary.psr!);
    expect(summary.survives).toBe(false);
  });

  it("lets a genuinely strong run survive the haircut", () => {
    const noise = Array.from({ length: 29 }, (_, i) => run(`S${i}`, returns(i + 101, 750, 0)));
    const strong = run("EDGE", returns(999, 750, 0.002));
    const summary = deflatedSharpeForSelection(strong, [strong, ...noise]);
    expect(summary.sharpe).toBeGreaterThan(summary.luckThreshold);
    expect(summary.survives).toBe(true);
  });

  it("applies no haircut when only one run was tried", () => {
    const only = run("ONE", returns(3, 500, 0.0005));
    const summary = deflatedSharpeForSelection(only, [only]);
    expect(summary.luckThreshold).toBe(0);
    expect(summary.dsr).toBeCloseTo(summary.psr!, 10);
  });
});
