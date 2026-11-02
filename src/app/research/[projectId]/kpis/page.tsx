import Link from "next/link";
import { notFound } from "next/navigation";
import LeadLagExplorer, { type YoySeries } from "@/components/intel/LeadLagExplorer";
import { LagBars, Sparkline, TimeSeriesChart } from "@/components/intel/charts";
import { EvidenceLinks, fmt, FreshnessDot, KeyValues, Note, Panel, textTone } from "@/components/intel/ui";
import { monthlyYoy } from "@/lib/intel/kpis";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;
export const metadata = { title: "KPI trends" };

export default function KpiPage({ params, searchParams }: { params: { projectId: string }; searchParams: { kpi?: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const pid = view.config.id;
  const selected = view.kpis.find((k) => k.kpi.id === searchParams.kpi) ?? view.kpis[0];
  const residual = view.residuals.find((r) => r.kpiId === selected.kpi.id);
  const sinceIdx = selected.readings.findIndex((r) => r.date >= "2019-01-01");
  const chartData = selected.readings.slice(Math.max(0, sinceIdx)).map((r) => ({ date: r.date, level: r.value, yoy: r.yoy }));
  const anomalies = selected.readings.filter((r) => r.anomaly).slice(-6).reverse();
  const yoySeries: YoySeries[] = view.kpis.map((k) => ({ id: k.kpi.id, name: k.kpi.name, seasonalAdjustment: k.kpi.seasonalAdjustment, frequency: k.kpi.frequency, points: monthlyYoy(k) }));
  const groups = ["volume", "pricing", "spend", "cost", "capacity", "demand-driver"] as const;

  return (
    <div className="space-y-5">
      <Panel eyebrow="Stage 03 · KPI trends" title="Industry KPI monitor" actions={<Link href="/research/frameworks" className="text-[12px] text-accent hover:text-ink">KPI frameworks for other industries →</Link>}>
        <p className="mb-3 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          Each KPI carries its definition, units, frequency, source agency, observation and publication dates, collection method and comparability limits. Anomalies are YoY readings ≥ 2σ from their trailing 3-year history. &ldquo;Leading&rdquo; is a hypothesis tested in the lead-lag panel, not an assumption.
        </p>
        <div className="space-y-3">
          {groups.map((g) => {
            const items = view.kpis.filter((k) => k.kpi.category === g);
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <div className="mb-1.5 text-[10.5px] text-ink-soft">{g.replace("-", " ")}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {items.map((k) => (
                    <Link key={k.kpi.id} href={`?kpi=${k.kpi.id}`} scroll={false} className={`stat-tile !p-3 transition-colors ${k.kpi.id === selected.kpi.id ? "!border-accent/50" : "hover:border-accent/30"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-ink">{k.kpi.name}</span>
                        <FreshnessDot freshness={k.freshness} note={k.freshnessNote} />
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className={`num text-[17px] font-semibold ${textTone(k.latest?.yoy)}`}>{fmt.pct(k.latest?.yoy)}</span>
                        <span className="text-[10.5px] text-ink-soft">YoY · {k.latest?.date}</span>
                        {k.latest?.anomaly && <span className="chip border-amber-600/35 bg-amber-400/10 text-amber-800">{k.latest.zScore?.toFixed(1)}σ</span>}
                      </div>
                      <Sparkline values={k.readings.slice(-48).map((r) => r.yoy)} />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel eyebrow={`${selected.kpi.category} · ${selected.kpi.timing}`} title={selected.kpi.name} source={`${selected.source.publisher} via FRED, series ${selected.source.seriesId}${selected.source.licence ? ` (${selected.source.licence})` : ""}.`} actions={<EvidenceLinks ids={[`EV-KPI-${selected.kpi.id}`, `EV-KPI-${selected.kpi.id}-3M`].filter((id) => view.evidence.some((e) => e.id === id))} projectId={pid} />}>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <TimeSeriesChart
            data={chartData}
            series={[
              { key: "yoy", label: "YoY change", color: "rgba(29,79,145,0.55)", kind: "bar", axis: "right" },
              { key: "level", label: `Level (${selected.kpi.units})`, color: "#18202c" },
            ]}
            leftFormat="num"
            rightFormat="pct"
            height={280}
            caption={selected.kpi.seasonalAdjustment === "NSA" ? "Not seasonally adjusted: read YoY, not month-to-month moves." : undefined}
          />
          <KeyValues
            rows={[
              ["Definition", selected.kpi.definition],
              ["Units / frequency", `${selected.kpi.units} · ${selected.kpi.frequency} · ${selected.kpi.seasonalAdjustment}`],
              ["Source", selected.source.url ? <a href={selected.source.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{selected.source.seriesId} ↗</a> : selected.source.seriesId],
              ["Agency / release", `${selected.source.sourceAgency ?? "—"} · ${selected.source.release ?? "—"}`],
              ["Latest observation", `${selected.latest?.date ?? "—"} = ${selected.latest ? fmt.num(selected.latest.value, 3) : "—"}`],
              ["Published (FRED updated)", selected.source.sourceUpdated ?? "—"],
              ["Next release", selected.source.nextRelease ?? "—"],
              ["Freshness", <span key="f"><FreshnessDot freshness={selected.freshness} /> {selected.freshnessNote}</span>],
              ["Collection method", selected.kpi.collectionMethod],
              ["Missing values", `${selected.missingValues} gap(s) in the monthly record since 2015`],
              ["Revisions", "FRED shows the latest vintage; earlier published values may have been revised. Point-in-time vintages are not stored."],
              ["Comparability", <ul key="c" className="space-y-0.5">{selected.kpi.comparabilityNotes.map((n) => <li key={n}>• {n}</li>)}</ul>],
              ["Timing rationale", selected.kpi.timingRationale],
            ]}
          />
        </div>
        {anomalies.length > 0 && (
          <div className="mt-4 text-[12px] text-ink-muted">
            <span className="text-ink-soft">Recent anomalies: </span>
            {anomalies.map((a) => `${a.date} (${fmt.pct(a.yoy)} YoY, ${a.zScore?.toFixed(1)}σ)`).join(" · ")}
          </div>
        )}
      </Panel>

      {residual && (
        <Panel eyebrow="Fuel adjustment" title={`Is ${selected.kpi.name} rising more than fuel explains?`} source="FactorForge calculation on BLS producer prices and EIA diesel prices (both via FRED); the last 12 months are held out of the fit." actions={<EvidenceLinks ids={[`EV-CALC-${selected.kpi.id}-FUEL`]} projectId={pid} />}>
          <TimeSeriesChart
            data={residual.points.filter((p) => p.date >= "2019-01-01").map((p) => ({ date: p.date, actual: p.actual, fitted: p.fitted, residual: p.residual }))}
            series={[
              { key: "residual", label: "Residual (actual − fuel-implied)", color: "rgba(161,92,7,0.6)", kind: "bar" },
              { key: "actual", label: "Actual YoY", color: "#1d4f91" },
              { key: "fitted", label: "Fuel-implied YoY", color: "#8a93a3", dashed: true },
            ]}
            leftFormat="pct"
            zeroLine
            height={260}
            caption={residual.method}
          />
          <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-4">
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Latest residual</div><div className={`num mt-1 text-[17px] font-semibold ${textTone(residual.latest?.residual)}`}>{fmt.pp(residual.latest?.residual)}</div></div>
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Out-of-sample mean</div><div className={`num mt-1 text-[17px] font-semibold ${textTone(residual.meanOutOfSample)}`}>{fmt.pp(residual.meanOutOfSample)}</div></div>
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Fuel slope / R²</div><div className="num mt-1 text-[17px] font-semibold text-ink">{residual.fit.slope.toFixed(2)} / {residual.fit.rSquared.toFixed(2)}</div></div>
            <div className="stat-tile !p-3"><div className="text-[10px] text-ink-soft">Training diesel YoY range</div><div className="num mt-1 text-[15px] font-semibold text-ink">{fmt.pct(residual.trainingFuelRange[0], 0)} to {fmt.pct(residual.trainingFuelRange[1], 0)}</div></div>
          </div>
          {residual.extrapolation && <div className="mt-2"><Note tone="warn">Recent diesel YoY changes fall outside the range seen in training, so the fuel-implied line is an extrapolation of a linear relationship. Read the sign of the residual, not its precise size.</Note></div>}
        </Panel>
      )}

      <Panel eyebrow="Leading vs lagging" title="Lead-lag exploration" source="FRED series as year-over-year changes; FactorForge calculation. Correlation describes co-movement, not prediction.">
        <div className="grid gap-4 lg:grid-cols-2">
          {view.leadLag.map((l) => {
            const leader = view.kpis.find((k) => k.kpi.id === l.leader)!;
            const follower = view.kpis.find((k) => k.kpi.id === l.follower)!;
            return (
              <div key={`${l.leader}-${l.follower}`} className="rounded-md border border-line bg-ink/[0.02] p-3">
                <div className="text-[12.5px] font-medium text-ink">{leader.kpi.name} → {follower.kpi.name}</div>
                <div className="mb-2 text-[11px] text-ink-soft">{l.rationale}</div>
                <LagBars lags={l.result.lags} best={l.result.best?.lag ?? null} height={120} />
                <div className="mt-1 text-[11.5px] text-ink-muted">
                  {l.result.best ? `Strongest: ${(l.result.best.correlation as number).toFixed(2)} at ${l.result.best.lag}m (n=${l.result.best.n}); halves ${l.result.firstHalf?.toFixed(2)} / ${l.result.secondHalf?.toFixed(2)} → ${l.result.stable ? "stable sign" : "unstable"}${l.result.holdout ? `; out of sample (lag picked on data to ${l.result.holdout.splitMonth}): ${l.result.holdout.holdoutCorrelation?.toFixed(2) ?? "n/a"} at ${l.result.holdout.chosenLag}m → ${l.result.holdout.confirmed ? "holds" : "does not hold"}` : ""}.` : "Insufficient overlap."}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-md border border-line p-3">
          <div className="mb-2 text-[12.5px] font-medium text-ink">Explore any pair</div>
          <LeadLagExplorer series={yoySeries} defaultLeader="retail-sales" defaultFollower="cass-shipments" />
        </div>
        <div className="mt-3"><Note>Correlation is not demonstrated predictive power. The out-of-sample tile re-checks the chosen lag on months the choice never saw, which can rule a relationship out but cannot prove it predicts. Before calling a KPI &ldquo;leading&rdquo; in a memo, a rolling-origin forecast against a naive benchmark is still needed; that test is on the roadmap and not implemented here.</Note></div>
      </Panel>
    </div>
  );
}
