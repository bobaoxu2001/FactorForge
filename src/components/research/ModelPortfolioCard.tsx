import MetricCard from "@/components/cards/MetricCard";
import StatusBadge from "@/components/badges/StatusBadge";
import ModelPortfolioChart from "@/components/charts/ModelPortfolioChart";
import {
  buildModelPortfolioHeadline,
  formatLongDate,
  type ModelPortfolioConstituent,
  type ModelPortfolioPerformance,
} from "@/lib/quant/modelPortfolio";
import { pct, pctPlain, num } from "@/lib/utils/format";

/**
 * Width (4–100%) for a constituent's contribution bar, scaled by the largest
 * absolute return in the blend so a +2% leg and a +40% leg read proportionally.
 * Pure/deterministic — magnitude only; the sign drives the colour upstream.
 */
function contributionBarWidth(returnSinceStart: number, constituents: ModelPortfolioConstituent[]): number {
  const maxAbs = constituents.reduce((max, constituent) => Math.max(max, Math.abs(constituent.returnSinceStart)), 0);
  if (maxAbs === 0) return 4;
  return Math.max(4, Math.min(100, (Math.abs(returnSinceStart) / maxAbs) * 100));
}

type Variant = "feature" | "compact" | "report";

interface Props {
  data: ModelPortfolioPerformance;
  eyebrow: string;
  title: string;
  /** Optional extra context line under the title (e.g. paper-observation framing). */
  framing?: string;
  variant?: Variant;
  chartHeight?: number;
}

/**
 * Shared "Since May" Model Portfolio Performance module.
 *
 * Always framed as a SIMULATED research portfolio (not a real-money account).
 * `feature`  — full card with chart + every metric (overview, paper desk).
 * `compact`  — small summary (return / drawdown / Sharpe / excess), no chart.
 * `report`   — full card with the disclosure list rendered out (reports page).
 */
