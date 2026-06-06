import { confidenceBand } from "./hotspotStyles";

/** Compact 0–100 confidence meter with a band label. Research-only signal. */
export default function ConfidenceMeter({
  score,
  label = "Confidence",
  size = "md",
}: {
  score: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const band = confidenceBand(score);
  const pct = Math.max(4, Math.min(100, score));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={`${size === "sm" ? "text-[9.5px]" : "text-[10px]"} font-semibold uppercase tracking-[0.14em] text-ink-soft`}>
          {label}
        </span>
        <span className={`num ${size === "sm" ? "text-[12px]" : "text-[13px]"} font-semibold ${band.text}`}>
          {score}
          <span className="text-ink-soft">/100 · {band.label}</span>
        </span>
      </div>
      <div className={`mt-1.5 ${size === "sm" ? "h-1" : "h-1.5"} w-full overflow-hidden rounded-full bg-white/[0.06]`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${band.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
