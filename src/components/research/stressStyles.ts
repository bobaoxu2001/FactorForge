import type { StressTone } from "@/lib/quant/marketStress";

type Tone = StressTone | "positive";

/**
 * Shared muted accent palette for the stress-mode surfaces. Intentionally amber/
 * rose rather than flashy alarm-red, per the premium dark research-lab style.
 */
export const stressToneCard: Record<Tone, string> = {
  stress: "border-rose-600/30 bg-rose-400/[0.07] text-rose-800",
  caution: "border-amber-600/30 bg-amber-300/[0.06] text-amber-800",
  stable: "border-emerald-600/28 bg-emerald-500/[0.08] text-emerald-800",
  positive: "border-emerald-600/28 bg-emerald-500/[0.08] text-emerald-800",
};

export const stressToneDot: Record<Tone, string> = {
  stress: "bg-rose-600",
  caution: "bg-amber-600",
  stable: "bg-emerald-600",
  positive: "bg-emerald-600",
};

export const stressToneText: Record<Tone, string> = {
  stress: "text-rose-700",
  caution: "text-amber-700",
  stable: "text-emerald-700",
  positive: "text-emerald-700",
};
