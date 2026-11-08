import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CitedProse, OriginChip, ResolvedRefs, ThesisStatusChip, VerificationChip, When, pct, tone } from "@/components/events/EventUI";
import { caseBySlug, instrument } from "@/data/events";
import { caseMetadata } from "@/lib/events/caseMetadata";
import { formatFigure } from "@/lib/events/figures";
import type { VerificationState } from "@/lib/events/types";
import { benchmarkSensitivity, caseAsOf, eventView, pricesThrough, resolveRefs, thesisViews, windowView } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) =>
  caseMetadata(params, "Brief", "The current assessment first: question, view, why it matters, the strongest evidence, the main uncertainty and the next check, with the history and methods underneath.");

const ORDER: VerificationState[] = ["CONFIRMED", "CORROBORATED", "REPORTED", "RUMOR", "DISPUTED"];

function Section({ id, title, href, linkLabel, children }: { id: string; title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-5" aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-[18px] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-[12.5px] text-accent hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="border-t border-line py-3">
      <summary className="cursor-pointer select-none rounded text-[14px] font-medium text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {summary}
      </summary>
      <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-ink">{children}</div>
    </details>
  );
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const CHANNEL_NAME: Record<string, string> = {
  "risk-premium": "Valuation or risk premium",
  "delayed-revenue": "Delayed revenue",
  "permanent-demand-loss": "Permanent demand loss",
  pricing: "Pricing",
  "project-relocation": "Project relocation",
  cost: "Cost",
};

export default async function EventBriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const base = `/events/${c.slug}`;
  const a = c.currentAssessment;
  const asOf = caseAsOf(c);
  const refs = (ids: string[]) => resolveRefs(c, ids, asOf);
  const primary = eventView(c.primaryEventId);
  const theses = thesisViews().filter((t) => t.replay.thesis.caseId === c.id);
  const original = theses.find((t) => t.replay.thesis.id === a?.updatesThesisId) ?? theses[0];
  const through = pricesThrough();
  const cc = c.companyCases?.[0];
  const allClaims = c.events.flatMap((e) => eventView(e.id)?.claims ?? []);
  const counts = ORDER.map((v) => [v, allClaims.filter((x) => x.verification === v).length] as const).filter(([, n]) => n > 0);
  const corrected = c.claims.filter((x) => x.corrections?.length).length;
  const unread = c.sources.filter((s) => s.retrieval !== "read");
  const nodeLabel = (id: string) => c.graph.nodes.find((n) => n.id === id)?.label ?? id;

  // Market response windows: the primary event's, plus the one the impact map is read against.
  const windowIds = [...new Set([...c.windows.filter((w) => w.eventId === c.primaryEventId).map((w) => w.id), c.graphWindowId])];
  const views = windowIds
    .map((id) => windowView(c, id))
    .filter((v) => v !== null)
    .sort((x, y) => (x.studies.find((s) => s.day0)?.day0 ?? "").localeCompare(y.studies.find((s) => s.day0)?.day0 ?? ""));
  const groupOf = (sym: string) => c.groups[sym] ?? instrument(sym)?.group ?? "Other";
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const explanations = primary?.event.competingExplanations ?? [];
  const keyFigures = cc ? cc.figures.filter((f) => f.basis === "derived" || f.value === null || f.label.includes("2027")).slice(0, 5) : [];

  return (
    <div className="mx-auto max-w-[980px]">
      {/* Conclusion first */}
      <section aria-labelledby="current-view" className="card p-5 md:p-7">
        <p className="text-[12.5px] font-medium text-ink-soft">Research question</p>
        <p className="mt-1 font-serif text-[20px] leading-snug text-ink md:text-[23px]">{a?.question ?? original?.replay.thesis.question ?? c.dek}</p>

        <h2 id="current-view" className="mt-5 text-[12.5px] font-medium text-ink-soft">
          Current assessment
        </h2>
        {a ? (
          <>
            <p className="mt-1 text-[17px] font-medium leading-snug text-ink md:text-[18px]">{a.view}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
              {primary && (
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  Underlying facts: <VerificationChip state={primary.verification} title={primary.confidenceReason} />
                </span>
              )}
              <span className="text-ink-muted">
                Interpretation: <span className="rounded border border-amber-600/40 bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-900">{a.interpretation.strength}</span>
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{a.interpretation.reason}</p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Strongest supporting evidence</h3>
                <ul className="mt-1 space-y-2">
                  {a.strongest.map((x) => (
                    <li key={x.text} className="text-[13.5px] leading-relaxed text-ink">
                      {x.text} {x.refs.length > 0 && <ResolvedRefs refs={refs(x.refs)} caseSlug={c.slug} />}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Key uncertainty and counterevidence</h3>
                <ul className="mt-1 space-y-2">
                  {a.uncertainty.map((x) => (
                    <li key={x.text} className="text-[13.5px] leading-relaxed text-ink">
                      {x.text} {x.refs.length > 0 && <ResolvedRefs refs={refs(x.refs)} caseSlug={c.slug} />}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Why it matters</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">{a.whyItMatters}</p>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Next verification step</h3>
                <p className="mt-1 text-[13.5px] font-medium leading-relaxed text-ink">{a.nextStep}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
            No current assessment has been written for this case yet. The sections below show the evidence and hypotheses; the original thesis and its triggers are on the{" "}
            <Link href="/theses" className="text-accent hover:underline">
              thesis tracker
            </Link>
            .
          </p>
        )}

        <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[12px] text-ink-soft">
          {a && (
            <div>
              <dt className="inline">Assessment: </dt>
              <dd className="inline text-ink-muted">
                analyst, <When iso={a.at} />
              </dd>
            </div>
          )}
          <div>
            <dt className="inline">Sources through: </dt>
            <dd className="inline text-ink-muted">
              <When iso={c.asOf} />
            </dd>
          </div>
          <div>
            <dt className="inline">Prices through: </dt>
            <dd className="num inline text-ink-muted">{through.equity}</dd>
          </div>
          {original && (
            <div className="inline-flex flex-wrap items-center gap-1">
              <dt className="inline">Original thesis: </dt>
              <dd className="inline-flex flex-wrap items-center gap-1 text-ink-muted">
                <OriginChip origin={original.replay.thesis.origin} /> information cut off <When iso={original.replay.thesis.informationCutoff} />
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Summary level */}
      <Section id="mechanism" title="Business mechanism" href={`${base}/impact`} linkLabel="Business impact">
        {cc ? (
          <>
            <p>
              <span className="font-medium">Main mechanism examined: </span>
              {cc.mainPath.slice(1).map(nodeLabel).join(" → ")}.
            </p>
            <p className="text-ink-muted">Competing mechanisms for the same company: capacity already connected becomes scarcer and more valuable; projects move to other states; or only the risk premium changes. Each is written as a research test with what it predicts and what would weaken it.</p>
          </>
        ) : (
          <p className="text-ink-muted">No mechanism has been worked through to a company in this case yet.</p>
        )}
        <p className="text-[12.5px] text-ink-muted">A mechanism is a hypothesis about how the event reaches revenue or costs. A confirmed policy fact establishes the premise, not the effect on any company.</p>
      </Section>

      <Section id="price-response" title="Where prices moved, and how much depends on the benchmark" href={`${base}/market`} linkLabel="Market reaction">
        <ul className="space-y-2">
          {views.map((v) => {
            const owns = [...new Set(v.studies.map((s) => s.benchmark).filter(Boolean))].sort().join(" or ");
            const hasEw = Object.keys(v.equalWeight).length > 0;
            const differs = hasEw && Math.abs(v.day0TestsEqualWeight.significant - v.day0Tests.significant) > Math.max(2, v.day0Tests.expectedByChance * 2);
            return (
              <li key={v.spec.id}>
                <span className="font-medium">{v.spec.label}:</span> {v.day0Tests.significant} of {v.day0Tests.run} moves beyond noise against each stock&apos;s own benchmark ({owns})
                {hasEw && (
                  <>
                    , {v.day0TestsEqualWeight.significant} of {v.day0TestsEqualWeight.run} against the equal-weight S&amp;P 500
                  </>
                )}
                ; about {v.day0Tests.expectedByChance.toFixed(1)} expected by chance. <span className={differs ? "font-medium text-amber-900" : "text-ink-muted"}>{differs ? "Benchmark-sensitive: the two comparisons disagree." : "The two comparisons broadly agree."}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] text-ink-muted">A stock&apos;s expected move is its estimated beta times its benchmark&apos;s move, so against a benchmark that fell further the same fall looks normal. These are associations around a date; neither comparison says why the stocks moved.</p>
      </Section>

      {cc && (
        <Section id="company" title={`Company implications: ${cc.company}`} href={`${base}/impact`} linkLabel="Full company case">
          <p>{cc.question}</p>
          <ul className="space-y-1.5 text-[13.5px]">
            {keyFigures.map((f) => (
              <li key={f.id}>
                <span className="text-ink-muted">{f.label}:</span>{" "}
                <Link href={`${base}/impact#fig-${f.id}`} className={`num font-medium hover:underline ${f.value === null ? "text-amber-800" : "text-ink"}`}>
                  {formatFigure(f)}
                </Link>{" "}
                <span className="text-[12px] text-ink-soft">
                  ({f.basis === "derived" ? "derived from disclosed figures" : f.value === null ? "not in the documents read" : "disclosed"}; {f.period})
                </span>
                {f.qualification && <span className="block text-[12px] text-ink-muted">{f.qualification}</span>}
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            {cc.channels.slice(0, 2).map((ch) => (
              <li key={ch.channel} className="text-[13.5px]">
                <span className="font-medium">{CHANNEL_NAME[ch.channel]}:</span> <span className="text-ink-muted">{ch.read}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13.5px]">
            <span className="font-medium">Expectation gap:</span> <span className="text-ink-muted">{cc.expectationGap.reference ? cc.expectationGap.gap : cc.expectationGap.note}</span>
          </p>
        </Section>
      )}

      {explanations.length > 0 && (
        <Section id="explanations" title="Competing explanations of the decline, as tests" href={`${base}/evidence`} linkLabel="Evidence">
          <ul className="space-y-3">
            {explanations.map((x) => (
              <li key={x.id}>
                <span className="font-medium">{x.label}.</span> <span className="text-ink-muted">{x.summary}</span>
                {x.expectIfTrue && (
                  <span className="block text-[13px] text-ink-muted">
                    <span className="text-ink-soft">If true, expect: </span>
                    {x.expectIfTrue}
                  </span>
                )}
                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[12.5px] text-ink-soft">
                  For: <ResolvedRefs refs={refs(x.supportedBy)} caseSlug={c.slug} empty="nothing yet" /> · Against: <ResolvedRefs refs={refs(x.challengedBy)} caseSlug={c.slug} empty="nothing recorded" />
                  {x.inconclusive?.length ? (
                    <>
                      {" "}
                      · Inconclusive: <ResolvedRefs refs={refs(x.inconclusive)} caseSlug={c.slug} />
                    </>
                  ) : null}
                </span>
                {x.nextStep && (
                  <span className="block text-[13px] text-ink">
                    <span className="text-ink-soft">Next: </span>
                    {x.nextStep}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-muted">None is marked as the cause, and they are not mutually exclusive. Inconclusive means a check found no statistically distinguishable move under the current benchmark and model, which neither supports nor rules out the explanation.</p>
        </Section>
      )}

      {a && (
        <Section id="would-change" title="What would change the view" href="/theses" linkLabel="Thesis monitor">
          <ul className="space-y-1.5">
            {a.wouldChange.map((x) => (
              <li key={x.text}>
                · {x.text} {x.refs.length > 0 && <ResolvedRefs refs={refs(x.refs)} caseSlug={c.slug} />}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-muted">A price move alone can only send a thesis to review; it cannot weaken or invalidate it.</p>
        </Section>
      )}

      <Section id="next-action" title="Next research action" href={`${base}/impact`} linkLabel="Channel-check plan">
        <p className="font-medium">{cc?.nextAction ?? a?.nextStep ?? "Not yet set."}</p>
        {c.channelChecks?.length ? (
          <p className="text-[13.5px] text-ink-muted">
            {c.channelChecks.length} channel checks are planned and none has been done. Each is tied to a hypothesis, and each would ask only for public or non-confidential information after compliance screening.
          </p>
        ) : null}
      </Section>

      {/* What changed, then the original record */}
      {a && a.changes.length > 0 && (
        <Section id="what-changed" title="What changed since the original thesis">
          <ul className="space-y-1.5">
            {a.changes.map((x) => (
              <li key={x.text} className="text-[13.5px]">
                <span className="num text-[12px] text-ink-soft">{date(x.at)}</span> · {x.text} {x.refs.length > 0 && <ResolvedRefs refs={refs(x.refs)} caseSlug={c.slug} />}
              </li>
            ))}
          </ul>
          {(c.assessmentHistory ?? []).map((h) => (
            <div key={h.at} className="border-l-2 border-line pl-3 text-[13px] text-ink-muted">
              <p className="text-[12px] text-ink-soft">
                Superseded assessment, <When iso={h.at} /> (history, not the current view):
              </p>
              <p className="mt-0.5">{h.view}</p>
              <p className="mt-0.5 text-[12.5px]">{h.interpretation.reason}</p>
            </div>
          ))}
        </Section>
      )}

      {theses.length > 0 && (
        <Section id="history" title="Original theses and their history" href="/theses" linkLabel="Thesis tracker">
          {theses.map((t) => (
            <div key={t.replay.thesis.id} className="border-l-2 border-line pl-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/theses#${t.replay.thesis.id}`} className="font-medium text-ink hover:text-accent">
                  {t.replay.thesis.title}
                </Link>
                <ThesisStatusChip status={t.replay.status} />
                <OriginChip origin={t.replay.thesis.origin} />
              </div>
              <p className="mt-1 text-[12.5px] text-ink-soft">As published, unchanged:</p>
              <p className="text-[13.5px] text-ink-muted">{t.replay.thesis.statement}</p>
              {t.assessments
                .filter((x) => x.target === "statement")
                .map((x) => (
                  <p key={x.at} className="mt-1.5 border-l-2 border-amber-600 pl-2 text-[12.5px] text-ink-muted">
                    <span className="font-medium text-amber-900">Dated note on the statement ({date(x.at)}):</span> <CitedProse text={x.note} caseSlug={c.slug} />
                  </p>
                ))}
              <p className="mt-1 text-[12px] text-ink-soft">
                {t.replay.revisions.length} revision{t.replay.revisions.length === 1 ? "" : "s"} replayed from evidence
                {t.ruleFindings.length > 0 && ` · ${t.ruleFindings.length} trigger wording issue${t.ruleFindings.length === 1 ? "" : "s"} under current rules`}.
              </p>
            </div>
          ))}
        </Section>
      )}

      {/* Details */}
      <div className="mt-2 border-b border-line">
        <h2 className="pt-4 text-[13px] font-semibold text-ink-soft">Details</h2>
        <Details summary="Market response by industry group, against both benchmarks">
          {views.map((v) => {
            const groups = [...new Set(v.studies.filter((s) => s.benchmark).map((s) => groupOf(s.symbol)))];
            const hasEw = Object.keys(v.equalWeight).length > 0;
            const sensitivity = benchmarkSensitivity(v);
            return (
              <div key={v.spec.id}>
                <h3 className="text-[13px] font-medium text-ink-soft">
                  {v.spec.label} · day 0 {v.studies.find((s) => s.day0)?.day0}
                </h3>
                <div className="-mx-4 mt-1 overflow-x-auto md:mx-0">
                  <table className="w-full min-w-[600px] text-[12.5px]" aria-label={`Day-0 reaction by group: ${v.spec.label}`}>
                    <thead className="border-b border-line text-[11.5px] text-ink-soft">
                      <tr>
                        <th scope="col" className="px-4 py-1.5 text-left font-medium md:pl-0">Group (members)</th>
                        <th scope="col" className="px-2 py-1.5 text-right font-medium">Raw day 0</th>
                        <th scope="col" className="px-2 py-1.5 text-right font-medium">Beyond own benchmark</th>
                        {hasEw && <th scope="col" className="px-2 py-1.5 text-right font-medium md:pr-0">Beyond equal-weight S&amp;P</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => {
                        const members = v.studies.filter((s) => s.benchmark && groupOf(s.symbol) === g);
                        const own = members.map((s) => s.windows[0]).filter((w) => w?.abnormal != null);
                        const ew = members.map((s) => v.equalWeight[s.symbol]?.windows[0]).filter((w) => w?.abnormal != null);
                        const raw = mean(members.map((s) => s.windows[0]?.raw).filter((x): x is number => x != null));
                        const ownMean = mean(own.map((w) => w!.abnormal!));
                        const ewMean = mean(ew.map((w) => w!.abnormal!));
                        return (
                          <tr key={g} className="border-b border-line last:border-0">
                            <th scope="row" className="px-4 py-1.5 text-left font-normal text-ink md:pl-0">
                              {g} <span className="text-[11.5px] text-ink-soft">({members.map((m) => m.symbol).join(", ")})</span>
                            </th>
                            <td className={`num px-2 py-1.5 text-right ${tone(raw)}`}>{pct(raw)}</td>
                            <td className={`num px-2 py-1.5 text-right ${tone(ownMean)}`}>
                              {pct(ownMean)} <span className="text-[11px] text-ink-soft">{own.filter((w) => w!.significant).length}/{own.length} beyond noise</span>
                            </td>
                            {hasEw && (
                              <td className={`num px-2 py-1.5 text-right md:pr-0 ${tone(ewMean)}`}>
                                {ew.length ? (
                                  <>
                                    {pct(ewMean)} <span className="text-[11px] text-ink-soft">{ew.filter((w) => w!.significant).length}/{ew.length} beyond noise</span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sensitivity && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{sensitivity}</p>}
              </div>
            );
          })}
          <p className="text-[12.5px] text-ink-muted">Equal-weighted means of the same dates and instruments; the count is members whose own move passed both significance checks (t-statistic and placebo rank) against that benchmark.</p>
        </Details>

        <Details summary="Evidence base: claims, corrections and unread sources">
          <p className="flex flex-wrap items-center gap-1.5 text-ink-muted">
            {allClaims.length} claims across {c.events.length} events:
            {counts.map(([v, n]) => (
              <span key={v} className="inline-flex items-center gap-1">
                <VerificationChip state={v} /> <span className="num text-[12.5px]">{n}</span>
              </span>
            ))}
          </p>
          <p className="text-[12.5px] text-ink-muted">
            {unread.length > 0 && `Not read, and supporting nothing: ${unread.map((s) => s.publisher).join(", ")}. `}
            {corrected > 0 && `${corrected} claim${corrected === 1 ? " was" : "s were"} corrected after a second reading of the sources; each correction is shown on its claim. `}
            &ldquo;Confirmed&rdquo; for a company statement means the company said it, not that the substance was checked.
          </p>
          <Link href={`${base}/evidence`} className="text-[12.5px] text-accent hover:underline">
            Every claim, with its id and sources
          </Link>
        </Details>

        <Details summary="Scenarios and forecasts (method checks, not event estimates)">
          <p className="text-ink-muted">
            The scenarios are written cases with no probabilities. The forecast ranges are generic historical-volatility ranges for each instrument; they are not conditioned on this event, so they do not quantify its impact. Only live forecasts were recorded before their outcome; backfilled ones are reconstructions.
          </p>
          <p className="flex flex-wrap gap-x-4 text-[12.5px]">
            <Link href={`${base}/scenarios`} className="text-accent hover:underline">
              Scenarios
            </Link>
            <Link href="/forecasts" className="text-accent hover:underline">
              Forecast scorecard
            </Link>
            <Link href={`${base}/memo`} className="text-accent hover:underline">
              Research memo
            </Link>
          </p>
        </Details>
      </div>
    </div>
  );
}
