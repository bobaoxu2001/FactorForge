import { AlertTriangle } from "lucide-react";
import type { HotspotTheme } from "@/lib/agents/types";
import { formatImpact } from "@/lib/agents/scenarioForecast";
import SignalStrengthBar from "./SignalStrengthBar";
import ConfidenceMeter from "./ConfidenceMeter";
import ProxyBasket from "./ProxyBasket";
import { sentimentAccent } from "./hotspotStyles";

const ASSET_LABEL: Record<HotspotTheme["assetType"], string> = {
  "private-market-catalyst": "Private-market catalyst",
  "public-proxy": "Public proxy basket",
  "macro-rotation": "Macro rotation",
};

/** Compact theme card for the Trending Themes grid. */
export default function HotspotThemeCard({ theme }: { theme: HotspotTheme }) {
  const accent = sentimentAccent(theme.sentiment);
  const bull = theme.scenario.legs.find((l) => l.case === "bull");
  const bear = theme.scenario.legs.find((l) => l.case === "bear");

  return (
    <article className="card card-hover panel-glow relative flex flex-col overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip ${accent.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
              {theme.sentimentLabel}
            </span>
            <span className="chip border-line bg-white/[0.04] text-ink-soft">{ASSET_LABEL[theme.assetType]}</span>
          </div>
          <h3 className="mt-2.5 text-[16px] font-semibold tracking-tight text-white">{theme.title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{theme.tagline}</p>
        </div>
      </div>

      <div className="mt-4">
        <SignalStrengthBar value={theme.signalStrength} sentiment={theme.sentiment} />
      </div>

      <div className="mt-4">
        <ProxyBasket proxies={theme.proxies} coverage={theme.dataCoverage} title="Proxy basket" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="stat-tile !p-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Scenario span</div>
          <div className="num mt-1 text-[13px] font-semibold text-white">
            {bear ? formatImpact(bear.impactLow) : "—"}
            <span className="text-ink-soft"> … </span>
            {bull ? formatImpact(bull.impactHigh) : "—"}
          </div>
        </div>
        <div className="stat-tile !p-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Catalyst sens.</div>
          <div className="num mt-1 text-[13px] font-semibold text-white">{theme.scenario.catalystSensitivity}/100</div>
        </div>
      </div>

      <div className="mt-4">
        <ConfidenceMeter score={theme.scenario.confidence} size="sm" />
      </div>

      {theme.riskFlags[0] && (
        <div className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-soft">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
          <span>{theme.riskFlags[0]}</span>
        </div>
      )}
    </article>
  );
}
