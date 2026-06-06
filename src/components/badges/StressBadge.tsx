/**
 * Compact stress-mode badge. Recognizes the canonical stress labels
 * ("Resilient", "Watch", "Under Stress", "High Drawdown Risk", "Fallback Data
 * Active") and maps each to a muted accent — amber/rose, never alarm-red.
 */
export default function StressBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const cls =
    normalized.includes("under stress") || normalized.includes("high drawdown")
      ? "border-rose-300/35 bg-rose-400/10 text-rose-100"
      : normalized.includes("watch") || normalized.includes("fallback")
        ? "border-amber-300/35 bg-amber-400/10 text-amber-100"
        : normalized.includes("resilient") || normalized.includes("stable")
          ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-200"
          : "border-blue-300/30 bg-blue-400/10 text-blue-100";
  return <span className={`chip ${cls}`}>{label}</span>;
}
