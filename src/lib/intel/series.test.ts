import { describe, expect, it } from "vitest";
import { buildReadings, leadLag, seriesFreshness, simpleRegression, trailingZScores, weeklyToMonthlyAverage, yoyChanges } from "./series";

const monthly = (values: number[], start = 2020) =>
  values.map((value, i) => ({ date: `${start + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, value }));

describe("yoyChanges", () => {
  it("matches by calendar month, not by array offset", () => {
    const pts = monthly(Array.from({ length: 24 }, (_, i) => 100 + i));
    const withGap = pts.filter((p) => p.date !== "2020-06-01");
    const yoy = yoyChanges(withGap, "monthly");
    const june2021 = withGap.findIndex((p) => p.date === "2021-06-01");
    expect(yoy[june2021]).toBeNull();
    const july2021 = withGap.findIndex((p) => p.date === "2021-07-01");
    expect(yoy[july2021]).toBeCloseTo(118 / 106 - 1, 12);
  });

  it("uses the observation ~364 days earlier for weekly series", () => {
    const start = Date.parse("2024-01-01T00:00:00Z");
    const pts = Array.from({ length: 60 }, (_, i) => ({ date: new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10), value: 10 + i }));
    const yoy = yoyChanges(pts, "weekly");
    expect(yoy[51]).toBeNull();
    expect(yoy[52]).toBeCloseTo((10 + 52) / 10 - 1, 12);
  });
});

describe("anomalies", () => {
  it("z-scores the current value against prior history only", () => {
    const values: Array<number | null> = [...Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01)), 0.5];
    const z = trailingZScores(values, 36, 24);
    expect(z[29]).not.toBeNull();
    expect((z[30] as number) > 10).toBe(true);
  });

  it("flags |z| ≥ 2 as an anomaly in readings", () => {
    // Noisy trend so YoY has non-zero dispersion (a zero-variance history has no z-score by design).
    const base = Array.from({ length: 48 }, (_, i) => 100 * 1.01 ** i * (1 + 0.01 * Math.sin(i * 1.7)));
    base.push(base[base.length - 1] * 1.3);
    const readings = buildReadings(monthly(base), "monthly");
    expect(readings.at(-1)?.anomaly).toBe(true);
    expect(readings[30].anomaly).toBe(false);
  });
});

describe("leadLag", () => {
  it("recovers a known lag and reports stability", () => {
    const leader = monthly(Array.from({ length: 120 }, (_, i) => Math.sin(i / 5) + 0.1 * Math.cos(i)));
    const follower = leader.map((p, i) => ({ date: p.date, value: i >= 3 ? leader[i - 3].value : null }));
    const r = leadLag(leader.map((p) => ({ date: p.date, value: p.value })), follower, 12);
    expect(r.best?.lag).toBe(3);
    expect(r.best?.correlation).toBeCloseTo(1, 6);
    expect(r.stable).toBe(true);
    expect(r.caveats.join(" ")).toMatch(/does not demonstrate predictive power/);
  });
});

describe("simpleRegression", () => {
  it("fits an exact line", () => {
    const fit = simpleRegression(Array.from({ length: 20 }, (_, i) => [i, 2 + 0.5 * i] as [number, number]));
    expect(fit?.slope).toBeCloseTo(0.5, 12);
    expect(fit?.intercept).toBeCloseTo(2, 12);
    expect(fit?.rSquared).toBeCloseTo(1, 12);
  });
});

describe("weeklyToMonthlyAverage", () => {
  it("averages weeks into first-of-month dates", () => {
    const out = weeklyToMonthlyAverage([
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-12", value: 3 },
      { date: "2026-02-02", value: 10 },
    ]);
    expect(out).toEqual([
      { date: "2026-01-01", value: 2 },
      { date: "2026-02-01", value: 10 },
    ]);
  });
});

describe("seriesFreshness", () => {
  const asOf = new Date("2026-11-01T12:00:00Z");
  it("is fresh when the latest expected month is present", () => {
    expect(seriesFreshness("2026-09-01", "monthly", 20, asOf).freshness).toBe("fresh");
  });
  it("is lagging one period behind and stale two or more behind", () => {
    expect(seriesFreshness("2026-08-01", "monthly", 20, asOf).freshness).toBe("lagging");
    expect(seriesFreshness("2026-05-01", "monthly", 20, asOf).freshness).toBe("stale");
  });
  it("accounts for publication lag", () => {
    expect(seriesFreshness("2026-07-01", "monthly", 65, asOf).freshness).toBe("fresh");
  });
});
