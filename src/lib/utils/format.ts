// Placeholder shown when a value is NaN/Infinity/null/undefined, so degenerate
// upstream data renders as an honest dash rather than "NaN%" or a thrown error.
const DASH = "—";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const pct = (value: number, digits = 1) =>
  isFiniteNumber(value) ? `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%` : DASH;

export const pctPlain = (value: number, digits = 1) =>
  isFiniteNumber(value) ? `${(value * 100).toFixed(digits)}%` : DASH;

export const num = (value: number, digits = 2) =>
  isFiniteNumber(value)
    ? value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;

export const usd = (value: number) =>
  isFiniteNumber(value)
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : DASH;

export const compact = (value: number) =>
  isFiniteNumber(value)
    ? Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : DASH;
