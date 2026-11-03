"use client";

import type { QualityCheck } from "@/lib/intel/types";
import { useWorkspace } from "./useWorkspace";

const STATE_STYLE: Record<QualityCheck["state"], string> = {
  pass: "border-emerald-600/35 bg-emerald-500/10 text-emerald-700",
  warn: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  fail: "border-rose-600/40 bg-rose-400/10 text-rose-800",
};

/**
 * Research-quality checks. The server computes them from public data; this
 * client layer re-evaluates the primary-research check against the interviews
 * stored in the user's own browser (never sent to the server).
 */
export default function QualityPanel({ checks, projectId, compact = false }: { checks: QualityCheck[]; projectId: string; compact?: boolean }) {
  const { state, ready } = useWorkspace();
  const interviews = ready ? state.interviews.filter((i) => i.projectId === projectId).length : 0;
  const probabilitySets = ready ? Object.values(state.scenarioProbabilities).filter((p) => Object.values(p.probabilities).every((v) => v !== null)).length : 0;
  const adjusted = checks.map((c) => {
    if (c.id === "primary-research" && interviews > 0) {
      return { ...c, state: "warn" as const, detail: `${interviews} user-provided primary research record(s) in your workspace. Counts alone do not validate a thesis; corroboration and conflicting accounts still require review.` };
    }
    if (c.id === "valuation-assumptions" && probabilitySets > 0) {
      return { ...c, state: probabilitySets >= 3 ? ("pass" as const) : ("warn" as const), detail: `${probabilitySets} company scenario set(s) with justified probabilities in your workspace.` };
    }
    return c;
  });
  return (
    <ul className={`grid gap-2 ${compact ? "" : "md:grid-cols-2"}`}>
      {adjusted.map((c) => (
        <li key={c.id} className="rounded-md border border-line bg-ink/[0.025] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-ink">{c.label}</span>
            <span className={`chip ${STATE_STYLE[c.state]}`}>{c.state}</span>
          </div>
          {!compact && <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{c.detail}</p>}
        </li>
      ))}
    </ul>
  );
}
