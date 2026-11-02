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
    text: "text-emerald-700",
    chip: "border-emerald-600/35 bg-emerald-500/12 text-emerald-700",
    bar: "from-emerald-400 to-accent",
    dot: "bg-emerald-600",
    glow: "rgba(23,121,74,0.5)",
  },
  "risk-off": {
    text: "text-rose-700",
    chip: "border-rose-600/35 bg-rose-400/10 text-rose-800",
    bar: "from-rose-400 to-amber-400",
    dot: "bg-rose-600",
    glow: "rgba(180,35,24,0.45)",
  },
  rotational: {
    text: "text-amber-800",
    chip: "border-amber-600/35 bg-amber-400/10 text-amber-800",
    bar: "from-amber-400 to-amber-300",
    dot: "bg-amber-600",
    glow: "rgba(161,92,7,0.4)",
  },
  neutral: {
    text: "text-accent",
    chip: "border-accent/30 bg-accent/[0.08] text-accent",
    bar: "from-accent to-accent",
    dot: "bg-accent",
    glow: "rgba(29,79,145,0.4)",
  },
};

export function sentimentAccent(sentiment: SignalDirection): AccentTheme {
  return SENTIMENT_ACCENT[sentiment] ?? SENTIMENT_ACCENT.neutral;
}

/** Confidence band → label + accent for the meter. */
/**
 * Scenario weights are configured priors nudged by the regime, so they are shown
 * to the nearest 5% with a "~" rather than to a false single-percent precision.
 */
export function formatPrior(probability: number): string {
  return `~${Math.round(probability * 20) * 5}%`;
}

/** Heuristic score explained in tooltips wherever only its band is shown. */
export const CONFIDENCE_HEURISTIC_NOTE =
  "Heuristic, not a statistical confidence: a configured base adjusted for proxy coverage in the universe and regime clarity.";

export function confidenceBand(score: number): { label: string; bar: string; text: string } {
  if (score >= 65) return { label: "Higher", bar: "from-emerald-400 to-accent", text: "text-emerald-700" };
  if (score >= 45) return { label: "Moderate", bar: "from-accent to-accent", text: "text-accent" };
  return { label: "Lower", bar: "from-amber-400 to-amber-300", text: "text-amber-800" };
}

export const SCENARIO_ACCENT: Record<"bull" | "base" | "bear", { text: string; chip: string; row: string }> = {
  bull: { text: "text-emerald-700", chip: "border-emerald-600/35 bg-emerald-500/12 text-emerald-700", row: "border-l-emerald-400/60" },
  base: { text: "text-accent", chip: "border-accent/30 bg-accent/[0.08] text-accent", row: "border-l-cyan-400/50" },
  bear: { text: "text-rose-700", chip: "border-rose-600/35 bg-rose-400/10 text-rose-800", row: "border-l-rose-400/60" },
};
