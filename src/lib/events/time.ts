/**
 * Timestamp discipline for the event engine.
 *
 * Every timestamp carries an explicit offset. A naive "2026-10-29T17:05"
 * could be Brasília, New York or UTC, and the difference decides whether an
 * event happened before or after a market close, which is the difference
 * between a price move the event could explain and one it could not.
 */

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export class TimestampError extends Error {}

/** Parse an ISO timestamp that must carry an offset. Returns epoch ms. */
export function parseInstant(value: string, field = "timestamp"): number {
  if (!ISO_WITH_OFFSET.test(value)) {
    throw new TimestampError(`${field} "${value}" must be ISO 8601 with an explicit offset (e.g. 2026-10-29T17:05:00-03:00)`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new TimestampError(`${field} "${value}" is not a valid date`);
  return ms;
}

export const toIso = (ms: number) => new Date(ms).toISOString();

// Intl formatters are expensive to construct; build one per time zone.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const partFormatters = new Map<string, Intl.DateTimeFormat>();

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function dateIn(ms: number, timeZone: string): string {
  let f = dateFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormatters.set(timeZone, f);
  }
  return f.format(new Date(ms));
}

/** Offset of a time zone from UTC at an instant, in minutes (New York in October: −240). */
function offsetMinutes(ms: number, timeZone: string): number {
  let f = partFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partFormatters.set(timeZone, f);
  }
  const parts = f.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - ms) / 60_000);
}

/** The instant a local wall-clock time occurs on a date in a time zone. */
export function zonedInstant(date: string, hhmm: string, timeZone: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.parse(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  // Two passes settle DST boundaries.
  let instant = guess - offsetMinutes(guess, timeZone) * 60_000;
  instant = guess - offsetMinutes(instant, timeZone) * 60_000;
  return instant;
}

export type MarketCalendar = "us-equity" | "crypto-utc";

const closeCache = new Map<string, number>();

/** When the daily bar dated `date` closes. */
export function barCloseInstant(date: string, calendar: MarketCalendar): number {
  const key = `${calendar}:${date}`;
  let ms = closeCache.get(key);
  if (ms === undefined) {
    ms = calendar === "us-equity" ? zonedInstant(date, "16:00", "America/New_York") : Date.parse(`${date}T00:00:00Z`) + 86_400_000;
    closeCache.set(key, ms);
  }
  return ms;
}

/**
 * Index of the first daily bar whose close comes after the event, i.e. the
 * first bar whose return can contain the market's reaction. For US equities an
 * event at 16:05 New York time belongs to the next session; for crypto (UTC
 * daily bars) it belongs to the same UTC day's bar.
 */
export function firstReactionIndex(dates: string[], eventMs: number, calendar: MarketCalendar): number {
  // Dates are sorted and bar closes increase with them, so binary search.
  let lo = 0;
  let hi = dates.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (barCloseInstant(dates[mid], calendar) > eventMs) {
      found = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return found;
}

/** Whole calendar days between two instants (floor). */
export const daysBetween = (fromMs: number, toMs: number) => Math.floor((toMs - fromMs) / 86_400_000);
