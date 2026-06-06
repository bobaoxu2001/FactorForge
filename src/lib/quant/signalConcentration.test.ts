import { describe, expect, it } from "vitest";
import { applyConcentrationGate, buildSignalConcentration, concentrationLevel, effectiveBets, __testing } from "./signalConcentration";
import type { BacktestResult, EquityPoint } from "@/types/backtest";
import type { RadarCandidate } from "@/types/strategy";
import type { FactorReturnsRow } from "./factorAttribution";

const { pearson, intersectDates, dailyReturnMap } = __testing;

function makeResult(id: string, symbol: string, dailyRets: number[]): BacktestResult {
  let equity = 100;
  const curve: EquityPoint[] = [{ date: "2024-01-01", equity, cash: equity, positionValue: 0, benchmarkEquity: equity, drawdown: 0 }];
  dailyRets.forEach((r, i) => {
    equity *= 1 + r;
    const d = new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10);
    curve.push({ date: d, equity, cash: equity, positionValue: 0, benchmarkEquity: equity, drawdown: 0 });
  });
  return {
    symbol, strategyId: id, strategyName: `Strategy ${id}`, description: "", type: "momentum",
    signals: [], trades: [], equityCurve: curve,
    metrics: {} as BacktestResult["metrics"],
    riskFlags: [], recommendation: "",
    assumptions: {} as BacktestResult["assumptions"],
    dataStatus: { provider: "test", isFallback: false, message: "", updatedAt: "", adjusted: true },
  };
}

// Deterministic pseudo-random returns
function series(seed: number, n: number, scale = 0.01): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) % 2147483648;
    out.push((s / 2147483648 - 0.5) * 2 * scale);
  }
  return out;
}

const emptyFactors: FactorReturnsRow[] = [];

describe("pearson", () => {
  it("is 1 for identical series and -1 for mirrored", () => {
    const a = [1, 2, 3, 4, 5];
    expect(pearson(a, a)).toBeCloseTo(1, 6);
    expect(pearson(a, a.map((v) => -v))).toBeCloseTo(-1, 6);
  });
});

describe("intersectDates", () => {
  it("returns the sorted common dates", () => {
    expect(intersectDates([["c", "a", "b"], ["b", "c", "d"]])).toEqual(["b", "c"]);
  });
});

describe("dailyReturnMap", () => {
  it("derives returns from the equity curve", () => {
    const r = makeResult("x", "AAA", [0.1, -0.05]);
    const map = dailyReturnMap(r);
    expect([...map.values()][0]).toBeCloseTo(0.1, 6);
  });
});

describe("effectiveBets / concentrationLevel", () => {
  it("equals N when uncorrelated and 1 when perfectly correlated", () => {
    expect(effectiveBets(4, 0)).toBeCloseTo(4, 6);
    expect(effectiveBets(4, 1)).toBeCloseTo(1, 1);
    expect(effectiveBets(1, 0.5)).toBe(1);
  });
  it("is monotonic decreasing in correlation", () => {
    expect(effectiveBets(4, 0.2)).toBeGreaterThan(effectiveBets(4, 0.5));
    expect(effectiveBets(4, 0.5)).toBeGreaterThan(effectiveBets(4, 0.8));
  });
  it("bucketizes correlation into levels", () => {
    expect(concentrationLevel(0.1)).toBe("low");
    expect(concentrationLevel(0.4)).toBe("medium");
    expect(concentrationLevel(0.7)).toBe("high");
  });
});

describe("buildSignalConcentration", () => {
  it("returns null with fewer than two strategies", () => {
    expect(buildSignalConcentration([makeResult("a", "AAA", series(1, 40))], emptyFactors, "SPY")).toBeNull();
  });

  it("flags HIGH overlap and ~1 effective bet for near-identical strategies", () => {
    const base = series(7, 60);
    const a = makeResult("a", "AAA", base);
    const b = makeResult("b", "BBB", base.map((v) => v + 0.0001)); // essentially identical
    const report = buildSignalConcentration([a, b], emptyFactors, "SPY")!;
    expect(report).not.toBeNull();
    expect(report.level).toBe("high");
    expect(report.averagePairwiseCorrelation).toBeGreaterThan(0.9);
    expect(report.effectiveStrategies).toBeLessThan(1.2);
  });

  it("reports LOW overlap and near-N effective bets for uncorrelated strategies", () => {
    const a = makeResult("a", "AAA", series(11, 80));
    const b = makeResult("b", "BBB", series(99, 80));
    const c = makeResult("c", "CCC", series(523, 80));
    const report = buildSignalConcentration([a, b, c], emptyFactors, "SPY")!;
    expect(report.level).toBe("low");
    expect(report.effectiveStrategies).toBeGreaterThan(2.4);
    expect(report.correlation).toHaveLength(9); // 3x3 matrix
    expect(report.pairCorrelations).toHaveLength(3); // off-diagonal pairs
  });
});

function makeCandidate(id: string, symbol: string, rank: number, rets: number[]): RadarCandidate {
  return {
    rank, score: 85, status: "radar candidate", reasons: ["Composite score 85"],
    nextAction: "Eligible for simulated observation review",
    result: makeResult(id, symbol, rets),
  };
}

describe("applyConcentrationGate", () => {
  it("demotes a near-duplicate candidate ranked below its twin", () => {
    const base = series(7, 60);
    const top = makeCandidate("top", "AAA", 1, base);
    const dup = makeCandidate("dup", "BBB", 2, base.map((v) => v + 0.00005)); // ~identical
    const report = buildSignalConcentration([top.result, dup.result], emptyFactors, "SPY")!;

    const gated = applyConcentrationGate([top, dup], report);
    const gatedTop = gated.find((c) => c.result.strategyId === "top")!;
    const gatedDup = gated.find((c) => c.result.strategyId === "dup")!;

    expect(gatedTop.status).toBe("radar candidate"); // higher-ranked one survives
    expect(gatedDup.status).toBe("continue observing"); // duplicate demoted
    expect(gatedDup.redundancy?.demoted).toBe(true);
    expect(gatedDup.redundancy?.correlation).toBeGreaterThan(0.8);
  });

  it("keeps both when they are uncorrelated", () => {
    const a = makeCandidate("a", "AAA", 1, series(11, 80));
    const b = makeCandidate("b", "BBB", 2, series(99, 80));
    const report = buildSignalConcentration([a.result, b.result], emptyFactors, "SPY")!;
    const gated = applyConcentrationGate([a, b], report);
    expect(gated.every((c) => c.status === "radar candidate")).toBe(true);
    expect(gated.every((c) => c.redundancy === undefined)).toBe(true);
  });

  it("is a no-op when the report is null", () => {
    const a = makeCandidate("a", "AAA", 1, series(11, 80));
    expect(applyConcentrationGate([a], null)).toEqual([a]);
  });
});
