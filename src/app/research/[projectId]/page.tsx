import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QualityPanel from "@/components/intel/QualityPanel";
import ResearchBrief from "@/components/intel/ResearchBrief";
import { Sparkline } from "@/components/intel/charts";
import { CitedText, EvidenceLinks, fmt, FreshnessDot, Note, OutcomeBadge, Panel, textTone, TriggerBadge } from "@/components/intel/ui";
import { variantView } from "@/lib/intel/memo";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const params = await paramsPromise;
  const view = getResearchProject(params.projectId);
  return { title: view ? view.config.title : "Research project", description: view?.config.subtitle };
}

const HEADLINE_KPIS = ["truck-tonnage", "cass-shipments", "ppi-truckload", "cass-implied-rate", "diesel", "truck-employment", "inventory-sales", "ip-manufacturing"];

export default async function ProjectOverviewPage({ params: paramsPromise }: { params: Promise<{ projectId: string }> }) {
  const params = await paramsPromise;
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const pid = view.config.id;
  const kpis = HEADLINE_KPIS.map((id) => view.kpis.find((k) => k.kpi.id === id)).filter((k): k is NonNullable<typeof k> => Boolean(k));
  const focus = view.companies.filter((c) => c.coverage.focus);
  const triggered = view.hypotheses.flatMap((h) => h.triggers.filter((t) => t.state === "triggered").map((t) => ({ h, t })));

  return (
    <div className="space-y-5">
      <ResearchBrief view={view} />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel eyebrow="Core investment question" title="What we are trying to find out">
          <p className="text-[14px] leading-relaxed text-ink">{view.config.researchQuestion}</p>
          <ol className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            {view.config.objectives.map((o, i) => (
              <li key={o} className="flex gap-2">
                <span className="num text-[10.5px] text-accent/80">{String(i + 1).padStart(2, "0")}</span>
                {o}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel eyebrow="Workflow" title="Where this research stands">
          <ol className="space-y-1.5 text-[12.5px]">
            {[
              ["industry", "Industry map", `${view.valueChain.relationships.filter((r) => r.status === "verified").length} of ${view.valueChain.relationships.length} value-chain relationships verified against 10-K text`],
              ["evidence", "Evidence", `${view.evidence.length} evidence items, all with source links`],
              ["kpis", "KPI trends", `${view.kpis.length} series; ${view.kpis.filter((k) => k.freshness === "fresh").length} fresh, ${view.kpis.filter((k) => k.latest?.anomaly).length} flagged anomalies`],
              ["companies", "Competitive intel", `${view.companies.length} companies from SEC XBRL (point-in-time)`],
              ["primary", "Primary research", "Channel-check plan ready. No interviews recorded on the server; yours stay in this browser."],
              ["thesis", "Thesis & decision", `${view.hypotheses.filter((h) => h.overall !== "insufficient-data").length} of ${view.hypotheses.length} public-data screens evaluated; ${triggered.length} trigger(s) fired. Direct validation incomplete.`],
              ["memo", "Memo", "Public-source memo with peer sensitivity, editable and exportable"],
            ].map(([slug, label, status]) => (
              <li key={slug}>
                <Link href={`/research/${pid}/${slug}`} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-ink/[0.02] px-3 py-2 transition-colors hover:border-accent/35">
                  <span className="font-medium text-ink">{label}</span>
                  <span className="text-right text-[11.5px] text-ink-muted">{status}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel eyebrow="Differentiated view" title="What the evidence says so far" actions={<Link href={`/research/${pid}/memo`} className="text-[12px] text-accent hover:text-ink">Open memo →</Link>}>
        <ul className="space-y-2 text-[13px] leading-relaxed text-ink">
          {variantView(view).map((p) => (
            <li key={p} className="rounded-md border border-line bg-ink/[0.02] px-3 py-2">
              <CitedText text={p} projectId={pid} />
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Note>Source-linked interpretation from the research screens below. Calculations, economic interpretation and proposed fieldwork have separate evidence limits; primary interviews are not included.</Note>
        </div>
      </Panel>

      <Panel eyebrow="Hypotheses" title="Competing hypotheses, tested against data" actions={<Link href={`/research/${pid}/thesis`} className="text-[12px] text-accent hover:text-ink">Thesis & scenarios →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="text-[10.5px] text-ink-soft">
              <tr>
                <th className="py-2 pr-3">Hypothesis</th>
                <th className="py-2 pr-3">Stance</th>
                <th className="py-2 pr-3">Result</th>
                <th className="py-2 pr-3">For / against</th>
                <th className="py-2">Invalidation triggers</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {view.hypotheses.map((h) => (
                <tr key={h.id} className="table-row align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-ink">{h.id} · {h.title}</div>
                    <div className="mt-0.5 max-w-md text-[11.5px] text-ink-muted">{h.statement}</div>
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{h.stance}</td>
                  <td className="py-2 pr-3"><OutcomeBadge outcome={h.overall} /></td>
                  <td className="py-2 pr-3 text-ink-muted">
                    <span className="text-emerald-700">{h.supportingEvidenceIds.length}</span> / <span className="text-rose-700">{h.contradictingEvidenceIds.length}</span>
                  </td>
                  <td className="py-2">
                    {h.triggers.length === 0 ? <span className="text-ink-soft">none defined</span> : h.triggers.map((t) => (
                      <div key={t.id} className="mb-1 flex items-center gap-2"><TriggerBadge state={t.state} /><span className="text-[11px] text-ink-muted">{t.description}</span></div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel eyebrow="KPI monitor" title="Leading and coincident indicators" actions={<Link href={`/research/${pid}/kpis`} className="text-[12px] text-accent hover:text-ink">KPI explorer →</Link>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.kpi.id} href={`/research/${pid}/kpis?kpi=${k.kpi.id}`} className="stat-tile !p-3 transition-colors hover:border-accent/35">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-medium text-ink">{k.kpi.name}</span>
                <FreshnessDot freshness={k.freshness} note={k.freshnessNote} />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`num text-[19px] font-semibold ${textTone(k.latest?.yoy)}`}>{fmt.pct(k.latest?.yoy)}</span>
                <span className="text-[10.5px] text-ink-soft">YoY · {k.latest?.date.slice(0, 7)}</span>
                {k.latest?.anomaly && <span className="chip border-amber-600/35 bg-amber-400/10 text-amber-800">anomaly</span>}
              </div>
              <Sparkline values={k.readings.slice(-36).map((r) => r.yoy)} />
              <div className="text-[10px] text-ink-soft">{k.kpi.timing} · {k.kpi.category} · {k.source.sourceAgency}</div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Coverage" title="Focus companies" actions={<Link href={`/research/${pid}/companies`} className="text-[12px] text-accent hover:text-ink">All peers →</Link>}>
          <ul className="space-y-2">
            {focus.map((c) => (
              <li key={c.ticker}>
                <Link href={`/research/${pid}/companies/${c.ticker}`} className="block rounded-md border border-line bg-ink/[0.02] px-3 py-2 transition-colors hover:border-accent/35">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{c.ticker} · {c.name}</span>
                    <span className="text-[11px] text-ink-soft">{c.coverage.businessModel}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-[11.5px] text-ink-muted">
                    <span>Rev {fmt.pct(c.latest?.revenueYoY)} YoY</span>
                    <span>Op. margin {fmt.pp(c.latest?.operatingMarginYoYChange)}</span>
                    <span>EV/EBITDA {fmt.x(c.valuation?.current.evToEbitda)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink-soft">{c.coverage.researchAngle}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel eyebrow="Catalysts" title="Upcoming data releases & results">
          <ul className="space-y-1.5 text-[12.5px]">
            {view.catalysts.slice(0, 10).map((c) => (
              <li key={`${c.date}-${c.label}`} className="flex items-start justify-between gap-3 border-b border-line/60 pb-1.5 last:border-0">
                <span className="num text-[11.5px] text-ink-muted">{c.date}</span>
                <span className="flex-1 text-ink">{c.label}</span>
                <span className={`chip ${c.confirmed ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700" : "border-dashed border-amber-600/40 text-amber-800"}`}>{c.confirmed ? "scheduled" : "estimated"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-soft">Release dates come from FRED series pages. Earnings dates are estimated from last year&apos;s 8-K Item 2.02 cadence until companies confirm them.</p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel eyebrow="Research quality" title="Completeness checks (no composite score)">
          <QualityPanel checks={view.quality} projectId={pid} focusTickers={view.config.companies.filter((company) => company.focus).map((company) => company.ticker)} />
        </Panel>
        <Panel eyebrow="Gaps" title="What is missing">
          <ul className="space-y-2 text-[12px] leading-relaxed">
            {view.config.missingData.map((m) => (
              <li key={m.id} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2">
                <div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{m.name}</span><span className="text-[10.5px] text-ink-soft">{m.access.replace(/-/g, " ")}</span></div>
                <div className="text-ink-muted">{m.why}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {triggered.length > 0 && (
        <Panel eyebrow="Thesis monitor" title="Invalidation conditions that have fired">
          <ul className="space-y-2 text-[12.5px]">
            {triggered.map(({ h, t }) => (
              <li key={t.id} className="rounded-md border border-rose-600/25 bg-rose-400/[0.05] px-3 py-2">
                <div className="font-medium text-rose-800">{h.id} {h.title}: {t.description}</div>
                <div className="text-ink-muted">{t.detail} <EvidenceLinks ids={t.evidenceIds} projectId={pid} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
