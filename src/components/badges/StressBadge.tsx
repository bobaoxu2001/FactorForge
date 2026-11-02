/**
 * Compact stress-mode badge. Recognizes the canonical stress labels
 * ("Resilient", "Watch", "Under Stress", "High Drawdown Risk", "Fallback Data
 * Active") and maps each to a muted accent — amber/rose, never alarm-red.
 */
export default function StressBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const cls =
    normalized.includes("under stress") || normalized.includes("high drawdown")
      ? "border-rose-600/35 bg-rose-400/10 text-rose-800"
      : normalized.includes("watch") || normalized.includes("fallback")
        ? "border-amber-600/35 bg-amber-400/10 text-amber-800"
        : normalized.includes("resilient") || normalized.includes("stable")
          ? "border-emerald-600/30 bg-emerald-500/12 text-emerald-700"
          : "border-accent/30 bg-accent/10 text-accent";
  return <span className={`chip ${cls}`}>{label}</span>;
}
