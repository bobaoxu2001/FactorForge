import { CONFIDENCE_HEURISTIC_NOTE, confidenceBand } from "./hotspotStyles";

/**
 * Confidence meter showing only the band (Lower / Moderate / Higher): the 0–100
 * input is a configured heuristic, so its exact value stays in the tooltip.
 */
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
    <div title={`${CONFIDENCE_HEURISTIC_NOTE} Score ${score}/100.`}>
      <div className="flex items-center justify-between">
        <span className={`${size === "sm" ? "text-[9.5px]" : "text-[10px]"} font-semibold text-ink-soft`}>
          {label}
        </span>
        <span className={`num ${size === "sm" ? "text-[12px]" : "text-[13px]"} font-semibold ${band.text}`}>
          {band.label}
          <span className="font-normal text-ink-soft"> · heuristic</span>
        </span>
      </div>
      <div className={`mt-1.5 ${size === "sm" ? "h-1" : "h-1.5"} w-full overflow-hidden rounded-full bg-ink/[0.06]`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${band.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
