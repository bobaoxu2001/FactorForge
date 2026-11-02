import type { Derivation, MetricSeries, QuarterValue } from "./types";

/**
 * Financial statements from SEC XBRL facts.
 *
 * 10-Qs report 3-month income-statement values but year-to-date cash flows, and
 * Q4 is never filed on its own. This module turns raw facts into quarters
 * without hiding how each number was obtained:
 *   reported-3m    a 3-month fact was filed directly
 *   ytd-difference YTD(t) − YTD(t−1) with the same fiscal-year start
 *   fy-minus-9m    annual (10-K) value minus the 9-month YTD value
 *
 * Point-in-time: every quarter carries the latest filing date among the facts
 * it was built from, which is the first day the number was knowable. The
 * restated value (if any) is kept separately in `latestValue`.
 */

export interface RawFact {
  start: string | null;
  end: string;
  value: number;
  filed: string;
  form: string;
  accn: string;
  fy: number | null;
  fp: string | null;
  latestValue: number;
  latestFiled: string;
  latestAccn: string;
}

export interface RawMetric {
  concept: string | null;
  label: string | null;
  unit: string;
  kind: "duration" | "instant";
  points: RawFact[];
}

const DAY_MS = 86_400_000;
const days = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);

type DurationClass = "Q" | "H" | "9M" | "FY" | null;

function classify(fact: RawFact): DurationClass {
  if (!fact.start) return null;
  const d = days(fact.start, fact.end);
  if (d >= 80 && d <= 100) return "Q";
  if (d >= 170 && d <= 195) return "H";
  if (d >= 260 && d <= 290) return "9M";
  if (d >= 350 && d <= 380) return "FY";
  return null;
}

function combine(
  end: string,
  start: string | null,
  derivation: Derivation,
  plus: RawFact,
  minus: RawFact | null,
): QuarterValue {
  const value = plus.value - (minus?.value ?? 0);
  const latest = plus.latestValue - (minus?.latestValue ?? 0);
  const filed = minus && minus.filed > plus.filed ? minus.filed : plus.filed;
  const revised = plus.latestValue !== plus.value || (minus !== null && minus.latestValue !== minus.value);
  return {
    end,
    start,
    value,
    derivation,
    filed,
    accession: plus.accn,
    form: plus.form,
    revised,
    latestValue: revised ? latest : null,
  };
}

