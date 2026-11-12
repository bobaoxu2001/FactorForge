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
import { When } from "@/components/events/EventUI";
import { TIMING_NOTE, partitionCatalysts } from "@/lib/intel/catalystTiming";
import { featuredCase, otherEventCases } from "@/lib/events/homeEntries";

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
  const featured = featuredCase();
  const others = otherEventCases();
  // Server-side, in New York time: the edition's schedule is a snapshot, and a passed date says nothing about the outcome.
  const schedule = partitionCatalysts(view.catalysts, new Date());

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden" aria-labelledby="home-title">
        <div className="border-b border-line p-6 md:px-10 md:py-6">
          <p className="text-[13px] font-medium text-ink-soft">FactorForge</p>
          <h1 id="home-title" className="mt-1.5 max-w-[40ch] text-[24px] font-semibold leading-[1.15] text-ink md:text-[30px]">
            An independent equity research workbench for examining business events, tracing evidence, and documenting how research views change.
          </h1>
          <p className="mt-2 max-w-[80ch] text-[13.5px] leading-relaxed text-ink-muted">
            Built from public sources. Every claim states whether it is verified, interpretation is labelled as such, and when a view changes the earlier wording is kept and dated. A research draft, not investment advice; no live trading, and not a proven forecasting tool.
          </p>
        </div>
        <div className="grid xl:grid-cols-[1.5fr_1fr]">
          <div className="p-6 md:px-10 md:py-7">
            <p className="text-[13px] font-medium text-accent">Start here · featured research case</p>
            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <h2 className="max-w-[34ch] text-[22px] font-semibold leading-snug text-ink md:text-[26px]">
                <Link href={featured.briefHref} className="hover:text-accent">{featured.title}</Link>
              </h2>
              <Link href={featured.briefHref} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium text-paper transition-colors hover:bg-ink">
                Read research brief <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <dl className="mt-4 space-y-3.5">
              <div>
                <dt className="text-[12.5px] font-medium text-ink-soft">Research question</dt>
                <dd className="mt-1 font-serif text-[19px] leading-snug text-ink">{featured.question}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-medium text-ink-soft">Current assessment</dt>
                <dd className="mt-1 text-[15px] font-medium leading-relaxed text-ink">{featured.view}</dd>
                <dd className="mt-1.5 text-[12.5px] text-ink-muted">
                  {featured.factsVerification && <>Underlying facts: {featured.factsVerification} · </>}Interpretation: {featured.interpretation}
                </dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-medium text-ink-soft">Key uncertainty</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-ink-muted">{featured.keyUncertainty}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[12px] text-ink-soft">
              Assessment dated <When iso={featured.assessedAt} /> · sources through <When iso={featured.sourcesThrough} /> · prices through <span className="num">{featured.pricesThrough}</span>
            </p>
            <p className="mt-2 flex flex-wrap gap-x-5 text-[13.5px]">
              <Link href={featured.briefHref} className="font-medium text-accent hover:underline">Full assessment in the brief</Link>
              <Link href={featured.impactHref} className="font-medium text-accent hover:underline">Business impact</Link>
              <Link href={featured.evidenceHref} className="font-medium text-accent hover:underline">Evidence</Link>
            </p>
          </div>
          <aside className="border-t border-line bg-panel2 p-6 md:p-8 xl:border-l xl:border-t-0" aria-labelledby="other-cases">
            <h2 id="other-cases" className="text-[17px] font-semibold text-ink">Other research cases</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              <li className="py-3">
                <Link href={`/research/${pid}`} className="text-[14.5px] font-semibold leading-snug text-ink hover:text-accent">{view.config.title}</Link>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  Freight industry case from SEC filings, FRED series and prices; research edition of {view.asOf}. Its hypotheses are scored against the data, and primary research is still outstanding.
                </p>
                <p className="mt-1 flex flex-wrap gap-x-4 text-[12.5px]">
                  <Link href={`/research/${pid}`} className="text-accent hover:underline">Read the case study</Link>
                  <Link href={`/research/${pid}/sample`} className="text-accent hover:underline">One-page brief</Link>
                </p>
              </li>
              {others.map((o) => (
                <li key={o.slug} className="py-3">
                  <Link href={o.briefHref} className="text-[14.5px] font-semibold leading-snug text-ink hover:text-accent">{o.title}</Link>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{o.question}</p>
                  {!o.hasAssessment && <p className="mt-1 text-[12px] text-ink-soft">No current assessment written yet; the brief shows the evidence and hypotheses.</p>}
                  <p className="mt-1 text-[12.5px]">
                    <Link href={o.briefHref} className="text-accent hover:underline">Read research brief</Link>
                  </p>
                </li>
              ))}
            </ul>
            <Link href="/events" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">All events on the radar</Link>
          </aside>
        </div>
      </section>

      <h2 className="pt-3 text-[13px] font-semibold text-ink-soft">Freight case workspace</h2>
      <section className="card overflow-hidden">
        <div className="grid xl:grid-cols-[1.4fr_0.6fr]">
          <div className="p-6 md:p-10">
            <div className="text-[13px] font-medium text-ink-soft">Research note · {view.config.industry}</div>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.08] text-ink md:text-[40px]">{view.config.title}</h2>
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
        <Panel eyebrow="Catalyst calendar" title="Scheduled data & estimated results">
          <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
            Schedule as of {view.asOf} (research edition). Dates compared with {schedule.today}, New York time. A passed date means the outcome has not been checked here, not that it was released.
          </p>
          <h3 className="text-[12px] font-semibold text-ink">Upcoming</h3>
          {schedule.upcoming.length ? (
            <ul className="mt-1 space-y-1.5 text-[12px]">
              {schedule.upcoming.slice(0, 8).map(({ item: c, timing }) => (
                <li key={c.date + c.label} className="flex items-start justify-between gap-2 border-b border-line/60 pb-1.5 last:border-0">
                  <span className="num shrink-0 text-[11px] text-ink-muted">{c.date}</span>
                  <span className="flex-1 text-ink">
                    {c.label}
                    {timing === "today" && <span className="block text-[11px] text-amber-800">{TIMING_NOTE.today}</span>}
                  </span>
                  <span className={`shrink-0 text-[10.5px] ${c.confirmed ? "text-emerald-700" : "text-amber-700"}`}>{c.confirmed ? "scheduled" : "estimate"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-ink-muted">No upcoming dates in this edition&apos;s schedule. A refreshed research edition would add them; none are invented here.</p>
          )}
          {schedule.passed.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer rounded text-[12px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                Passed dates ({schedule.passed.length})
              </summary>
              <ul className="mt-1 space-y-1.5 text-[12px]">
                {schedule.passed.map(({ item: c }) => (
                  <li key={c.date + c.label} className="flex items-start justify-between gap-2 border-b border-line/60 pb-1.5 last:border-0">
                    <span className="num shrink-0 text-[11px] text-ink-soft">{c.date}</span>
                    <span className="flex-1 text-ink-muted">
                      {c.label}
                      <span className="block text-[11px] text-ink-soft">{TIMING_NOTE.passed}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
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
          <QualityPanel checks={view.quality} projectId={pid} focusTickers={view.config.companies.filter((company) => company.focus).map((company) => company.ticker)} compact />
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
        <Panel eyebrow="Quantitative lab" title="Factor research, backtests & risk">
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
