import { BrainCircuit, Database, LineChart, Network, Target } from "lucide-react";
import StatusBadge from "@/components/badges/StatusBadge";
import MetricCard from "@/components/cards/MetricCard";
import { getResearchDataset } from "@/lib/research";
import { pct, num } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function FactorsPage() {
  const { factors } = await getResearchDataset();
  const avgMomentum = factors.reduce((sum, factor) => sum + (factor.momentum60d ?? 0), 0) / Math.max(factors.length, 1);
  const avgVol = factors.reduce((sum, factor) => sum + (factor.volatility20d ?? 0), 0) / Math.max(factors.length, 1);
  const trendCount = factors.filter((factor) => factor.aboveSma200).length;
  const strengthScore = Math.round(Math.min(100, Math.max(0, 50 + avgMomentum * 220 + (trendCount / Math.max(factors.length, 1)) * 35 - avgVol * 25)));
  const factorGroups = [
    { title: "Momentum Factors", detail: "20d and 60d close-to-close momentum identify persistent relative strength.", Icon: LineChart },
    { title: "Volatility Factors", detail: "Annualized realized volatility helps separate expansion regimes from defensive setups.", Icon: Target },
    { title: "Liquidity / Volume Factors", detail: "Volume surge compares current participation against the 20-day baseline.", Icon: Database },
    { title: "Trend Factors", detail: "SMA200 status provides a long-horizon regime and risk filter.", Icon: Network },
    { title: "Quality / Proxy Factors", detail: "Quality is represented by stable trend, controlled volatility, and participation health.", Icon: BrainCircuit },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="section-label">L1 Factors</div>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">Factor Discovery Console</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          FactorForge converts daily OHLCV into interpretable momentum, volatility, trend, and liquidity evidence. Fallback symbols remain visible and explicitly labeled.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Factor strength" value={String(strengthScore)} tone="accent" hint="Composite watchlist score" />
        <MetricCard label="Trend breadth" value={`${trendCount}/${factors.length}`} hint="Above SMA200" />
        <MetricCard label="Avg 60d momentum" value={pct(avgMomentum)} tone={avgMomentum >= 0 ? "positive" : "negative"} />
        <MetricCard label="Avg 20d volatility" value={pct(avgVol)} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {factorGroups.map(({ title, detail, Icon }) => (
          <div key={title} className="card p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
              <Icon className="h-5 w-5 text-cyan-200" />
            </div>
            <h2 className="mt-4 text-[15px] font-semibold text-white">{title}</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="card p-5">
          <div className="panel-title">AI-Generated Factor Hypotheses</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              "Momentum leadership is concentrated in liquid mega-cap technology and should be tested against breadth deterioration.",
              "Volatility remains controlled enough for continuation rules, but crowding risk rises when volume confirmation weakens.",
              "Trend factors are best used as admission gates before ranking strategy candidates by drawdown and Sharpe.",
            ].map((hypothesis, index) => (
              <div key={hypothesis} className="rounded-2xl border border-line bg-white/[0.035] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">Hypothesis {index + 1}</div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{hypothesis}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="panel-title">Factor Correlation Mini Panel</div>
          <div className="mt-4 space-y-3">
            {[
              ["Momentum / Trend", 0.72, "High"],
              ["Volatility / Drawdown", 0.58, "Medium"],
              ["Volume / Breakout", 0.44, "Medium"],
              ["Low Vol / Rotation", 0.31, "Low"],
            ].map(([label, value, regime]) => (
              <div key={String(label)}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-ink-muted">{label}</span>
                  <span className="num text-white">{num(Number(value))} · {regime}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-blue-400" style={{ width: `${Number(value) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <StatusBadge status={avgVol > 0.35 ? "crowding watch" : "balanced regime"} />
        </div>
      </section>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Mom 20d</th>
              <th className="px-4 py-3 text-right">Mom 60d</th>
              <th className="px-4 py-3 text-right">Vol 20d</th>
              <th className="px-4 py-3 text-right">Volume surge</th>
              <th className="px-4 py-3 text-right">RSI</th>
              <th className="px-4 py-3 text-left">Trend</th>
              <th className="px-4 py-3 text-left">Basis</th>
            </tr>
          </thead>
          <tbody className="divide-soft">
            {factors.map((factor) => (
              <tr key={factor.symbol} className="table-row">
                <td className="px-4 py-3 font-semibold text-ink">{factor.symbol}</td>
                <td className="num px-4 py-3 text-right">{factor.momentum20d === null ? "n/a" : pct(factor.momentum20d)}</td>
                <td className="num px-4 py-3 text-right">{factor.momentum60d === null ? "n/a" : pct(factor.momentum60d)}</td>
                <td className="num px-4 py-3 text-right">{factor.volatility20d === null ? "n/a" : pct(factor.volatility20d)}</td>
                <td className="num px-4 py-3 text-right">{factor.volumeSurge === null ? "n/a" : `${num(factor.volumeSurge)}x`}</td>
                <td className="num px-4 py-3 text-right">{factor.rsi14 === null ? "n/a" : num(factor.rsi14, 1)}</td>
                <td className="px-4 py-3"><StatusBadge status={factor.aboveSma200 ? "above SMA200" : "below SMA200"} /></td>
                <td className="px-4 py-3"><StatusBadge status={factor.adjusted ? "adjusted" : "raw/demo"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
