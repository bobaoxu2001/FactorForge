import { describe, expect, it } from "vitest";
import { decomposeReturn, expectedMaxSharpe, inverseNormalCdf, marketSectorAttribution, ols } from "./attribution";

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

describe("ols", () => {
  it("recovers known coefficients", () => {
    const r = lcg(7);
    const x1 = Array.from({ length: 500 }, () => r());
    const x2 = Array.from({ length: 500 }, () => r());
    const y = x1.map((v, i) => 0.01 + 1.5 * v - 0.7 * x2[i] + 0.001 * r());
    const fit = ols(y, [x1, x2])!;
    expect(fit.coefficients[0]).toBeCloseTo(0.01, 3);
    expect(fit.coefficients[1]).toBeCloseTo(1.5, 2);
    expect(fit.coefficients[2]).toBeCloseTo(-0.7, 2);
    expect(fit.rSquared).toBeGreaterThan(0.99);
  });
  it("returns null for singular designs", () => {
    const x = [1, 2, 3, 4, 5, 6];
    expect(ols([1, 2, 3, 4, 5, 6], [x, x])).toBeNull();
  });
});

describe("market/sector attribution", () => {
  it("separates market and sector betas from synthetic prices", () => {
    const r = lcg(11);
    const dates = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));
    let m = 100, k = 100, s = 100;
    const market = [], sector = [], stock = [];
    for (const date of dates) {
      const rm = r() * 0.02;
      const rs = rm + r() * 0.01;
      const ri = 1.2 * rm + 0.8 * (rs - rm) + r() * 0.002;
      m *= 1 + rm; k *= 1 + rs; s *= 1 + ri;
      market.push({ date, close: m }); sector.push({ date, close: k }); stock.push({ date, close: s });
    }
    const a = marketSectorAttribution(stock, market, sector)!;
    expect(a.marketBeta).toBeCloseTo(1.2, 1);
    expect(a.sectorBeta).toBeCloseTo(0.8, 1);
    const d = decomposeReturn(stock, market, sector, a, dates[300]);
    expect(d!.market + d!.sector + d!.residual).toBeCloseTo(d!.total, 12);
  });
});

describe("multiple-testing haircut", () => {
  it("inverse normal CDF matches known quantiles", () => {
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959964, 5);
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 9);
    expect(inverseNormalCdf(0.01)).toBeCloseTo(-2.326348, 5);
  });
  it("expected max Sharpe grows with trials and shrinks with sample length", () => {
    expect(expectedMaxSharpe(1, 3)).toBe(0);
    expect(expectedMaxSharpe(10, 3)).toBeGreaterThan(expectedMaxSharpe(5, 3));
    expect(expectedMaxSharpe(5, 10)).toBeLessThan(expectedMaxSharpe(5, 3));
    expect(expectedMaxSharpe(5, 4)).toBeGreaterThan(0.5);
  });
});
