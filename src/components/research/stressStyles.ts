import type { StressTone } from "@/lib/quant/marketStress";

type Tone = StressTone | "positive";

/**
 * Shared muted accent palette for the stress-mode surfaces. Intentionally amber/
 * rose rather than flashy alarm-red, per the premium dark research-lab style.
 */
export const stressToneCard: Record<Tone, string> = {
  stress: "border-rose-300/30 bg-rose-400/[0.07] text-rose-100",
  caution: "border-amber-300/30 bg-amber-300/[0.06] text-amber-100",
  stable: "border-emerald-400/28 bg-emerald-500/[0.08] text-emerald-100",
  positive: "border-emerald-400/28 bg-emerald-500/[0.08] text-emerald-100",
};

export const stressToneDot: Record<Tone, string> = {
  stress: "bg-rose-300 shadow-[0_0_12px_rgba(251,113,133,0.7)]",
  caution: "bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]",
  stable: "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.7)]",
  positive: "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.7)]",
};

export const stressToneText: Record<Tone, string> = {
  stress: "text-rose-200",
  caution: "text-amber-200",
  stable: "text-emerald-200",
  positive: "text-emerald-200",
};
