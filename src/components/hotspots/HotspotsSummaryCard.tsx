import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import type { HotspotAgentReport } from "@/lib/agents/types";
import { sentimentAccent } from "./hotspotStyles";

/** Compact top-themes hotspots card for the Overview dashboard. */
export default function HotspotsSummaryCard({ report }: { report: HotspotAgentReport }) {
  const top = report.themes.slice(0, 3);
  return (
    <section className="card relative flex flex-col overflow-hidden p-5 panel-glow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/[0.07]">
            <Flame className="h-5 w-5 text-amber-200" />
          </div>
          <div>
            <div className="section-label">Market Hotspots</div>
            <div className="mt-0.5 text-[11px] text-ink-soft">{report.regime.label} · stress {report.regime.stressScore}/100</div>
          </div>
        </div>
        <Link href="/hotspots" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-cyan-200/90 transition-colors hover:text-cyan-100">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {top.map((theme) => {
          const accent = sentimentAccent(theme.sentiment);
          const liveProxies = theme.proxies.filter((p) => p.live).slice(0, 3);
          const proxyChips = (liveProxies.length ? liveProxies : theme.proxies.slice(0, 3)).map((p) => p.symbol);
          return (
            <div key={theme.id} className="rounded-xl border border-line bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} />
                  <span className="truncate text-[12.5px] font-medium text-white">{theme.title}</span>
                </div>
                <span className={`num shrink-0 text-[12px] font-semibold ${accent.text}`}>{theme.signalStrength}</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`} style={{ width: `${Math.max(4, Math.min(100, theme.signalStrength))}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {proxyChips.map((s) => (
                    <span key={s} className="num rounded-md border border-line bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-ink-muted">{s}</span>
                  ))}
                </div>
                <span className="text-[10px] text-ink-soft">conf {theme.scenario.confidence}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-ink-soft">
        Themes from the demo catalyst engine — proxy baskets and estimated scenario ranges. Research-only.
      </p>
    </section>
  );
}
