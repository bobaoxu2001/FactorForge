// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BINANCE_CASE } from "@/data/events/cases/binance";
import { AI_DATACENTER_CASE } from "@/data/events/cases/aiDatacenter";
import { carVariance, eventStudy, fitMarketModel, alignReturns, type PriceSeries } from "./market";
import { barCloseInstant, firstReactionIndex, parseInstant } from "./time";
import { windowView } from "./view";

function synthetic(symbol: string, returns: number[], start = "2026-01-01", calendar: PriceSeries["calendar"] = "crypto-utc"): PriceSeries {
  const dates: string[] = [];
  const adj: number[] = [100];
  const d = new Date(`${start}T00:00:00Z`);
  dates.push(d.toISOString().slice(0, 10));
  for (const r of returns) {
    d.setUTCDate(d.getUTCDate() + 1);
    dates.push(d.toISOString().slice(0, 10));
    adj.push(adj.at(-1)! * (1 + r));
  }
  return { symbol, calendar, dates, adj, volume: dates.map(() => 1_000) };
}

const noise = (n: number, seed: number) => {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 16807) % 2147483647;
    return ((x / 2147483647) - 0.5) * 0.02;
  });
};

describe("event timing and time zones", () => {
  it("puts an event after the New York close into the next session", () => {
    const eventMs = parseInstant(BINANCE_CASE.events[0].occurredAt); // 17:05 Brasília = 16:05 New York
    expect(eventMs).toBeGreaterThan(barCloseInstant("2026-10-29", "us-equity"));
    expect(firstReactionIndex(["2026-10-28", "2026-10-29", "2026-10-30"], eventMs, "us-equity")).toBe(2);
  });

  it("puts the same event into the same day's UTC crypto bar", () => {
    const eventMs = parseInstant(BINANCE_CASE.events[0].occurredAt);
    expect(firstReactionIndex(["2026-10-28", "2026-10-29", "2026-10-30"], eventMs, "crypto-utc")).toBe(1);
  });

  it("handles the end of US daylight saving time (1 Nov 2026)", () => {
    expect(new Date(barCloseInstant("2026-10-30", "us-equity")).toISOString()).toBe("2026-10-30T20:00:00.000Z");
    expect(new Date(barCloseInstant("2026-11-02", "us-equity")).toISOString()).toBe("2026-11-02T21:00:00.000Z");
  });

  it("measures the Binance equity window from 30 Oct and the crypto window from 29 Oct", () => {
    const eq = windowView(BINANCE_CASE, "W-B-EQ")!;
    const crypto = windowView(BINANCE_CASE, "W-B-CRYPTO")!;
    expect(eq.studies.find((s) => s.symbol === "COIN")!.day0).toBe("2026-10-30");
    expect(crypto.studies.find((s) => s.symbol === "BNB-USD")!.day0).toBe("2026-10-29");
  });

  it("dates the election reaction to 4 Nov and flags the 5 Nov selloff inside longer windows", () => {
    const w = windowView(AI_DATACENTER_CASE, "W-A-ELECT")!;
    expect(w.studies[0].day0).toBe("2026-11-04");
    expect(w.overlaps["[0,0]"]).toHaveLength(0);
    expect(w.overlaps["[0,4]"].map((o) => o.eventId)).toContain("EV-AI-SELLOFF-2026-11-05");
  });
});

