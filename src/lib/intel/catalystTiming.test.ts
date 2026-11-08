// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TIMING_NOTE, catalystTiming, dayIn, partitionCatalysts } from "./catalystTiming";

describe("catalyst timing in the market's time zone", () => {
  const date = "2026-11-06";

  it("is upcoming before the scheduled day, today on it, and passed after it", () => {
    expect(catalystTiming(date, new Date("2026-11-05T15:00:00Z"))).toBe("upcoming");
    expect(catalystTiming(date, new Date("2026-11-06T15:00:00Z"))).toBe("today");
    expect(catalystTiming(date, new Date("2026-11-07T15:00:00Z"))).toBe("passed");
  });

  it("uses New York days, not UTC days, at the boundary", () => {
    // 03:30 UTC on 7 Nov is still 22:30 on 6 Nov in New York.
    expect(dayIn(new Date("2026-11-07T03:30:00Z"))).toBe("2026-11-06");
    expect(catalystTiming(date, new Date("2026-11-07T03:30:00Z"))).toBe("today");
    // 05:30 UTC on 7 Nov is 00:30 on 7 Nov in New York (EST, after the 1 Nov DST change).
    expect(catalystTiming(date, new Date("2026-11-07T05:30:00Z"))).toBe("passed");
  });

  it("never turns a passed date into a release, completion or verification", () => {
    for (const note of Object.values(TIMING_NOTE)) expect(note).not.toMatch(/released|completed|verified/i);
    expect(TIMING_NOTE.passed).toMatch(/outcome not checked/);
  });

  it("keeps past dates out of the upcoming list and lists them newest first", () => {
    const items = [{ date: "2026-11-03" }, { date: "2026-11-06" }, { date: "2026-11-08" }, { date: "2026-11-13" }];
    const p = partitionCatalysts(items, new Date("2026-11-08T20:00:00Z"));
    expect(p.today).toBe("2026-11-08");
    expect(p.upcoming.map((x) => [x.item.date, x.timing])).toEqual([["2026-11-08", "today"], ["2026-11-13", "upcoming"]]);
    expect(p.passed.map((x) => x.item.date)).toEqual(["2026-11-06", "2026-11-03"]);
  });

  it("returns an empty upcoming list rather than inventing dates", () => {
    const p = partitionCatalysts([{ date: "2026-11-03" }], new Date("2026-12-01T12:00:00Z"));
    expect(p.upcoming).toEqual([]);
    expect(p.passed).toHaveLength(1);
  });
});
