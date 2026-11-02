import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import type { HotspotTheme } from "@/lib/agents/types";
import { formatImpactRange } from "@/lib/agents/scenarioForecast";
import SignalStrengthBar from "./SignalStrengthBar";
import ConfidenceMeter from "./ConfidenceMeter";
import ProxyBasket from "./ProxyBasket";
import { sentimentAccent, SCENARIO_ACCENT } from "./hotspotStyles";

const ASSET_LABEL: Record<HotspotTheme["assetType"], string> = {
  "private-market-catalyst": "Private-market catalyst",
  "public-proxy": "Public proxy basket",
  "macro-rotation": "Macro rotation",
};

/**
 * Featured-hotspot preview for the AI Market page ("Today's Hotspot").
 * Links through to the full /hotspots research surface.
 */
export default function HotspotPreview({ theme }: { theme: HotspotTheme }) {
  const accent = sentimentAccent(theme.sentiment);
  const isPrivate = theme.assetType === "private-market-catalyst";

  return (
    <section className="card relative overflow-hidden p-6 panel-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-accent/25 bg-accent/[0.07]">
            <Rocket className="h-5 w-5 text-accent" />
          </div>
          <div>
            <div className="lab-eyebrow">Today&rsquo;s Hotspot</div>
            <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-ink">{theme.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`chip ${isPrivate ? "border-amber-600/35 bg-amber-400/10 text-amber-800" : "border-accent/30 bg-accent/[0.08] text-accent"}`}>
                {ASSET_LABEL[theme.assetType]}
              </span>
              <span className={`chip ${accent.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                {theme.sentimentLabel}
              </span>
            </div>
          </div>
        </div>
        <Link href="/hotspots" className="inline-flex items-center gap-1 text-[12px] font-medium text-accent/90 transition-colors hover:text-accent">
          Open Market Hotspots <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-ink-muted">{theme.catalystSummary}</p>
          <div>
            <div className="text-[10px] font-semibold text-ink-soft">Scenario impact range (proxy basket)</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {theme.scenario.legs.map((leg) => {
                const a = SCENARIO_ACCENT[leg.case];
                return (
                  <div key={leg.case} className={`rounded-md border border-line border-l-2 ${a.row} bg-ink/[0.025] p-2.5`}>
                    <div className="text-[9.5px] font-semibold text-ink-soft">{leg.case}</div>
                    <div className={`num mt-1 text-[13px] font-semibold ${a.text}`}>{formatImpactRange(leg.impactLow, leg.impactHigh)}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <SignalStrengthBar value={theme.signalStrength} sentiment={theme.sentiment} />
        </div>

        <div className="space-y-4 rounded-lg border border-line bg-ink/[0.02] p-4">
          <ProxyBasket proxies={theme.proxies} coverage={theme.dataCoverage} title="Proxy basket" />
          <ConfidenceMeter score={theme.scenario.confidence} size="sm" />
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Estimated proxy-basket impact ranges from the demo catalyst engine. Research-only — not investment advice or a
            price prediction{isPrivate ? "; the underlying catalyst is a private company, expressed only via public proxies." : "."}
          </p>
        </div>
      </div>
    </section>
  );
}
