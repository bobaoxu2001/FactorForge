import { notFound } from "next/navigation";
import { caseMetadata } from "@/lib/events/caseMetadata";
import ImpactMap from "@/components/events/ImpactMap";
import { EPISTEMIC_LABEL, ResolvedRefs, When } from "@/components/events/EventUI";
import { ChannelPlan, ResearchTests } from "@/components/events/ResearchTests";
import { Note, Panel } from "@/components/intel/ui";
import { caseBySlug } from "@/data/events";
import type { CompanyCase, ImpactChannel } from "@/data/events/types";
import { formatFigure } from "@/lib/events/figures";
import { COMPARISON_LABEL, EXPOSURE_DIMENSIONS, LAYERS, type ExposureCell, type ExposureLevel } from "@/lib/events/impact";
import { caseAsOf, exposureRows, impacts, resolveRefs } from "@/lib/events/view";
import { ALL_SOURCES } from "@/data/events";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) =>
  caseMetadata(params, "Business impact", "How the event could reach company economics: one company worked through from primary disclosures, hypotheses as research tests, the impact map and exposure.");

const LEVEL_STYLE: Record<ExposureLevel, string> = {
  high: "bg-ink/[0.85] text-paper",
  medium: "bg-ink/30 text-ink",
  low: "bg-ink/[0.08] text-ink-muted",
  none: "bg-transparent text-ink-soft",
  unknown: "border border-dashed border-ink/25 bg-transparent text-ink-soft",
};

const CHANNEL_LABEL: Record<ImpactChannel, string> = {
  "risk-premium": "Valuation or risk premium",
  "delayed-revenue": "Delayed revenue",
  "permanent-demand-loss": "Permanent demand loss",
  pricing: "Pricing",
  "project-relocation": "Project relocation",
  cost: "Cost",
};

