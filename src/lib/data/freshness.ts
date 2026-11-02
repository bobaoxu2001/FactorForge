/**
 * Price-series freshness. A committed snapshot is real data, but real data can
 * be old: a page must never present a months-old last bar as current. The
 * threshold tolerates weekends and a market holiday (Fri close → Tue morning).
 */
export const PRICE_STALE_AFTER_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDaysBetween(fromIsoDate: string, to: Date): number {
  const from = Date.parse(`${fromIsoDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(from)) return Number.NaN;
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((toDay - from) / DAY_MS));
}

export function priceFreshness(lastDate: string | null, now: Date = new Date()): { ageDays: number; stale: boolean } {
  if (!lastDate) return { ageDays: Number.NaN, stale: true };
  const ageDays = calendarDaysBetween(lastDate, now);
  return { ageDays, stale: !Number.isFinite(ageDays) || ageDays > PRICE_STALE_AFTER_DAYS };
}
