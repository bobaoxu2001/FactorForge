import { describe, expect, it } from "vitest";
import type { EquityPoint } from "@/types/backtest";
import { __testing, attributeFactors, buildFactorReturns, type FactorReturnsRow } from "./factorAttribution";

describe("factor attribution math", () => {
  it("inverts a known 4x4 matrix correctly", () => {
    const I = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    expect(__testing.invert4(I)).toEqual(I);

    // Random invertible: [[2,1,0,0],[1,2,0,0],[0,0,3,0],[0,0,0,4]] — block diagonal
    const M = [
      [2, 1, 0, 0],
      [1, 2, 0, 0],
      [0, 0, 3, 0],
      [0, 0, 0, 4],
    ];
    const inv = __testing.invert4(M);
    expect(inv).not.toBeNull();
    if (!inv) return;
    // Verify M * inv ≈ I
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        let dot = 0;
        for (let k = 0; k < 4; k += 1) dot += M[i][k] * inv[k][j];
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it("returns null for a singular matrix", () => {
    const singular = [
      [1, 2, 3, 4],
      [2, 4, 6, 8], // 2x row1
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    expect(__testing.invert4(singular)).toBeNull();
  });

  it("recovers known coefficients on synthetic linear data", () => {
    // y = 0.001 + 0.7*mkt - 0.3*mom + 0.2*vol  (no noise so we test the math, not stats)
    const n = 200;
    const dates: string[] = [];
    const factors: FactorReturnsRow[] = [];
    const equityCurve: EquityPoint[] = [];
    let equity = 100_000;
    // LCG so the three factors are truly linearly independent
    let s1 = 12345;
    let s2 = 67890;
    let s3 = 11111;
    const step = (s: number) => (s * 1103515245 + 12345) & 0x7fffffff;
    const draw = (s: number) => ((s / 0x7fffffff) - 0.5) * 0.04; // [-0.02, 0.02]
    for (let i = 0; i < n; i += 1) {
      const date = new Date(2023, 0, 2 + i).toISOString().slice(0, 10);
      dates.push(date);
      s1 = step(s1);
      s2 = step(s2);
      s3 = step(s3);
      const mkt = draw(s1);
      const mom = draw(s2);
      const vol = draw(s3);
      factors.push({ date, mkt, mom, vol });
      const ret = 0.001 + 0.7 * mkt - 0.3 * mom + 0.2 * vol;
      equity *= 1 + ret;
      equityCurve.push({
        date,
        equity,
        cash: equity / 2,
        positionValue: equity / 2,
        drawdown: 0,
        benchmarkEquity: 100_000,
      });
    }

    const fit = attributeFactors(equityCurve, factors, "SPY");
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.alphaDaily).toBeCloseTo(0.001, 4);
    expect(fit.betas.mkt).toBeCloseTo(0.7, 3);
    expect(fit.betas.mom).toBeCloseTo(-0.3, 3);
    expect(fit.betas.vol).toBeCloseTo(0.2, 3);
    expect(fit.rSquared).toBeGreaterThan(0.99);
    expect(fit.observations).toBeGreaterThan(150);
  });

  it("returns null when the strategy curve is too short", () => {
    const fit = attributeFactors([], [], "SPY");
    expect(fit).toBeNull();
  });

  it("buildFactorReturns produces rows with finite numbers", () => {
    // Build a tiny synthetic price universe with 70 bars across 3 symbols
    const days = 90;
    const calendar = Array.from({ length: days }, (_, i) =>
      new Date(2023, 0, 2 + i).toISOString().slice(0, 10),
    );
    function makePrices(symbol: string, drift: number) {
      return calendar.map((date, i) => {
        const c = 100 * (1 + drift) ** (i / 252) * (1 + Math.sin(i * 0.27) * 0.005);
        return { date, open: c, high: c, low: c, close: c, volume: 1_000_000 };
      });
    }
    function makeResult(symbol: string, drift: number) {
      return {
        symbol,
        range: "3y" as const,
        prices: makePrices(symbol, drift),
        provider: "test",
        isFallback: false,
        status: "ok" as const,
        message: "test",
        updatedAt: "",
        quality: {
          adjusted: true,
          source: "yahoo" as const,
          fetchedAt: "",
          rows: days,
          firstDate: calendar[0],
          lastDate: calendar[days - 1],
        },
      };
    }
    const universe = {
      SPY: makeResult("SPY", 0.1),
      AAPL: makeResult("AAPL", 0.18),
      MSFT: makeResult("MSFT", 0.05),
      JPM: makeResult("JPM", 0.02),
    };
    const rows = buildFactorReturns(universe);
    expect(rows.length).toBeGreaterThan(20);
    rows.forEach((row) => {
      expect(Number.isFinite(row.mkt)).toBe(true);
      expect(Number.isFinite(row.mom)).toBe(true);
      expect(Number.isFinite(row.vol)).toBe(true);
    });
  });
});
