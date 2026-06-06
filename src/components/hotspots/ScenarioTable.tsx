import type { HotspotScenario } from "@/lib/agents/types";
import { formatImpactRange } from "@/lib/agents/scenarioForecast";
import { pct } from "@/lib/utils/format";
import { SCENARIO_ACCENT } from "./hotspotStyles";

const CASE_LABEL: Record<"bull" | "base" | "bear", string> = { bull: "Bull case", base: "Base case", bear: "Bear case" };

/**
 * Bull/base/bear scenario forecast for a proxy basket. Every number is an
 * estimated proxy-basket impact range, not a price prediction.
 */
export default function ScenarioTable({ scenario, basketLabel = "proxy basket" }: { scenario: HotspotScenario; basketLabel?: string }) {
  return (
    <div>
      <div className="space-y-2">
        {scenario.legs.map((leg) => {
          const accent = SCENARIO_ACCENT[leg.case];
          return (
            <div
              key={leg.case}
              className={`rounded-xl border border-line border-l-2 ${accent.row} bg-white/[0.025] p-3.5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`chip ${accent.chip}`}>{CASE_LABEL[leg.case]}</span>
                  <span className="text-[12px] text-ink-muted">{leg.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`num text-[14px] font-semibold ${accent.text}`}>
                    {formatImpactRange(leg.impactLow, leg.impactHigh)}
                  </span>
                  <span className="num text-[11px] text-ink-soft">{Math.round(leg.probability * 100)}% wt</span>
                </div>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{leg.narrative}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-ink-soft">
        Estimated impact ranges apply to the {basketLabel}, not to any single name or private company. Weighted expected
        impact ≈ <span className="num text-ink-muted">{pct(scenario.expectedImpact)}</span>. Research-only — not a price
        prediction.
      </p>
    </div>
  );
}
