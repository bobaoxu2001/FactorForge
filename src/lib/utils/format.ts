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

// Sign-aware tones for performance metrics. A metric that can be negative must
// never hardcode the gain color — route it through one of these so losses always
// render in the loss tone.

export const signedTone = (value: number): "default" | "positive" | "negative" =>
  isFiniteNumber(value) ? (value >= 0 ? "positive" : "negative") : "default";

export const signedText = (value: number) =>
  isFiniteNumber(value) ? (value >= 0 ? "text-emerald-300" : "text-rose-300") : "text-ink";
