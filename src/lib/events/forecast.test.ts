// @vitest-environment node
import { describe, expect, it } from "vitest";
import forecastLedger from "@/data/events/forecast-ledger.json";
import { summarize, walkForward } from "./evaluation";
import { HORIZONS, SCORING_VERSION, predict, scoreForecast, type ForecastRecord } from "./forecast";
import { appendRecord, GENESIS, verifyChain } from "./ledger";
import type { PriceSeries } from "./market";
import { benchmarkOf, priceSeries, scoredForecasts, series } from "./view";

const LEDGER = forecastLedger as unknown as ForecastRecord[];

function withFutureBars(s: PriceSeries, bars: number, jump: number): PriceSeries {
  const dates = [...s.dates];
  const adj = [...s.adj];
  const volume = [...s.volume];
  const d = new Date(`${dates.at(-1)}T00:00:00Z`);
  for (let i = 0; i < bars; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    dates.push(d.toISOString().slice(0, 10));
    adj.push(adj.at(-1)! * (1 + jump));
    volume.push(1);
  }
  return { ...s, dates, adj, volume };
}

describe("no future leakage", () => {
  it("gives the same prediction whatever comes after the cutoff", () => {
    const nvda = series("NVDA")!;
    const qqq = series("QQQ")!;
    const spec = { instrument: "NVDA", benchmark: "QQQ", horizon: 5 as const, informationCutoff: "2026-11-05" };
    const base = predict(spec, nvda, qqq);
    const crashAfter = predict(spec, withFutureBars(nvda, 30, -0.2), withFutureBars(qqq, 30, -0.1));
    expect(crashAfter).toEqual(base);
    expect(base.dataAsOf).toBe("2026-11-05");
  });

  it("reproduces every stored forecast from data up to its cutoff", () => {
    for (const rec of LEDGER) {
      const again = predict(rec, series(rec.instrument)!, series(rec.benchmark));
      expect(again.dataAsOf, rec.id).toBe(rec.dataAsOf);
      // A refreshed snapshot can carry the vendor's ~1e-6 rounding revisions to adjusted closes,
      // so bounds are reproduced to 1e-9 rather than bit-for-bit. The ledger hash proves what was stored.
      expect(again.prediction.interval?.[0], rec.id).toBeCloseTo(rec.prediction.interval![0], 9);
      expect(again.prediction.pUp, rec.id).toBeCloseTo(rec.prediction.pUp!, 12);
    }
  });

  it("validates direction only on data the forecast could see", () => {
    const smh = series("SMH")!;
    const spy = series(benchmarkOf("SMH"))!;
    const upToCutoff = walkForward(smh, spy, spy, 5, 5, "2026-11-05");
    expect(upToCutoff.every((s) => s.score.targetDate! <= "2026-11-05")).toBe(true);
  });
});

describe("missing and stale data", () => {
  it("abstains when the latest price is stale", () => {
    const p = predict({ instrument: "NVDA", benchmark: "QQQ", horizon: 1, informationCutoff: "2026-12-31" }, series("NVDA")!, series("QQQ")!);
    expect(p.prediction.status).toBe("INSUFFICIENT_DATA");
    expect(p.prediction.direction).toBe("ABSTAIN");
    expect(p.prediction.reason).toMatch(/older than the cutoff/);
  });

  it("abstains when there is too little history", () => {
    const p = predict({ instrument: "CRCL", benchmark: "QQQ", horizon: 5, informationCutoff: "2025-09-01" }, series("CRCL")!, series("QQQ")!);
    expect(p.prediction.status).toBe("INSUFFICIENT_DATA");
  });

  it("skips missing closes rather than treating them as zero returns", () => {
    for (const s of priceSeries().values()) {
      expect(s.adj.every((x) => Number.isFinite(x) && x > 0), s.symbol).toBe(true);
      // Strictly increasing dates: a missing close is dropped, never filled with a repeated price.
      expect(s.dates.every((d, i) => i === 0 || d > s.dates[i - 1]), s.symbol).toBe(true);
    }
  });
});

describe("scoring against the right benchmark", () => {
  it("measures excess return against the benchmark over the same interval", () => {
    const done = scoredForecasts().filter((s) => s.score.status === "scored" && s.score.benchmarkReturn !== null);
    expect(done.length).toBeGreaterThan(0);
    for (const { score } of done) expect(score.excess!).toBeCloseTo(score.realized! - score.benchmarkReturn!, 12);
  });

  it("leaves forecasts pending until the horizon has passed", () => {
    const pending = scoredForecasts().filter((s) => s.record.horizon === 60);
    expect(pending.every((s) => s.score.status === "pending")).toBe(true);
  });

  it("does not score a direction the forecast abstained on", () => {
    const abstained = scoredForecasts().filter((s) => s.record.prediction.direction === "ABSTAIN" && s.score.status === "scored");
    expect(abstained.every((s) => s.score.directionHit === null && s.score.netDirectionalReturn === null)).toBe(true);
  });

  it("charges transaction costs on a directional call", () => {
    const rec = { dataAsOf: "2026-11-04", horizon: 1 as const, costBps: 10, prediction: { ...LEDGER[0].prediction, direction: "DOWN" as const } };
    const s = scoreForecast(rec, series("NVDA")!, series("QQQ")!);
    expect(s.netDirectionalReturn!).toBeCloseTo(-s.realized! - 0.001, 12);
  });
});

