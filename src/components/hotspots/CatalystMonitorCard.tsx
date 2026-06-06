import { Rocket, ShieldAlert, FlaskConical, Clock } from "lucide-react";
import Link from "next/link";
import type { HotspotTheme } from "@/lib/agents/types";
import SignalStrengthBar from "./SignalStrengthBar";
import ConfidenceMeter from "./ConfidenceMeter";
import ProxyBasket from "./ProxyBasket";
import ScenarioTable from "./ScenarioTable";
import { sentimentAccent } from "./hotspotStyles";

const ASSET_LABEL: Record<HotspotTheme["assetType"], string> = {
  "private-market-catalyst": "Private-market catalyst",
  "public-proxy": "Public proxy basket",
  "macro-rotation": "Macro rotation",
};

/**
 * Featured catalyst monitor (e.g. SpaceX / Space Economy). Emphasizes the
 * private-market labeling: when assetType is a private-market catalyst, the
 * card opens with an explicit "not directly tradable" note and frames all
 * scenario output as proxy-basket impact ranges.
 */
export default function CatalystMonitorCard({ theme }: { theme: HotspotTheme }) {
  const accent = sentimentAccent(theme.sentiment);
  const isPrivate = theme.assetType === "private-market-catalyst";

  return (
    <section className="hero-showcase relative overflow-hidden p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-white/[0.05] shadow-[0_0_30px_rgba(34,211,238,0.16)]">
            <Rocket className="h-6 w-6 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <div className="lab-eyebrow">Catalyst Monitor</div>
            <h2 className="mt-1.5 text-[24px] font-semibold tracking-tight text-white md:text-[28px]">{theme.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`chip ${isPrivate ? "border-amber-300/35 bg-amber-400/10 text-amber-100" : "border-cyan-300/30 bg-cyan-400/[0.08] text-cyan-100"}`}>
                {ASSET_LABEL[theme.assetType]}
              </span>
              <span className={`chip ${accent.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                {theme.sentimentLabel}
              </span>
              <span className="chip border-line bg-white/[0.04] text-ink-soft">Research-only</span>
            </div>
          </div>
        </div>
        <div className="w-full max-w-[300px] shrink-0 space-y-3 sm:w-[280px]">
          <SignalStrengthBar value={theme.signalStrength} sentiment={theme.sentiment} />
          <ConfidenceMeter score={theme.scenario.confidence} size="sm" />
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Catalyst sensitivity</span>
            <span className="num text-[13px] font-semibold text-cyan-100">{theme.scenario.catalystSensitivity}/100</span>
          </div>
        </div>
      </div>

      {isPrivate && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            <span className="font-medium text-amber-100">Private company — not directly tradable. </span>
            {theme.assetTypeNote}
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
        {/* Left: catalysts + scenario */}
        <div className="space-y-6">
          <div>
            <div className="section-label">Catalyst summary</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">{theme.catalystSummary}</p>
          </div>

          <div>
            <div className="section-label">Catalyst drivers</div>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {theme.catalysts.map((c) => (
                <div key={c.label} className="rounded-xl border border-line bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-white">{c.label}</span>
                    <span className="num text-[10px] text-ink-soft">{Math.round(c.sensitivity * 100)}%</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{c.detail}</p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" style={{ width: `${Math.round(c.sensitivity * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-label">Scenario forecast</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
              Estimated impact range for the public-market proxy basket under each scenario.
            </p>
            <div className="mt-3">
              <ScenarioTable scenario={theme.scenario} basketLabel={`${theme.title} proxy basket`} />
            </div>
          </div>
        </div>

        {/* Right: proxy basket, risks, strategy relevance, freshness */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <ProxyBasket proxies={theme.proxies} coverage={theme.dataCoverage} />
          </div>

          <div>
            <div className="section-label">Risk flags</div>
            <ul className="mt-2 space-y-1.5">
              {theme.riskFlags.map((flag) => (
                <li key={flag} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-300/70" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>

          {theme.strategyRelevance.length > 0 && (
            <div>
              <div className="section-label">Strategy relevance</div>
              <div className="mt-2 space-y-1.5">
                {theme.strategyRelevance.map((s) => (
                  <Link
                    key={s.strategyId}
                    href={`/strategies/${s.strategyId}`}
                    className="block rounded-xl border border-line bg-white/[0.025] p-2.5 text-[12px] text-ink-muted transition-colors hover:border-cyan-300/30 hover:text-ink"
                  >
                    <span className="font-medium text-white">{s.strategyName}</span> — {s.note}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200/80" />
              <span>
                <span className="font-medium text-white">Suggested next research test. </span>
                {theme.suggestedResearchTest}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[11px] text-ink-soft">
              <Clock className="h-3.5 w-3.5" />
              Updated {new Date(theme.lastUpdated).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {theme.dataCoverage.usesFallback ? "includes labeled fallback rows" : "real market data"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
