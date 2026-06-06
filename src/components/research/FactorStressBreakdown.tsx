import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { FactorStressGroup } from "@/lib/quant/marketStress";

const impactCls: Record<FactorStressGroup["stressImpact"], string> = {
  elevated: "border-rose-300/30 bg-rose-400/10 text-rose-100",
  moderate: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  low: "border-emerald-400/28 bg-emerald-500/10 text-emerald-100",
};

const directionIcon = {
  improving: ArrowUpRight,
  weakening: ArrowDownRight,
  stable: Minus,
} as const;

const directionCls = {
  improving: "text-emerald-300",
  weakening: "text-rose-300",
  stable: "text-ink-soft",
} as const;

/**
 * "Factor Breakdown Under Stress" — one card per factor group with current
 * condition, direction, stress impact, confidence, and an AI-style read.
 */
export default function FactorStressBreakdown({ groups }: { groups: FactorStressGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const Dir = directionIcon[group.direction];
        return (
          <div key={group.group} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-white">{group.group}</h3>
                <div className="num mt-1 text-[12px] text-ink-muted">{group.condition}</div>
              </div>
              <span className={`chip ${impactCls[group.stressImpact]}`}>{group.stressImpact} impact</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px]">
              <Dir className={`h-4 w-4 ${directionCls[group.direction]}`} />
              <span className={directionCls[group.direction]}>{group.direction}</span>
              <span className="ml-auto text-ink-soft">Confidence <span className="num text-ink">{group.confidence}</span></span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{group.interpretation}</p>
          </div>
        );
      })}
    </div>
  );
}