describe("relative-range scoring (score-v2)", () => {
  const twoBars = (symbol: string, end: number): PriceSeries => ({ symbol, calendar: "us-equity", dates: ["2026-11-02", "2026-11-03"], adj: [100, end], volume: [1, 1] });
  const score = (assetEnd: number, benchEnd: number, rel: [number, number]) =>
    scoreForecast({ dataAsOf: "2026-11-02", horizon: 1, costBps: 0, prediction: { ...LEDGER[0].prediction, interval: [-0.5, 0.5], relInterval: rel } }, twoBars("A", assetEnd), twoBars("B", benchEnd));

  it("scores against relative wealth return when arithmetic excess would say outside", () => {
    // +30% vs +22%: arithmetic excess 8% is outside ±7%; relative wealth return 1.30 / 1.22 − 1 = 6.6% is inside.
    const s = score(130, 122, [-0.07, 0.07]);
    expect(s.excess!).toBeCloseTo(0.08, 12);
    expect(s.relative!).toBeCloseTo(1.3 / 1.22 - 1, 12);
    expect(s.inRelInterval).toBe(true);
    expect(s.inRelIntervalV1).toBe(false);
    expect(s.scoringVersion).toBe(SCORING_VERSION);
  });

  it("scores against relative wealth return when arithmetic excess would say inside", () => {
    // −20% vs −15%: arithmetic excess −5% is inside [−5.5%, +7%]; relative 0.80 / 0.85 − 1 = −5.9% is outside.
    const s = score(80, 85, [-0.055, 0.07]);
    expect(s.inRelInterval).toBe(false);
    expect(s.inRelIntervalV1).toBe(true);
  });

  it("builds the relative range from log excess returns, so it brackets relative wealth return symmetrically in logs", () => {
    const rec = LEDGER.find((r) => r.prediction.relInterval)!;
    const [lo, hi] = rec.prediction.relInterval!;
    expect(Math.log(1 + lo)).toBeCloseTo(-Math.log(1 + hi), 12);
  });
});

describe("walk-forward evaluation", () => {
  it("reports an interval coverage near its 80% target for a liquid ETF", () => {
    const smh = series("SMH")!;
    const spy = series("SPY")!;
    const s = summarize("SMH", 5, walkForward(smh, spy, spy, 5));
    expect(s.n).toBeGreaterThan(50);
    expect(s.coverage!).toBeGreaterThan(0.65);
    expect(s.coverage!).toBeLessThan(0.95);
  });

  it("does not validate a direction when there is no out-of-sample edge", () => {
    for (const h of HORIZONS) {
      const s = summarize("QQQ", h, walkForward(series("QQQ")!, null, series("QQQ")!, h));
      if (!s.directionValidated) expect(s.validationNote).toMatch(/Not validated|No scored/);
    }
  });

  it("counts overlapping long-horizon forecasts as fewer independent observations", () => {
    const s = summarize("SPY", 60, walkForward(series("SPY")!, null, series("SPY")!, 60));
    expect(s.effectiveN).toBeLessThan(s.n);
  });
});

describe("immutable forecast ledger", () => {
  it("has an intact hash chain", () => {
    expect(verifyChain(LEDGER).ok).toBe(true);
  });

  it("detects an edited prediction", () => {
    const tampered = LEDGER.map((r, i) => (i === 3 ? { ...r, prediction: { ...r.prediction, center: 0.05 } } : r));
    const check = verifyChain(tampered);
    expect(check.ok).toBe(false);
    expect(check.brokenAt).toBe(3);
  });

  it("detects a deleted record", () => {
    expect(verifyChain([...LEDGER.slice(0, 2), ...LEDGER.slice(3)]).ok).toBe(false);
  });

  it("appends without touching earlier records", () => {
    const chain = LEDGER as unknown as Array<{ id: string; hash: string; prevHash: string }>;
    const next = appendRecord(chain, { id: "X" });
    expect(next.prevHash).toBe(LEDGER.at(-1)!.hash);
    expect(verifyChain([...chain, next]).ok).toBe(true);
    expect(appendRecord([], { id: "first" }).prevHash).toBe(GENESIS);
  });

  it("labels forecasts made after their first target bar closed as backfill", () => {
    const crypto = LEDGER.filter((r) => r.calendar === "crypto-utc" && r.informationCutoff === "2026-11-06");
    expect(crypto.every((r) => r.origin === "backfill")).toBe(true);
    const nov5 = LEDGER.filter((r) => r.informationCutoff === "2026-11-05");
    expect(nov5.every((r) => r.origin === "backfill")).toBe(true);
  });
});