function ExposureTag({ cell }: { cell: ExposureCell | undefined }) {
  if (!cell) return <span className="text-[11.5px] text-ink-soft">not assessed</span>;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium ${LEVEL_STYLE[cell.level]}`}>
        {cell.level}
        {!cell.verified && <span aria-label="not checked against filings">°</span>}
      </span>
      <span className="text-[11px] leading-snug text-ink-soft">{cell.basis}</span>
    </span>
  );
}

function CompanyCaseView({ cc, caseSlug }: { cc: CompanyCase; caseSlug: string }) {
  const c = caseBySlug(caseSlug)!;
  const sources = new Map(ALL_SOURCES.map((s) => [s.id, s]));
  const refs = (ids: string[]) => resolveRefs(c, ids, cc.at);
  return (
    <div className="space-y-5">
      <div>
        <p className="font-serif text-[20px] leading-snug text-ink">{cc.question}</p>
        <p className="mt-1.5 max-w-[80ch] text-[13.5px] leading-relaxed text-ink-muted">{cc.whyThisCompany}</p>
        <dl className="mt-3 grid gap-3 text-[12.5px] md:grid-cols-3">
          <div><dt className="text-ink-soft">Business possibly affected</dt><dd className="text-ink">{cc.segment}</dd></div>
          <div><dt className="text-ink-soft">Geography</dt><dd className="text-ink">{cc.geography}</dd></div>
          <div><dt className="text-ink-soft">Customers</dt><dd className="text-ink">{cc.customers}</dd></div>
        </dl>
      </div>

      <section id="figures" className="scroll-mt-28">
        <h3 className="section-label">Disclosed figures</h3>
        <div className="-mx-5 mt-2 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[860px] text-left text-[12.5px]" aria-label={`${cc.company}: disclosed figures`}>
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium md:pl-6">Figure</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Value</th>
                <th scope="col" className="px-2 py-2 font-medium">Period · denominator</th>
                <th scope="col" className="px-2 py-2 font-medium">Basis</th>
                <th scope="col" className="px-2 py-2 font-medium md:pr-6">Source · published · read</th>
              </tr>
            </thead>
            <tbody>
              {cc.figures.map((f) => {
                const src = sources.get(f.sourceId);
                return (
                  <tr key={f.id} id={`fig-${f.id}`} className="scroll-mt-28 border-b border-line align-top last:border-0 target:bg-accent-soft">
                    <th scope="row" className="px-5 py-2 text-left font-normal text-ink md:pl-6">{f.label}</th>
                    <td className={`num px-2 py-2 text-right ${f.value === null ? "font-medium text-amber-800" : "font-semibold text-ink"}`}>{formatFigure(f)}</td>
                    <td className="px-2 py-2 text-ink-muted">
                      {f.period}
                      {f.denominator && <span className="block text-[11.5px] text-ink-soft">÷ {f.denominator}</span>}
                    </td>
                    <td className="px-2 py-2 text-ink-muted">
                      {f.basis === "derived" ? "derived" : f.value === null ? "not disclosed" : "disclosed"}
                      {f.derivation && <span className="block text-[11.5px] text-ink-soft">{f.derivation}</span>}
                    </td>
                    <td className="px-2 py-2 text-ink-muted md:pr-6">
                      {src ? (
                        <>
                          <a href={src.url} className="text-accent hover:underline" rel="noreferrer" target="_blank">{src.publisher}</a>, {f.where}
                          <span className="block text-[11.5px] text-ink-soft">
                            published <When iso={src.publishedAt} precision={src.publishedPrecision} /> · read <When iso={src.retrievedAt} />
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-muted">{cc.exposureNote}</p>
      </section>

      <section>
        <h3 className="section-label">Ways the restrictions could reach {cc.company}&apos;s economics</h3>
        <p className="mt-1 text-[12.5px] text-ink-muted">These can happen together. Each read is a dated analyst judgement ({new Date(cc.at).toISOString().slice(0, 10)}), not a probability.</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {cc.channels.map((ch) => (
            <article key={ch.channel} className="rounded-md border border-line p-3.5">
              <h4 className="text-[14px] font-semibold text-ink">{CHANNEL_LABEL[ch.channel]}</h4>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{ch.mechanism}</p>
              <dl className="mt-2 space-y-1 text-[12.5px] leading-relaxed">
                <div><dt className="inline text-ink-soft">Watch: </dt><dd className="inline text-ink-muted">{ch.kpi}</dd></div>
                <div><dt className="inline text-ink-soft">Financial effect: </dt><dd className="inline text-ink-muted">{ch.financialImplication}</dd></div>
                <div><dt className="inline text-ink-soft">Timing: </dt><dd className="inline text-ink-muted">{ch.timing}</dd></div>
                <div><dt className="inline text-ink-soft">Assumption: </dt><dd className="inline text-ink-muted">{ch.assumption}</dd></div>
                <div className="flex flex-wrap items-center gap-1"><dt className="text-ink-soft">For:</dt><dd><ResolvedRefs refs={refs(ch.evidenceFor)} caseSlug={caseSlug} empty="nothing yet" /></dd></div>
                <div className="flex flex-wrap items-center gap-1"><dt className="text-ink-soft">Against:</dt><dd><ResolvedRefs refs={refs(ch.evidenceAgainst)} caseSlug={caseSlug} empty="nothing recorded" /></dd></div>
              </dl>
              <p className="mt-2 border-l-2 border-amber-600 pl-2 text-[12.5px] text-ink"><span className="font-medium text-amber-900">Current read: </span>{ch.read}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="section-label">Critical assumptions</h3>
          <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink-muted">
            {cc.criticalAssumptions.map((a) => <li key={a}>· {a}</li>)}
          </ul>
          <h3 className="section-label mt-4">Still unknown</h3>
          <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink-muted">
            {cc.unknowns.map((a) => <li key={a}>· {a}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="section-label">Expectation gap</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ink">
            {cc.expectationGap.reference ? (
              <>Against {cc.expectationGap.reference}: {cc.expectationGap.gap}</>
            ) : (
              <span className="font-medium text-amber-900">Expectation gap not established.</span>
            )}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{cc.expectationGap.note.replace(/^Expectation gap not established\.\s*/, "")}</p>
          <h3 className="section-label mt-4">Next research action</h3>
          <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-ink">{cc.nextAction}</p>
        </div>
      </section>
    </div>
  );
}

export default async function EventImpactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const asOf = caseAsOf(c);
  const imp = impacts(c, asOf);
  const rows = exposureRows(c);
  const windowLabel = c.windows.find((w) => w.id === c.graphWindowId)?.label ?? c.graphWindowId;
  const cc = c.companyCases?.[0];
  const mainNode = cc ? c.graph.nodes.find((n) => n.ticker === cc.ticker)?.id : undefined;
  const mainPaths = Object.fromEntries((c.companyCases ?? []).flatMap((x) => {
    const node = c.graph.nodes.find((n) => n.ticker === x.ticker)?.id;
    return node ? [[node, x.mainPath]] : [];
  }));
  const testLabels = Object.fromEntries([...(c.companyCases ?? []).flatMap((x) => x.tests), ...c.events.flatMap((e) => e.competingExplanations)].map((t) => [t.id, t.label]));

  return (
    <div className="space-y-5">
      {cc ? (
        <Panel title={`Company example: ${cc.company} (${cc.ticker})`} eyebrow="From mechanism to company economics" source={`Primary disclosures as listed; analyst assessment dated ${new Date(cc.at).toISOString().slice(0, 10)}.`}>
          <CompanyCaseView cc={cc} caseSlug={c.slug} />
        </Panel>
      ) : (
        <Note>No company has been worked through from primary disclosures in this case yet. The impact map below shows proposed mechanisms; none is tied to a company&apos;s reported figures.</Note>
      )}

      {cc && (
        <Panel title="Hypotheses as research tests" eyebrow={`${cc.company}: what each would predict, and what to check next`} source="Evidence resolved as of the assessment date; market checks from the market reaction page.">
          <p className="mb-3 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">These are not mutually exclusive: a delay in demand, a change in pricing and a change in risk premium can all happen at once.</p>
          <ResearchTests c={c} tests={cc.tests} />
        </Panel>
      )}

      {c.channelChecks?.length ? (
        <Panel title="Channel-check plan" eyebrow="Planned, not done" source="Analyst plan. No interviews have taken place.">
          <ChannelPlan checks={c.channelChecks} testLabels={testLabels} />
        </Panel>
      ) : null}

      <Panel title="Impact map" eyebrow="Proposed mechanisms, one at a time" source={`Case impact graph; evidence resolved as of ${new Date(asOf).toISOString().slice(0, 16).replace("T", " ")} UTC.`}>
        <p className="mb-4 max-w-[80ch] text-[13.5px] leading-relaxed text-ink-muted">
          A citation counts for a link only if it existed, came from a source read by the cutoff, is verified well enough, and has been judged to bear on that link. Evidence that establishes a background fact, such as that a permit pause exists, leaves the link an assumption. Solid borders mark links with direct evidence, dashed ones links resting on background evidence, dotted ones links with none.
        </p>
        <ImpactMap graph={c.graph} impacts={imp} layers={LAYERS} caseSlug={c.slug} initial={mainNode} mainPaths={mainPaths} />
      </Panel>

      <Panel title="Business hypotheses beside the measured price response" eyebrow="Kept apart, not reconciled" source={`Day-0 returns, ${windowLabel}.`}>
        <p className="mb-3 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-muted">
          The map&apos;s hypotheses concern revenue and earnings over months. A one-day price move cannot confirm or refute them, so the response is shown for context. Where no direction is evidence-backed, there is nothing to compare.
        </p>
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[880px] text-left text-[12.5px]" aria-label="Business hypotheses and measured price response">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium md:pl-6">Company</th>
                <th scope="col" className="px-2 py-2 font-medium">Evidence-backed direction</th>
                <th scope="col" className="px-2 py-2 font-medium">Scenario aid (signs on proposed paths)</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Paths with evidence on every link</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Day 0: raw · beyond benchmark</th>
                <th scope="col" className="px-2 py-2 font-medium md:pr-6">Comparison</th>
              </tr>
            </thead>
            <tbody>
              {imp.map((i) => (
                <tr key={i.nodeId} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="px-5 py-2 text-left font-normal md:pl-6"><span className="font-medium text-ink">{i.ticker}</span> <span className="text-[12px] text-ink-soft">{i.label}</span></th>
                  <td className="px-2 py-2 text-ink">{i.net === "unsupported" ? "none" : i.net}</td>
                  <td className="px-2 py-2 text-ink-muted">{i.scenario === "raises" ? "would raise" : i.scenario === "lowers" ? "would lower" : i.scenario}</td>
                  <td className="num px-2 py-2 text-right text-ink-muted">{i.paths.filter((p) => p.evidenceBacked).length} of {i.paths.length}</td>
                  <td className="num px-2 py-2 text-right text-ink-muted">
                    {i.observed ? `${i.observed.raw === null ? "—" : `${(i.observed.raw * 100).toFixed(1)}%`} · ${i.observed.abnormal === null ? "—" : `${(i.observed.abnormal * 100).toFixed(1)}%`}${i.observed.significant ? " (beyond noise)" : ""}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-ink-muted md:pr-6">{COMPARISON_LABEL[i.comparison.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Alternative paths" eyebrow="What could make the map wrong">
        <div className="grid gap-3 md:grid-cols-2">
          {c.graph.alternatives.map((a) => (
            <div key={a.id} className="rounded-md border border-dashed border-ink/25 p-3.5">
              <div className="font-semibold text-ink">{a.label}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{a.description}</p>
              <p className="mt-1.5 text-[12px] text-ink-soft">Affects {a.affects.join(", ")} · watch: {a.watch}</p>
            </div>
          ))}
        </div>
      </Panel>

      <section id="exposure" className="scroll-mt-28">
        <Panel
          title="Exposure watchlist"
          eyebrow="Business exposure is classified; market metrics are measured"
          source="Business exposure: analyst classification from public descriptions (° = not yet checked against the company's filing). Metrics: Yahoo quoteSummary snapshot and daily bars."
        >
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full min-w-[1180px] text-left text-[12.5px]" aria-label="Exposure watchlist">
              <thead className="border-b border-line text-[11.5px] text-ink-soft">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-panel px-5 py-2 font-medium md:pl-6">Company</th>
                  {EXPOSURE_DIMENSIONS.map((d) => (
                    <th key={d.key} scope="col" className="px-2 py-2 font-medium">{d.label}</th>
                  ))}
                  {rows[0]?.metrics.map((m) => (
                    <th key={m.key} scope="col" className="px-2 py-2 text-right font-medium">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ticker} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="sticky left-0 z-10 bg-panel px-5 py-2 text-left font-normal md:pl-6">
                      <div className="font-medium text-ink">{r.ticker}</div>
                      <div className="text-[11.5px] text-ink-soft">{r.role}</div>
                    </th>
                    {EXPOSURE_DIMENSIONS.map((d) => (
                      <td key={d.key} className="max-w-[180px] px-2 py-2"><ExposureTag cell={r.cells[d.key]} /></td>
                    ))}
                    {r.metrics.map((m) => (
                      <td key={m.key} className={`num px-2 py-2 text-right ${m.state === "measured" ? "text-ink" : "text-[11.5px] text-ink-soft"}`}>{m.display}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 grid gap-2 text-[12.5px] leading-relaxed md:grid-cols-2">
            {rows[0]?.metrics.map((m) => (
              <div key={m.key}>
                <dt className="font-medium text-ink">{m.label} <span className="font-normal text-ink-soft">({EPISTEMIC_LABEL[m.epistemic].toLowerCase()})</span></dt>
                <dd className="text-ink-muted">{m.basis}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <Note tone="warn">
              Business exposure is a classification from public descriptions, not a measured share. &ldquo;Not assessed&rdquo;, &ldquo;unknown&rdquo;, &ldquo;not in the snapshot&rdquo; and &ldquo;not measured&rdquo; are different from zero. None of the metrics is turned into a sensitivity rating: no model here maps a multiple or a beta onto exposure to this event.
            </Note>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {c.watchlist.map((w) => (
              <div key={w.id} className="rounded-md border border-line p-3">
                <div className="text-[13px] font-semibold text-ink">{w.label}</div>
                <div className="num mt-0.5 text-[12px] text-ink-muted">{w.symbols.join(" · ")}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{w.why}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
