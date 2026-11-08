/**
 * Where a scheduled date stands relative to "today", in the market's own time
 * zone (US releases and earnings: New York). Passing a scheduled date says
 * nothing about whether the release happened or what it showed, so a passed
 * date is "outcome not checked", never "released" or "verified".
 */

export const CATALYST_TIME_ZONE = "America/New_York";

/** Calendar day (YYYY-MM-DD) of an instant in a time zone; server-side, no browser clock. */
export function dayIn(instant: Date, timeZone = CATALYST_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type CatalystTiming = "upcoming" | "today" | "passed";

export const TIMING_NOTE: Record<CatalystTiming, string> = {
  upcoming: "",
  today: "Scheduled today — outcome not checked",
  passed: "Scheduled date passed — outcome not checked",
};

/** `date` is a scheduled calendar day (YYYY-MM-DD) in the market's time zone. */
export function catalystTiming(date: string, now: Date, timeZone = CATALYST_TIME_ZONE): CatalystTiming {
  const today = dayIn(now, timeZone);
  return date > today ? "upcoming" : date === today ? "today" : "passed";
}

export function partitionCatalysts<T extends { date: string }>(items: T[], now: Date, timeZone = CATALYST_TIME_ZONE) {
  const today = dayIn(now, timeZone);
  const timed = items.map((item) => ({ item, timing: catalystTiming(item.date, now, timeZone) }));
  return {
    today,
    upcoming: timed.filter((x) => x.timing !== "passed"),
    passed: timed.filter((x) => x.timing === "passed").reverse(),
  };
}
