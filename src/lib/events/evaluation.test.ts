// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyFamily, binomialTail, effectiveSampleSize, pooledCoverage, summarize, walkForward, wilson, type WalkForwardSummary } from "./evaluation";
import { HORIZONS, MODEL_VERSION } from "./forecast";
import type { PriceSeries } from "./market";
import { evaluationFamily, pooled, scoredForecasts, series } from "./view";

function synthetic(symbol: string, returns: number[]): PriceSeries {
  const dates: string[] = [];
  const adj: number[] = [100];
  const d = new Date("2023-01-01T00:00:00Z");
  dates.push(d.toISOString().slice(0, 10));
  for (const r of returns) {
    d.setUTCDate(d.getUTCDate() + 1);
    dates.push(d.toISOString().slice(0, 10));
    adj.push(adj.at(-1)! * (1 + r));
  }
  return { symbol, calendar: "crypto-utc", dates, adj, volume: dates.map(() => 1) };
}

const lcg = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
};

describe("statistical primitives", () => {
  it("computes an exact binomial tail", () => {
    expect(binomialTail(8, 10, 0.5)!).toBeCloseTo(56 / 1024, 12);
    expect(binomialTail(0, 10, 0.5)).toBe(1);
    expect(binomialTail(11, 10, 0.5)).toBe(0);
  });

  it("computes a Wilson interval", () => {
    const [lo, hi] = wilson(8, 10)!;
    expect(lo).toBeCloseTo(0.4902, 3);
    expect(hi).toBeCloseTo(0.9433, 3);
  });

  it("shrinks the sample size for overlapping horizons and leaves independent draws alone", () => {
    const u = lcg(5);
    const iid = Array.from({ length: 200 }, () => (u() < 0.8 ? 1 : 0));
    expect(effectiveSampleSize(iid, 1, 5).effective).toBeGreaterThan(150);
    // A 20-bar outcome sampled every 5 bars: neighbours share three-quarters of their path.
    const path = Array.from({ length: 1000 }, () => u() - 0.5);
    const overlapping = Array.from({ length: 196 }, (_, i) => (path.slice(i * 5, i * 5 + 20).reduce((a, b) => a + b, 0) > 0 ? 1 : 0));
    const ess = effectiveSampleSize(overlapping, 20, 5);
    expect(ess.effective).toBeLessThanOrEqual(Math.floor((196 * 5) / 20));
    expect(ess.autocorr).toBeLessThan(196);
  });
});

describe("directional skill", () => {
  it("does not credit a rule that always calls the side the asset drifted to", () => {
    // Falls on ~62% of days: "always down" is right ~62% of the time with no skill at all.
    const u = lcg(17);
    const r = Array.from({ length: 900 }, () => (u() < 0.62 ? -0.01 : 0.012) + (u() - 0.5) * 0.002);
    const s = synthetic("TREND", r);
    const sum = summarize("TREND", 1, walkForward(s, null, s, 1));
    expect(sum.skill.hitRate!).toBeGreaterThan(0.55);
    expect(sum.skill.bestConstant).toBe("DOWN");
    expect(sum.directionValidated).toBe(false);
    expect(sum.validationNote).toMatch(/always down/);
  });

  it("Holm-adjusts p-values across the family and keeps them monotone", () => {
    const base = summarize("SPY", 1, walkForward(series("SPY")!, null, series("SPY")!, 1));
    const withP = (p: number): WalkForwardSummary => ({ ...base, skill: { ...base.skill, pValue: p } });
    const fam = applyFamily([withP(0.001), withP(0.02), withP(0.04), withP(0.5)]);
    expect(fam.map((s) => s.skill.adjustedP)).toEqual([0.004, 0.06, 0.08, 0.5]);
    expect(fam.every((s) => s.skill.familySize === 4)).toBe(true);
  });

  it("validates nothing in the snapshot that fails the constant-rule, Brier or family checks", () => {
    for (const s of evaluationFamily().values()) {
      if (!s.directionValidated) continue;
      expect(s.skill.adjustedP!).toBeLessThan(0.05);
      expect(s.skill.hitRate!).toBeGreaterThan(s.skill.bestConstantHitRate!);
      expect(s.brierSkillVsBaseRate!).toBeGreaterThan(0);
    }
    expect([...evaluationFamily().values()].every((s) => s.skill.familySize === evaluationFamily().size)).toBe(true);
  });

  it("shows how the current gate treats the one v1 directional call, without rewriting it", () => {
    const v1 = scoredForecasts().filter((f) => f.record.prediction.direction !== "ABSTAIN" && f.record.modelVersion !== MODEL_VERSION);
    expect(v1.length).toBeGreaterThan(0);
    for (const f of v1) {
      expect(f.ruleCheck).not.toBeNull();
      expect(f.record.prediction.direction).not.toBe("ABSTAIN"); // the stored call is untouched
    }
    const mstr = v1.find((f) => f.record.id === "F-2026-10-30-MSTR-1")!;
    expect(mstr.ruleCheck!.currentRuleWouldCall).toBe(false);
  });
});

describe("interval calibration", () => {
  it("flags a range that is too narrow and one that is too wide", () => {
    const u = lcg(3);
    const calm = Array.from({ length: 700 }, () => (u() - 0.5) * 0.004);
    // Volatility jumps tenfold after the warm-up: an EWMA range lags and under-covers at first.
    const shock = [...calm.slice(0, 400), ...Array.from({ length: 300 }, () => (u() - 0.5) * 0.04)];
    const narrow = summarize("SHOCK", 1, walkForward(synthetic("SHOCK", shock), null, synthetic("SHOCK", shock), 1, 1));
    expect(narrow.coverageStat.coverage!).toBeLessThan(0.8);
    const quiet = [...Array.from({ length: 400 }, () => (u() - 0.5) * 0.04), ...calm.slice(0, 300)];
    const wide = summarize("QUIET", 20, walkForward(synthetic("QUIET", quiet), null, synthetic("QUIET", quiet), 20, 1));
    expect(wide.coverageStat.coverage!).toBeGreaterThan(0.8);
  });

  it("deflates pooled effective n when instruments miss together", () => {
    const one = summarize("SPY", 5, walkForward(series("SPY")!, null, series("SPY")!, 5));
    const clones = [one, { ...one, instrument: "A" }, { ...one, instrument: "B" }];
    const p = pooledCoverage(5, clones);
    expect(p.meanCorrelation).toBeCloseTo(1, 6);
    expect(p.overall.effectiveN).toBe(one.coverageStat.effectiveN);
  });

  it("reports pooled coverage for every horizon with an interval", () => {
    const all = pooled();
    expect(all.map((p) => p.horizon)).toEqual([...HORIZONS]);
    for (const p of all) {
      expect(p.overall.coverage).not.toBeNull();
      expect(p.overall.ci![0]).toBeLessThan(p.overall.ci![1]);
      expect(p.overall.effectiveN).toBeLessThan(p.overall.n);
    }
  });
});
