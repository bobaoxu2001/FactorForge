import { Activity, ShieldAlert, TrendingDown, Waves } from "lucide-react";
import type { MarketStressReport } from "@/lib/quant/marketStress";
import { stressToneCard, stressToneDot } from "./stressStyles";
import { pct, pctPlain } from "@/lib/utils/format";

/**
 * Elegant, muted market-regime banner shown on the Overview and AI Market pages.
 * Surfaces the live regime, volatility/breadth/momentum states, last-updated
 * timestamp, and data provenance. Research only — never a trade instruction.
 */
export default function MarketRegimeBanner({ report }: { report: MarketStressReport }) {
  const Icon = report.tone === "stress" ? ShieldAlert : report.tone === "caution" ? Waves : Activity;
  const updated = report.updatedAt.slice(0, 16).replace("T", " ");
  const dataLabel =
    report.dataQuality === "real" ? "Real market data" :
    report.dataQuality === "mixed" ? `Mixed · ${report.fallbackCount} fallback labeled` : "Fallback / demo data";

  return (
    <section className={`relative overflow-hidden rounded-2xl border p-5 ${stressToneCard[report.tone]}`}>
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-current/[0.05] to-transparent" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-current/25 bg-current/[0.06]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${stressToneDot[report.tone]}`} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] opacity-80">Market Regime Monitor</span>
              {report.isPreview && (
                <span className="chip border-amber-300/40 bg-amber-400/15 text-amber-100">Illustrative preview · not live data</span>
              )}
            </div>
            <h2 className="mt-1 text-[19px] font-semibold tracking-tight text-white">{report.regimeLabel}</h2>
            <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">{report.headline}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">Stress score</div>
          <div className="num text-[30px] font-semibold leading-none text-white">{report.stressScore}<span className="text-[14px] opacity-60">/100</span></div>
          <div className="mt-1 text-[10.5px] uppercase tracking-[0.14em] opacity-70">{report.regime}</div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StateTile icon={Waves} label="Volatility" value={titleCase(report.volatilityState)} detail={`${pctPlain(report.avgVolatility20d)} ann. · ${report.volExpansion >= 1 ? "+" : ""}${((report.volExpansion - 1) * 100).toFixed(0)}% vs 60d`} />
        <StateTile icon={Activity} label="Breadth" value={titleCase(report.breadthState)} detail={`${report.aboveTrend}/${report.symbolCount} above SMA200`} />
        <StateTile icon={TrendingDown} label="Momentum" value={titleCase(report.momentumState)} detail={`${pct(report.avgMomentum20d)} avg 20d`} />
        <StateTile icon={ShieldAlert} label="Liquidity" value={titleCase(report.liquidityState)} detail={`${Math.round(report.declinerShare * 100)}% lower today`} />
      </div>

      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-soft">
        <span>{report.isPreview ? "Illustrative stressed regime · not live market data · " : `Updated ${updated} · As of ${report.asOf ?? "—"} · ${dataLabel}`}</span>
        <span className="opacity-80">Strategy performance should be interpreted under the current regime. Research only — not investment advice.</span>
      </div>
    </section>
  );
}

function StateTile({
  icon: Icon, label, value, detail,
}: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-[14px] font-semibold text-white">{value}</div>
      <div className="num mt-0.5 text-[11px] text-ink-muted">{detail}</div>
    </div>
  );
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
}
