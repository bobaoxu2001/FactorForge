"use client";

import { useMemo, useState } from "react";
import { leadLag } from "@/lib/intel/series";
import { LagBars } from "./charts";

export interface YoySeries {
  id: string;
  name: string;
  seasonalAdjustment: string;
  frequency: string;
  points: Array<{ date: string; value: number | null }>;
}

/** Pick any two KPIs and scan YoY correlation at 0–12 month lags, with the caveats attached. */
export default function LeadLagExplorer({ series, defaultLeader, defaultFollower }: { series: YoySeries[]; defaultLeader: string; defaultFollower: string }) {
  const [leader, setLeader] = useState(defaultLeader);
  const [follower, setFollower] = useState(defaultFollower);
  const a = series.find((s) => s.id === leader);
  const b = series.find((s) => s.id === follower);
  const result = useMemo(() => (a && b && a.id !== b.id ? leadLag(a.points, b.points, 12) : null), [a, b]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="text-ink-soft" htmlFor="ll-leader">Leader</label>
        <select id="ll-leader" value={leader} onChange={(e) => setLeader(e.target.value)} className="h-8 rounded-lg border border-line bg-paper px-2 text-ink">
          {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="text-ink-soft">→</span>
        <label className="text-ink-soft" htmlFor="ll-follower">Follower</label>
        <select id="ll-follower" value={follower} onChange={(e) => setFollower(e.target.value)} className="h-8 rounded-lg border border-line bg-paper px-2 text-ink">
          {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {!result || !result.best ? (
        <div className="rounded-md border border-dashed border-line p-4 text-[12px] text-ink-soft">{a?.id === b?.id ? "Choose two different series." : "Not enough overlapping observations (need ≥ 24 months)."}</div>
      ) : (
        <>
          <LagBars lags={result.lags} best={result.best.lag} />
          <div className="grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Strongest lag</div><div className="num mt-1 text-[17px] font-semibold text-ink">{result.best.lag} months</div></div>
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Correlation (n)</div><div className="num mt-1 text-[17px] font-semibold text-ink">{(result.best.correlation as number).toFixed(2)} <span className="text-[12px] text-ink-soft">({result.best.n})</span></div></div>
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Split-half</div><div className={`num mt-1 text-[17px] font-semibold ${result.stable ? "text-emerald-700" : "text-amber-700"}`}>{result.firstHalf?.toFixed(2)} / {result.secondHalf?.toFixed(2)}</div></div>
            <div className="stat-tile !p-3">
              <div className="text-[10px] text-ink-soft">Out of sample</div>
              {result.holdout ? (
                <>
                  <div className={`num mt-1 text-[17px] font-semibold ${result.holdout.confirmed ? "text-emerald-700" : "text-amber-700"}`}>
                    {result.holdout.holdoutCorrelation?.toFixed(2) ?? "n/a"} <span className="text-[12px] text-ink-soft">({result.holdout.holdoutN})</span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-ink-soft">{result.holdout.chosenLag}m lag picked on data to {result.holdout.splitMonth} (r {result.holdout.trainCorrelation.toFixed(2)})</div>
                </>
              ) : (
                <div className="mt-1 text-[12px] text-ink-soft">Too little history for a holdout</div>
              )}
            </div>
          </div>
          <ul className="space-y-1 text-[11.5px] leading-relaxed text-ink-muted">
            {a && b && a.seasonalAdjustment !== b.seasonalAdjustment && <li>• Mixing {a.seasonalAdjustment} and {b.seasonalAdjustment} series is acceptable here only because both are compared as YoY changes, which removes most seasonality.</li>}
            {result.caveats.map((c) => <li key={c}>• {c}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
