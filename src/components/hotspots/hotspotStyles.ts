import type { SignalDirection } from "@/lib/agents/types";

/** Muted, research-lab accent families — never alarm-red or neon. */
export interface AccentTheme {
  text: string;
  chip: string;
  bar: string;
  dot: string;
  glow: string;
}

export const SENTIMENT_ACCENT: Record<SignalDirection, AccentTheme> = {
  "risk-on": {
    text: "text-emerald-200",
    chip: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
    bar: "from-emerald-400 to-cyan-400",
    dot: "bg-emerald-300",
    glow: "rgba(52,211,153,0.5)",
  },
  "risk-off": {
    text: "text-rose-200",
    chip: "border-rose-300/35 bg-rose-400/10 text-rose-100",
    bar: "from-rose-400 to-amber-400",
    dot: "bg-rose-300",
    glow: "rgba(251,113,133,0.45)",
  },
  rotational: {
    text: "text-amber-100",
    chip: "border-amber-300/35 bg-amber-400/10 text-amber-100",
    bar: "from-amber-400 to-amber-300",
    dot: "bg-amber-300",
    glow: "rgba(251,191,36,0.4)",
  },
  neutral: {
    text: "text-cyan-100",
    chip: "border-cyan-300/30 bg-cyan-400/[0.08] text-cyan-100",
    bar: "from-cyan-400 to-blue-400",
    dot: "bg-cyan-300",
    glow: "rgba(34,211,238,0.4)",
  },
};

export function sentimentAccent(sentiment: SignalDirection): AccentTheme {
  return SENTIMENT_ACCENT[sentiment] ?? SENTIMENT_ACCENT.neutral;
}

/** Confidence band → label + accent for the meter. */
export function confidenceBand(score: number): { label: string; bar: string; text: string } {
  if (score >= 65) return { label: "Higher", bar: "from-emerald-400 to-cyan-400", text: "text-emerald-200" };
  if (score >= 45) return { label: "Moderate", bar: "from-cyan-400 to-blue-400", text: "text-cyan-100" };
  return { label: "Lower", bar: "from-amber-400 to-amber-300", text: "text-amber-100" };
}

export const SCENARIO_ACCENT: Record<"bull" | "base" | "bear", { text: string; chip: string; row: string }> = {
  bull: { text: "text-emerald-200", chip: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200", row: "border-l-emerald-400/60" },
  base: { text: "text-cyan-100", chip: "border-cyan-300/30 bg-cyan-400/[0.08] text-cyan-100", row: "border-l-cyan-400/50" },
  bear: { text: "text-rose-200", chip: "border-rose-300/35 bg-rose-400/10 text-rose-100", row: "border-l-rose-400/60" },
};