const dayAfter = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** Quarterly values for a duration (flow) metric. Direct 3-month facts win over derived ones. */
export function quarterizeDuration(points: RawFact[]): QuarterValue[] {
  const byEnd = new Map<string, QuarterValue>();
  const cumulative = new Map<string, RawFact[]>(); // fiscal-year start → YTD facts (Q, H, 9M, FY)

  for (const fact of points) {
    const cls = classify(fact);
    if (cls === null || !fact.start) continue;
    if (cls === "Q") {
      byEnd.set(fact.end, combine(fact.end, fact.start, "reported-3m", fact, null));
    }
    const list = cumulative.get(fact.start) ?? [];
    list.push(fact);
    cumulative.set(fact.start, list);
  }

  for (const facts of cumulative.values()) {
    // Ordered by length of the YTD window: Q (3M from FY start) → H → 9M → FY.
    const order: DurationClass[] = ["Q", "H", "9M", "FY"];
    const byClass = new Map<DurationClass, RawFact>();
    for (const fact of facts) byClass.set(classify(fact), fact);
    for (let i = 1; i < order.length; i += 1) {
      const current = byClass.get(order[i]);
      const prior = byClass.get(order[i - 1]);
      if (!current || !prior || byEnd.has(current.end)) continue;
      const derivation: Derivation = order[i] === "FY" ? "fy-minus-9m" : "ytd-difference";
      byEnd.set(current.end, combine(current.end, dayAfter(prior.end), derivation, current, prior));
    }
  }

  return [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
}

/** Instant (balance-sheet) values, one per date. */
export function instantValues(points: RawFact[]): QuarterValue[] {
  return points
    .filter((p) => p.start === null)
    .map((p) => ({
      end: p.end,
      start: null,
      value: p.value,
      derivation: "instant" as const,
      filed: p.filed,
      accession: p.accn,
      form: p.form,
      revised: p.latestValue !== p.value,
      latestValue: p.latestValue !== p.value ? p.latestValue : null,
    }))
    .sort((a, b) => a.end.localeCompare(b.end));
}

export function toMetricSeries(key: string, raw: RawMetric | undefined): MetricSeries {
  if (!raw) return { key, concept: null, label: null, unit: "USD", quarters: [] };
  return {
    key,
    concept: raw.concept,
    label: raw.label,
    unit: raw.unit,
    quarters: raw.kind === "duration" ? quarterizeDuration(raw.points) : instantValues(raw.points),
  };
}

/** Restrict to values that had been filed on or before `asOf` (point-in-time view). */
export function knownAt(quarters: QuarterValue[], asOf: string): QuarterValue[] {
  return quarters.filter((q) => q.filed <= asOf);
}

/** Value at a period end (exact match). */
export function valueAt(quarters: QuarterValue[], end: string): QuarterValue | undefined {
  return quarters.find((q) => q.end === end);
}

/** Latest instant on or before `end`, but no older than `maxAgeDays`. */
export function instantAsOf(quarters: QuarterValue[], end: string, maxAgeDays = 100): QuarterValue | undefined {
  let best: QuarterValue | undefined;
  for (const q of quarters) {
    if (q.end > end) break;
    if (days(q.end, end) <= maxAgeDays) best = q;
  }
  return best;
}

/**
 * Trailing-twelve-month sum ending at `end`: four consecutive quarters whose
 * span is roughly one year. Returns null when any quarter is missing.
 */
export function ttm(quarters: QuarterValue[], end: string): number | null {
  const index = quarters.findIndex((q) => q.end === end);
  if (index < 3) return null;
  const window = quarters.slice(index - 3, index + 1);
  const span = days(window[0].end, window[3].end);
  if (span < 250 || span > 300) return null;
  return window.reduce((s, q) => s + q.value, 0);
}

/** Calendar-quarter label for a period end ("Q3 2026"). All covered filers have December fiscal years. */
export function quarterLabel(end: string): string {
  const month = Number(end.slice(5, 7));
  // 52/53-week years can end in the first days of the next month.
  const day = Number(end.slice(8, 10));
  const adjusted = day <= 7 ? month - 1 || 12 : month;
  const year = day <= 7 && month === 1 ? Number(end.slice(0, 4)) - 1 : Number(end.slice(0, 4));
  return `Q${Math.ceil(adjusted / 3)} ${year}`;
}

// ── Debt composition ────────────────────────────────────────────────────────

export interface DebtComponent {
  concept: string;
  value: number;
  asOf: string;
}

export interface DebtComposition {
  total: number;
  components: DebtComponent[];
  notes: string[];
}

export type DebtInputs = Partial<
  Record<
    | "debtCombined"
    | "longTermDebt"
    | "longTermDebtNoncurrent"
    | "longTermDebtCurrent"
    | "convertibleDebt"
    | "financeLease"
    | "financeLeaseNoncurrent"
    | "shortTermBorrowings",
    MetricSeries
  >
>;

/**
 * Total financial debt at a balance-sheet date, built from named XBRL
 * components because filers tag debt differently. The rule is displayed with
 * the result:
 *   1. a combined short+long-term debt tag if filed, else
 *   2. LongTermDebt (which includes the current portion), else
 *   3. LongTermDebtNoncurrent + LongTermDebtCurrent;
 *   plus ConvertibleDebt when it is larger than step 1–3 (so it cannot already be inside),
 *   plus finance-lease liabilities (total, else non-current), plus short-term borrowings.
 * Operating leases are excluded throughout.
 */
export function composeDebt(inputs: DebtInputs, end: string): DebtComposition | null {
  const at = (key: keyof DebtInputs) => {
    const series = inputs[key];
    if (!series?.concept) return null;
    const q = instantAsOf(series.quarters, end);
    return q ? { concept: series.concept, value: q.value, asOf: q.end } : null;
  };
  const components: DebtComponent[] = [];
  const notes: string[] = [];
  const combined = at("debtCombined");
  const ltd = at("longTermDebt");
  const nonCurrent = at("longTermDebtNoncurrent");
  const current = at("longTermDebtCurrent");
  if (combined) {
    components.push(combined);
  } else if (ltd && ltd.value >= (nonCurrent?.value ?? 0)) {
    components.push(ltd);
  } else if (nonCurrent || current) {
    if (nonCurrent) components.push(nonCurrent);
    if (current) components.push(current);
    if (!current) notes.push("Current portion of long-term debt not tagged at this date.");
  }
  const core = components.reduce((s, c) => s + c.value, 0);
  const convertible = at("convertibleDebt");
  if (convertible && convertible.value > core) {
    components.push(convertible);
  }
  const lease = at("financeLease") ?? at("financeLeaseNoncurrent");
  if (lease) {
    components.push(lease);
    if (lease.concept.endsWith("Noncurrent")) notes.push("Only the non-current finance-lease liability is tagged; the current portion is excluded.");
  }
  const shortTerm = at("shortTermBorrowings");
  if (shortTerm) components.push(shortTerm);
  if (components.length === 0) return null;
  notes.push("Operating-lease liabilities are excluded from debt.");
  return { total: components.reduce((s, c) => s + c.value, 0), components, notes };
}