export default function ModelPortfolioCard({
  data,
  eyebrow,
  title,
  framing,
  variant = "feature",
  chartHeight = 300,
}: Props) {
  if (!data.available) {
    return (
      <section className="card p-5">
        <div className="section-label">{eyebrow}</div>
        <h2 className="mt-1.5 text-[18px] font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {data.notes[0] ??
            "A simulated model portfolio could not be built from the available historical data for this period."}
        </p>
      </section>
    );
  }

  const spy = data.benchmarks.find((benchmark) => benchmark.symbol === "SPY");
  const qqq = data.benchmarks.find((benchmark) => benchmark.symbol === "QQQ");
  const returnTone = data.totalReturn >= 0 ? "positive" : "negative";
  const excessTone = data.excessReturn >= 0 ? "positive" : "negative";

  if (variant === "compact") {
    return (
      <section className="card relative overflow-hidden p-5 panel-glow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="section-label">{eyebrow}</div>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-white">{title}</h2>
            <p className="mt-1 text-[12px] text-ink-soft">
              {formatLongDate(data.startDate)} → {formatLongDate(data.endDate)} · {data.strategyCount} strategies · simulated research
            </p>
          </div>
          <StatusBadge status="simulated research" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Return since May" value={pct(data.totalReturn)} tone={returnTone} />
          <MetricCard label="Max drawdown" value={pct(data.maxDrawdown)} tone="negative" />
          <MetricCard label="Sharpe" value={num(data.sharpe)} />
          <MetricCard
            label={`Excess vs ${data.primaryBenchmarkSymbol ?? "benchmark"}`}
            value={pct(data.excessReturn)}
            tone={excessTone}
            hint={data.primaryBenchmarkSymbol ? `${data.primaryBenchmarkSymbol} ${pct(data.benchmarkReturn)}` : undefined}
          />
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-soft">
          Equal-weighted blend of top-ranked research strategies, normalized on the start date. Not a real-money account.
          Historical performance does not indicate future results.
        </p>
      </section>
    );
  }

  return (
    <section className="card relative overflow-hidden p-5 panel-glow md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="section-label">{eyebrow}</div>
          <h2 className="mt-1.5 text-[20px] font-semibold tracking-tight text-white md:text-[22px]">{title}</h2>
          <p className="mt-1.5 text-[12px] text-ink-soft">
            {formatLongDate(data.startDate)} → {formatLongDate(data.endDate)} · {data.tradingDays} trading days · {data.strategyCount} active strategies
          </p>
          {framing && <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">{framing}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <StatusBadge status="simulated research" />
            <StatusBadge status="research-only" />
            <StatusBadge status={data.dataQuality.isFallback ? "fallback labeled" : "real data"} />
          </div>
          <div className="text-[10.5px] text-ink-soft">
            Updated {new Date(data.lastUpdated).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.05] p-3.5 text-[13px] leading-relaxed text-emerald-50/90">
        {buildModelPortfolioHeadline(data)}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <ModelPortfolioChart data={data} height={chartHeight} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
          <MetricCard label="Total return since May" value={pct(data.totalReturn)} tone={returnTone} hint="model portfolio" />
          <MetricCard label="Annualized" value={pct(data.annualizedReturn)} tone={data.annualizedReturn >= 0 ? "positive" : "negative"} hint="short-window extrapolation" />
          <MetricCard label="Max drawdown" value={pct(data.maxDrawdown)} tone="negative" />
          <MetricCard label="Current drawdown" value={pct(data.currentDrawdown)} tone={data.currentDrawdown < 0 ? "negative" : "default"} />
          <MetricCard label="Sharpe" value={num(data.sharpe)} hint="annualized, since May" />
          <MetricCard label="Win rate" value={data.winRate === null ? "—" : pctPlain(data.winRate)} hint="share of positive days" />
          <MetricCard
            label="SPY benchmark"
            value={spy ? pct(spy.totalReturn) : "—"}
            tone={spy ? (spy.totalReturn >= 0 ? "positive" : "negative") : "default"}
            hint="same period"
          />
          <MetricCard
            label="QQQ benchmark"
            value={qqq ? pct(qqq.totalReturn) : "—"}
            tone={qqq ? (qqq.totalReturn >= 0 ? "positive" : "negative") : "default"}
            hint={qqq ? "same period" : "not available"}
          />
          <MetricCard
            label={`Excess vs ${data.primaryBenchmarkSymbol ?? "benchmark"}`}
            value={pct(data.excessReturn)}
            tone={excessTone}
          />
          <MetricCard label="Active strategies" value={String(data.strategyCount)} hint="equal-weighted" />
          <MetricCard label="Start date" value={data.startDate} hint={data.startAdjusted ? "first session after May 1" : "May 1"} />
          <MetricCard label="Latest data date" value={data.endDate} hint={data.dataQuality.isFallback ? "fallback labeled" : "real market data"} />
        </div>
      </div>

      {data.constituents.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-white/[0.025] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">
              Constituent contribution · since {data.startDate}
            </div>
            <div className="text-[11px] text-ink-soft">{data.strategyCount} equal-weighted · normalized to 1.00</div>
          </div>
          <div className="mt-3 space-y-2">
            {[...data.constituents]
              .sort((a, b) => b.returnSinceStart - a.returnSinceStart)
              .map((constituent) => (
                <div key={`${constituent.strategyId}-${constituent.symbol}`} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{constituent.strategyName}</div>
                    <div className="text-[10.5px] text-ink-soft">{constituent.symbol}</div>
                  </div>
                  <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white/[0.06] sm:w-32">
                    <div
                      className={`h-full rounded-full ${constituent.returnSinceStart >= 0 ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-gradient-to-r from-rose-400 to-amber-300"}`}
                      style={{ width: `${contributionBarWidth(constituent.returnSinceStart, data.constituents)}%` }}
                    />
                  </div>
                  <div className={`num w-16 shrink-0 text-right text-[12.5px] font-semibold ${constituent.returnSinceStart >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {pct(constituent.returnSinceStart)}
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
            Each leg&rsquo;s own return over the same window. The blended portfolio return above is the equal-weight average
            of these legs — individual contributions are not a real-money allocation.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-line bg-white/[0.025] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">Data source · {data.dataQuality.label}</div>
          {data.dataQuality.sources.length > 0 && (
            <div className="text-[11px] text-ink-soft">{data.dataQuality.sources.join(" · ")}</div>
          )}
        </div>
        {variant === "report" ? (
          <ul className="mt-3 space-y-1.5">
            {data.notes.map((note) => (
              <li key={note} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/60" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
            {data.notes.slice(0, 3).join(" ")}
          </p>
        )}
      </div>
    </section>
  );
}