describe("benchmark-adjusted (abnormal) returns", () => {
  it("recovers the beta and finds no abnormal return when the asset only tracks its benchmark", () => {
    const m = noise(300, 7);
    const bench = synthetic("B", m);
    const asset = synthetic("A", m.map((x) => 1.5 * x));
    const fit = fitMarketModel(alignReturns(asset, bench), 0, 250);
    expect(fit.beta).toBeCloseTo(1.5, 6);
    const study = eventStudy(asset, bench, "2026-10-01T12:00:00Z");
    expect(Math.abs(study.windows[0].abnormal!)).toBeLessThan(1e-9);
    expect(study.persistence).toBe("no-significant-reaction");
  });

  it("detects an idiosyncratic shock and whether it reverses", () => {
    const m = noise(300, 11);
    const own = noise(300, 99).map((x) => x * 0.3);
    // Return r[i] is dated dates[i + 1]; the 30 Sep bar (day 0 for an event at noon UTC) is r[271].
    const day0 = 271;
    const r = m.map((x, i) => x + own[i] + (i === day0 ? -0.12 : i === day0 + 1 ? 0.11 : 0));
    const study = eventStudy(synthetic("A", r), synthetic("B", m), "2026-09-30T12:00:00Z");
    expect(study.windows[0].abnormal!).toBeLessThan(-0.1);
    expect(study.windows[0].tStat!).toBeLessThan(-5);
    expect(study.persistence).toBe("reversed");
  });

  it("widens the CAR band on a day the benchmark itself moved a lot (estimation error)", () => {
    const m = noise(300, 21);
    const r = alignReturns(synthetic("A", m.map((x, i) => 1.2 * x + noise(300, 4)[i] * 0.5)), synthetic("B", m));
    const fit = fitMarketModel(r, 0, 120);
    const quiet = [...r.bench!];
    quiet[200] = fit.meanBench;
    const loud = [...r.bench!];
    loud[200] = fit.meanBench - 0.06;
    expect(carVariance(fit, quiet, [200])).toBeCloseTo(fit.residualSd ** 2 * (1 + 1 / fit.n), 12);
    expect(carVariance(fit, loud, [200])).toBeGreaterThan(carVariance(fit, quiet, [200]) * 1.05);
  });

  it("does not call a move significant when moves that size are routine for the asset (placebo)", () => {
    // Fat tails: one day in ten moves ±6% on its own, but a normal-theory t on the typical day says that is rare.
    const m = noise(300, 13);
    const own = noise(300, 77).map((x, i) => (i % 10 === 3 ? (i % 20 === 3 ? 0.06 : -0.06) : x * 0.2));
    const day0 = 271;
    const r = m.map((x, i) => x + (i === day0 ? -0.06 : own[i]));
    const study = eventStudy(synthetic("A", r), synthetic("B", m), "2026-09-30T12:00:00Z");
    const w0 = study.windows[0];
    expect(w0.placeboShare!).toBeGreaterThan(0.05);
    expect(w0.significant).toBe(false);
    expect(study.persistence).toBe("no-significant-reaction");
  });

  it("compares against the benchmark over the same dates when calendars differ", () => {
    const crypto = synthetic("C", noise(30, 3));
    const equityDates = synthetic("E", noise(30, 5), "2026-01-01", "us-equity");
    equityDates.dates = equityDates.dates.filter((_, i) => i % 7 !== 5 && i % 7 !== 6);
    equityDates.adj = equityDates.adj.slice(0, equityDates.dates.length);
    equityDates.volume = equityDates.volume.slice(0, equityDates.dates.length);
    const aligned = alignReturns(crypto, equityDates);
    expect(aligned.dates.every((d) => equityDates.dates.includes(d))).toBe(true);
    expect(aligned.asset).toHaveLength(aligned.bench!.length);
  });

  it("marks windows that run past the data as incomplete instead of truncating them", () => {
    const w = windowView(AI_DATACENTER_CASE, "W-A-SELL")!;
    const smh = w.studies.find((s) => s.symbol === "SMH")!;
    expect(smh.windows.find((x) => x.label === "[0,19]")!.complete).toBe(false);
  });
});

describe("what the cases' market data show", () => {
  it("prices BNB's Binance-specific discount against bitcoin as significant", () => {
    const bnb = windowView(BINANCE_CASE, "W-B-CRYPTO")!.studies.find((s) => s.symbol === "BNB-USD")!;
    expect(bnb.windows[0].abnormal!).toBeLessThan(-0.03);
    expect(Math.abs(bnb.windows[0].tStat!)).toBeGreaterThan(1.96);
    expect(bnb.windows[0].significant).toBe(true);
  });

  it("finds no US crypto or security stock beyond noise on the first session after the breach", () => {
    const w = windowView(BINANCE_CASE, "W-B-EQ")!;
    expect(w.day0Tests.significant).toBe(0);
  });

  it("finds far more significant election-day reactions than chance would produce", () => {
    const w = windowView(AI_DATACENTER_CASE, "W-A-ELECT")!;
    expect(w.day0Tests.significant).toBeGreaterThan(3 * w.day0Tests.expectedByChance);
  });

  it("flags earlier events inside the estimation window", () => {
    const w = windowView(AI_DATACENTER_CASE, "W-A-ELECT")!;
    expect(w.estimationOverlaps.map((o) => o.eventId)).toEqual(expect.arrayContaining(["EV-NY-MORATORIUM-2026-07-14", "EV-TX-PERMIT-HALT-2026-09-21"]));
  });

  it("finds the power and grid group's abnormal decline on the first post-election session", () => {
    const grp = windowView(AI_DATACENTER_CASE, "W-A-ELECT")!.groups["[0,0]"].find((g) => g.group === "Power, cooling and grid equipment")!;
    expect(grp.meanAbnormal!).toBeLessThan(-0.05);
  });
});
