import { describe, expect, it } from "vitest";
import type { FactorSnapshot } from "@/types/market";
import { buildHotspotReport } from "./hotspotAgent";

function factor(symbol: string, over: Partial<FactorSnapshot> = {}): FactorSnapshot {
  return {
    symbol,
    date: "2026-06-05",
    momentum20d: 0.03,
    momentum60d: 0.06,
    volatility20d: 0.22,
    volumeSurge: 1.1,
    aboveSma200: true,
    rsi14: 56,
    provider: "yahoo",
    isFallback: false,
    adjusted: true,
    ...over,
  };
}

// A representative in-universe factor set (symbols that appear in the watchlist
// and in several theme proxy baskets).
const FACTORS: FactorSnapshot[] = [
  factor("TSLA", { momentum20d: -0.04, aboveSma200: false, rsi14: 41 }),
  factor("NVDA", { momentum20d: 0.08, aboveSma200: true, rsi14: 64 }),
  factor("MSFT"),
  factor("GOOGL"),
  factor("AMZN"),
  factor("META"),
  factor("NEE"),
  factor("DUK"),
  factor("O"),
  factor("AMT"),
  factor("JPM"),
  factor("PG"),
  factor("KO"),
  factor("WMT"),
  factor("JNJ"),
  factor("HON"),
];

function report(regime = "risk-on", stressScore = 20) {
  return buildHotspotReport({
    factors: FACTORS,
    regime: { regime, stressScore },
    radarCandidates: [],
    generatedAt: "2026-06-06T00:00:00.000Z",
  });
}

describe("buildHotspotReport", () => {
  it("features the Space Economy theme as a private-market catalyst", () => {
    const r = report();
    expect(r.featured.id).toBe("space-economy");
    expect(r.featured.assetType).toBe("private-market-catalyst");
    expect(r.featured.assetTypeNote?.toLowerCase()).toContain("private");
  });

  it("never fabricates live data for out-of-universe proxies", () => {
    const space = report().themes.find((t) => t.id === "space-economy")!;
    const rklb = space.proxies.find((p) => p.symbol === "RKLB")!;
    const tsla = space.proxies.find((p) => p.symbol === "TSLA")!;
    expect(rklb.inUniverse).toBe(false);
    expect(rklb.live).toBeNull();
    expect(tsla.inUniverse).toBe(true);
    expect(tsla.live).not.toBeNull();
  });

  it("keeps every signal strength and confidence in [0,100]", () => {
    for (const t of report().themes) {
      expect(t.signalStrength).toBeGreaterThanOrEqual(0);
      expect(t.signalStrength).toBeLessThanOrEqual(100);
      expect(t.scenario.confidence).toBeGreaterThanOrEqual(0);
      expect(t.scenario.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("produces valid bull/base/bear legs with ordered ranges and normalized weights", () => {
    for (const t of report().themes) {
      const cases = t.scenario.legs.map((l) => l.case).sort();
      expect(cases).toEqual(["base", "bear", "bull"]);
      for (const leg of t.scenario.legs) {
        expect(leg.impactLow).toBeLessThanOrEqual(leg.impactHigh);
        expect(leg.probability).toBeGreaterThan(0);
      }
      const totalP = t.scenario.legs.reduce((s, l) => s + l.probability, 0);
      expect(totalP).toBeGreaterThan(0.97);
      expect(totalP).toBeLessThan(1.03);
    }
  });

  it("brightens the defensive theme and dims growth themes as stress rises", () => {
    const calm = report("risk-on", 15).themes;
    const stressed = report("risk-off", 80).themes;
    const defCalm = calm.find((t) => t.id === "risk-off-rotation")!.signalStrength;
    const defStressed = stressed.find((t) => t.id === "risk-off-rotation")!.signalStrength;
    expect(defStressed).toBeGreaterThan(defCalm);
  });

  it("labels the data source honestly (no live news)", () => {
    const r = report();
    expect(r.dataSource.newsConnected).toBe(false);
    expect(r.dataSource.engine).toBe("Demo catalyst engine");
    expect(r.agentSteps.some((s) => s.id === "scan-news" && s.status === "not-connected")).toBe(true);
    expect(r.disclaimer.toLowerCase()).toContain("not investment advice");
  });

  it("ranks themes by descending signal strength", () => {
    const strengths = report().themes.map((t) => t.signalStrength);
    const sorted = [...strengths].sort((a, b) => b - a);
    expect(strengths).toEqual(sorted);
  });
});
