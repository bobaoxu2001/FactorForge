import type { SignalDirection } from "@/lib/agents/types";
import { sentimentAccent } from "./hotspotStyles";

/** Theme signal-strength bar, colored by sentiment direction. */
export default function SignalStrengthBar({
  value,
  sentiment,
  label = "Signal strength",
}: {
  value: number;
  sentiment: SignalDirection;
  label?: string;
}) {
  const accent = sentimentAccent(sentiment);
  const pct = Math.max(4, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</span>
        <span className={`num text-[13px] font-semibold ${accent.text}`}>{value}/100</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 12px ${accent.glow}` }}
        />
      </div>
    </div>
  );
}
