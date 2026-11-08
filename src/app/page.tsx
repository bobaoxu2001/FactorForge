import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileSearch, FlaskConical, Layers, LineChart, MessagesSquare, Network, Radar, Sparkles } from "lucide-react";
import QualityPanel from "@/components/intel/QualityPanel";
import WorkspaceSummary from "@/components/intel/WorkspaceSummary";
import { EvidenceLinks, fmt, Highlight, KeyFinding, OutcomeBadge, Panel, StatusChip, TriggerBadge } from "@/components/intel/ui";
import { KPI_FRAMEWORKS } from "@/data/research/kpiFrameworks";
import { FEATURED_PROJECT_ID } from "@/data/research/projects";
import { ordinal } from "@/lib/intel/companies";
import { getResearchProject } from "@/lib/intel/project";
import { MEMO_STATUS_LABEL } from "@/lib/intel/quality";
import { RESEARCH_CASES, thesisViews } from "@/lib/events/view";

export const revalidate = 3600;

const LIFECYCLE = ["Initial hypothesis", "Evidence gathering", "Validation", "Research memo", "Monitoring", "Outcome review"];

export default function ResearchHomePage() {
  const view = getResearchProject(FEATURED_PROJECT_ID)!;
  const pid = view.config.id;
  const recent = [...view.evidence]
    .filter((e) => e.observationPeriod?.end && !e.id.startsWith("EV-10K-"))
    .sort((a, b) => (b.observationPeriod!.end).localeCompare(a.observationPeriod!.end))
    .slice(0, 6);
  const triggers = view.hypotheses.flatMap((h) => h.triggers.map((t) => ({ h, t })));
  const tasks = [
    ...view.quality.filter((q) => q.state !== "pass").map((q) => ({ label: q.label, detail: q.detail, href: q.id === "primary-research" ? `/research/${pid}/primary` : q.id === "valuation-assumptions" ? `/research/${pid}/thesis` : `/research/${pid}` })),
    ...view.config.missingData.filter((m) => m.access === "public-not-connected").map((m) => ({ label: `Connect ${m.name}`, detail: m.requirement, href: `/research/${pid}` })),
  ];
  // Stage on the lifecycle: hypotheses tested and memo drafted, primary research outstanding → Validation.
  const stage = view.memoStatus === "evidence-backed" ? 4 : view.hypotheses.some((h) => h.overall !== "insufficient-data") ? 2 : 1;
  // Headline finding: the first pricing KPI's latest actual-vs-fuel-implied gap, computed from the snapshot.
  const lead = view.residuals[0];
  const headline = lead?.latest
    ? { name: view.kpis.find((k) => k.kpi.id === lead.kpiId)?.kpi.name ?? lead.kpiId, actual: lead.latest.actual, residual: lead.latest.residual }
    : null;

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="grid xl:grid-cols-[1.4fr_0.6fr]">
          <div className="p-6 md:p-10">
            <div className="text-[13px] font-medium text-ink-soft">Featured research note · {view.config.industry}</div>
            <h1 className="mt-3 text-[38px] font-semibold leading-[1.04] text-ink md:text-[54px]">{view.config.title}</h1>
            {headline && (
              <KeyFinding className="mt-6">
                {headline.name} is {headline.actual >= 0 ? "up" : "down"} {fmt.pctPlain(Math.abs(headline.actual))} on a year ago, but that is{" "}
                <Highlight>
                  {Math.abs(headline.residual * 100).toFixed(1)} percentage points {headline.residual < 0 ? "below" : "above"} its historical relationship with diesel would predict
                </Highlight>
                .
              </KeyFinding>
            )}
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
              {view.config.subtitle}. Built from SEC filings, FRED macro series and daily prices; snapshot refreshed {view.snapshot.builtAt.slice(0, 10)}. The residual is a statistical comparison, not a measured ex-fuel rate or a causal estimate.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={`/research/${pid}`} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium text-paper transition-colors hover:bg-ink">
                Read the case study <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/research/${pid}/evidence`} className="inline-flex items-center gap-2 text-[14px] font-medium text-accent hover:underline"><FileSearch className="h-4 w-4" /> Evidence explorer</Link>
              <Link href={`/research/${pid}/copilot`} className="inline-flex items-center gap-2 text-[14px] font-medium text-accent hover:underline"><MessagesSquare className="h-4 w-4" /> Research copilot</Link>
            </div>
          </div>
          <aside className="border-t border-line bg-panel2 p-6 md:p-8 xl:border-l xl:border-t-0">
            <h2 className="text-[19px] font-semibold text-ink">Hypothesis scorecard</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">Each hypothesis is scored by tests on the data. Note status: {MEMO_STATUS_LABEL[view.memoStatus].toLowerCase()}.</p>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {view.hypotheses.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                  <span className="text-ink"><span className="num mr-1.5 text-ink-soft">{h.id}</span>{h.title}</span>
                  <OutcomeBadge outcome={h.overall} />
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <p className="max-w-[80ch] text-[14px] leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">FactorForge</span> is an equity research workbench: industry maps, public filings, KPI trends, primary-research planning, valuation and quantitative signals in one place. Every number traces to a dated source, every claim states whether it is verified, and AI output is never treated as evidence.
      </p>

      <Panel
        eyebrow="Event intelligence"
        title="Events that could change a thesis"
        actions={<Link href="/events" className="text-[12px] text-accent hover:text-ink">Event radar →</Link>}
      >
        <ul className="grid gap-4 md:grid-cols-2">
          {RESEARCH_CASES.map((c) => {
            const theses = thesisViews().filter((t) => t.replay.thesis.caseId === c.id);
            return (
              <li key={c.id} className="border-t-[3px] border-ink/15 pt-2">
                <Link href={`/events/${c.slug}`} className="text-[15px] font-semibold leading-snug text-ink hover:text-accent">{c.title}</Link>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{c.dek}</p>
                <p className="mt-1 text-[12px] text-ink-soft">
                  {theses.map((t) => `${t.replay.thesis.id} ${t.replay.status.replace("_", " ").toLowerCase()}`).join(" · ")} · <Link href="/forecasts" className="text-accent hover:underline">forecast scorecard</Link>
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel eyebrow="Research coverage tracker" title="Where the active thesis is in its lifecycle">
        <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {LIFECYCLE.map((step, i) => (
            <li key={step} className={`border-t-[3px] pt-2 text-[13.5px] ${i < stage ? "border-emerald-700 text-ink" : i === stage ? "border-accent font-semibold text-ink" : "border-line text-ink-soft"}`}>
              <div className="num text-[12px] font-normal text-ink-soft">Step {i + 1}{i < stage ? " · done" : ""}</div>
              {step}
              {i === stage && <div className="mt-0.5 text-[12px] font-normal text-accent">Now: primary research outstanding</div>}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel eyebrow="Companies under coverage" title={`${view.companies.length} names · ${view.config.industry}`} actions={<Link href={`/research/${pid}/companies`} className="text-[12px] text-accent hover:text-ink">Competitive intel →</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead className="text-[10px] text-ink-soft"><tr><th className="py-2 pr-3">Company</th><th className="pr-3">Latest filing</th><th className="pr-3 text-right">Rev YoY</th><th className="pr-3 text-right">EV/EBITDA (pct)</th><th className="text-right">Next results (est.)</th></tr></thead>
              <tbody className="divide-soft">
                {view.companies.map((c) => (
                  <tr key={c.ticker} className="table-row">
                    <td className="py-1.5 pr-3"><Link href={`/research/${pid}/companies/${c.ticker}`} className="font-medium text-ink hover:text-accent">{c.ticker}</Link> <span className="text-[11px] text-ink-soft">{c.coverage.businessModel}</span></td>
                    <td className="pr-3 text-ink-muted">{c.filings[0] ? `${c.filings[0].form} · ${c.filings[0].filed}` : "—"}</td>
                    <td className="pr-3 text-right text-ink-muted">{fmt.pct(c.latest?.revenueYoY)}</td>
                    <td className="pr-3 text-right text-ink-muted">{fmt.x(c.valuation?.current.evToEbitda)}{c.valuation?.percentiles.evToEbitda != null ? ` (${ordinal(c.valuation.percentiles.evToEbitda * 100)})` : ""}</td>
                    <td className="text-right text-ink-muted">{c.nextEarningsEstimate?.date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel eyebrow="Your workspace" title="Private research records (this browser)">
          <WorkspaceSummary projectId={pid} />
          <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">Interviews, memo edits and drafts are stored locally and never sent to the server unless you explicitly run an AI analysis on them.</p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Recent evidence" title="Latest observations" actions={<Link href={`/research/${pid}/evidence`} className="text-[12px] text-accent hover:text-ink">All →</Link>}>
          <ul className="space-y-2 text-[12px]">
            {recent.map((e) => (
              <li key={e.id} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2">
                <div className="flex items-center justify-between gap-2"><span className="text-[10.5px] text-ink-soft">{e.observationPeriod?.end}</span><StatusChip status={e.status} /></div>
                <div className="mt-0.5 leading-snug text-ink">{e.claim}</div>
                <EvidenceLinks ids={[e.id]} projectId={pid} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel eyebrow="Upcoming catalysts" title="Scheduled data & estimated results">
          <ul className="space-y-1.5 text-[12px]">
            {view.catalysts.slice(0, 9).map((c) => (
              <li key={c.date + c.label} className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5 last:border-0">
                <span className="num text-[11px] text-ink-muted">{c.date}</span>
                <span className="flex-1 text-ink">{c.label}</span>
                <span className={`text-[10.5px] ${c.confirmed ? "text-emerald-700" : "text-amber-700"}`}>{c.confirmed ? "scheduled" : "estimate"}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel eyebrow="Thesis monitoring" title="Invalidation triggers">
          <ul className="space-y-1.5 text-[12px]">
            {triggers.map(({ h, t }) => (
              <li key={t.id} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-1.5">
                <div className="flex items-center justify-between gap-2"><span className="text-ink">{h.id} {h.title}</span><TriggerBadge state={t.state} /></div>
                <div className="text-[11px] text-ink-muted">{t.description}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel eyebrow="Open research questions & tasks" title="What to do next">
          <ul className="space-y-1.5 text-[12px]">
            {view.config.openQuestions.slice(0, 4).map((q) => <li key={q} className="text-ink-muted">• {q}</li>)}
          </ul>
          <div className="mt-3 space-y-1.5">
            {tasks.slice(0, 6).map((t) => (
              <Link key={t.label} href={t.href} className="block rounded-lg border border-line bg-ink/[0.02] px-3 py-1.5 text-[12px] transition-colors hover:border-accent/35">
                <span className="font-medium text-ink">{t.label}</span>
                <span className="block text-[11px] text-ink-muted">{t.detail}</span>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel eyebrow="Research quality" title="Featured project checks">
          <QualityPanel checks={view.quality} projectId={pid} compact />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Watched industries" title="KPI frameworks">
          <ul className="space-y-2 text-[12px]">
            {KPI_FRAMEWORKS.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-ink/[0.02] px-3 py-2">
                <span><span className="font-medium text-ink">{f.industry}</span><span className="ml-2 text-[11px] text-ink-soft">{f.kpis.length} KPIs defined</span></span>
                {f.connectedProjectId ? <Link href={`/research/${f.connectedProjectId}`} className="text-[11.5px] text-emerald-700">connected · open →</Link> : <Link href="/research/frameworks" className="text-[11.5px] text-ink-soft hover:text-ink">definitions only, no data source</Link>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel eyebrow="Quantitative lab" title="Factor research, backtests & risk (unchanged engine)">
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {[
              ["/quant", "Quant overview", LineChart],
              ["/factors", "Factor research", Network],
              ["/strategies", "Strategy lab & backtests", FlaskConical],
              ["/radar", "Radar screening", Radar],
              ["/portfolio", "Portfolio & attribution", Layers],
              ["/picks", "Quant screen", Sparkles],
              ["/paper-trading", "Paper observation", BookOpenCheck],
              ["/ai-market", "Market stress", LineChart],
            ].map(([href, label, Icon]) => {
              const I = Icon as typeof LineChart;
              return (
                <Link key={href as string} href={href as string} className="flex items-center gap-2 rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-ink-muted transition-colors hover:border-accent/35 hover:text-ink">
                  <I className="h-4 w-4 text-accent/80" /> {label as string}
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">Backtests are in-sample research tools. Simulated portfolios place no orders.</p>
        </Panel>
      </div>
    </div>
  );
}
