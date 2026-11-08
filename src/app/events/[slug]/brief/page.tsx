import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CitedProse, EvidenceRefs, OriginChip, ThesisStatusChip, VerificationChip, pct, tone } from "@/components/events/EventUI";
import { caseBySlug, instrument } from "@/data/events";
import { caseMetadata } from "@/lib/events/caseMetadata";
import type { VerificationState } from "@/lib/events/types";
import { benchmarkSensitivity, eventView, impacts, thesisViews, windowView } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) =>
  caseMetadata(params, "Research brief", "The case in six steps: question, industry impact, evidence, competing explanations, implications, and what would change the conclusion.");

const ORDER: VerificationState[] = ["CONFIRMED", "CORROBORATED", "REPORTED", "RUMOR", "DISPUTED"];
const NET_LABEL = { positive: "up", negative: "down", ambiguous: "mixed", unsupported: "no evidence" } as const;

function Step({ n, title, href, linkLabel, children }: { n: number; title: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line py-5 md:grid-cols-[52px_1fr] md:gap-5" aria-labelledby={`step-${n}`}>
      <div className="num text-[28px] font-semibold leading-none text-accent md:text-[32px]" aria-hidden>
        {n}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={`step-${n}`} className="text-[19px] font-semibold leading-snug text-ink">
            {title}
          </h2>
          <Link href={href} className="text-[12.5px] text-accent hover:underline">
            {linkLabel}
          </Link>
        </div>
        <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-ink">{children}</div>
      </div>
    </section>
  );
}

export default async function EventBriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const base = `/events/${c.slug}`;
  const primary = eventView(c.primaryEventId);
  const theses = thesisViews().filter((t) => t.replay.thesis.caseId === c.id);
  const lead = theses[0];
  const allClaims = c.events.flatMap((e) => eventView(e.id)?.claims ?? []);
  const counts = ORDER.map((v) => [v, allClaims.filter((x) => x.verification === v).length] as const).filter(([, n]) => n > 0);
  const core = primary ? primary.claims.filter((x) => primary.event.coreClaimIds.includes(x.id)) : [];
  const corrected = c.claims.filter((x) => x.corrections?.length).length;
  const unread = c.sources.filter((s) => s.retrieval !== "read");

  // Industry impact: the primary event's windows plus the window the impact map is checked against.
  const windowIds = [...new Set([...c.windows.filter((w) => w.eventId === c.primaryEventId).map((w) => w.id), c.graphWindowId])];
  const views = windowIds
    .map((id) => windowView(c, id))
    .filter((v) => v !== null)
    .sort((a, b) => (a.studies.find((s) => s.day0)?.day0 ?? "").localeCompare(b.studies.find((s) => s.day0)?.day0 ?? ""));
  const mapBySymbol = new Map(impacts(c).filter((i) => i.ticker).map((i) => [i.ticker!, i]));
  const groupOf = (sym: string) => c.groups[sym] ?? instrument(sym)?.group ?? "Other";
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const weaken = lead ? lead.replay.thesis.triggers.filter((t) => t.effect !== "strengthen") : [];
  const base0 = c.scenarios.find((s) => s.case === "base");

  return (
    <div className="mx-auto max-w-[960px]">
      <header className="pb-4">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          The whole case in six steps, each about thirty seconds, with a link to the evidence behind it. Statements of fact trace to sources; interpretation is labelled; nothing here is a price target or a probability.
        </p>
      </header>

      <Step n={1} title="The research question" href={base} linkLabel="Overview">
        <p className="font-serif text-[20px] leading-snug text-ink md:text-[22px]">{lead?.replay.thesis.question ?? c.dek}</p>
        {primary && (
          <p className="text-ink-muted">
            Trigger event: <span className="text-ink">{primary.event.title}</span>. Sourcing as of today: <VerificationChip state={primary.verification} title={primary.confidenceReason} />{" "}
            <span className="text-[12.5px]">({primary.confidence} confidence)</span>
          </p>
        )}
      </Step>

      <Step n={2} title="Where it hit, by industry" href={`${base}/market`} linkLabel="Market reaction">
        {views.map((v) => {
          const groups = [...new Set(v.studies.filter((s) => s.benchmark).map((s) => groupOf(s.symbol)))];
          const hasEw = Object.keys(v.equalWeight).length > 0;
          const owns = [...new Set(v.studies.map((s) => s.benchmark).filter(Boolean))].sort().join(" or ");
          const sensitivity = benchmarkSensitivity(v);
          return (
            <div key={v.spec.id}>
              <h3 className="text-[13px] font-medium text-ink-soft">
                {v.spec.label} · day 0 {v.studies.find((s) => s.day0)?.day0}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Beyond noise against own benchmark ({owns}): <span className="num font-medium text-ink">{v.day0Tests.significant} of {v.day0Tests.run}</span>
                {hasEw && (
                  <>
                    {" "}· against the equal-weight S&amp;P 500 (RSP): <span className="num font-medium text-ink">{v.day0TestsEqualWeight.significant} of {v.day0TestsEqualWeight.run}</span>
                  </>
                )}
                {" "}· about {v.day0Tests.expectedByChance.toFixed(1)} expected by chance
              </p>
              <div className="-mx-4 mt-1 overflow-x-auto md:mx-0">
                <table className="w-full min-w-[560px] text-[12.5px]" aria-label={`Day-0 reaction by group: ${v.spec.label}`}>
                  <thead className="border-b border-line text-[11.5px] text-ink-soft">
                    <tr>
                      <th scope="col" className="px-4 py-1.5 text-left font-medium md:pl-0">Group</th>
                      <th scope="col" className="px-2 py-1.5 text-right font-medium">vs own benchmark</th>
                      {hasEw && <th scope="col" className="px-2 py-1.5 text-right font-medium">vs equal-weight S&amp;P</th>}
                      <th scope="col" className="px-2 py-1.5 text-left font-medium md:pr-0">Impact map expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const members = v.studies.filter((s) => s.benchmark && groupOf(s.symbol) === g);
                      const own = members.map((s) => s.windows[0]).filter((w) => w?.abnormal != null);
                      const ew = members.map((s) => v.equalWeight[s.symbol]?.windows[0]).filter((w) => w?.abnormal != null);
                      const nets = [...new Set(members.map((s) => mapBySymbol.get(s.symbol)?.net).filter((x) => x !== undefined))];
                      const ownMean = mean(own.map((w) => w!.abnormal!));
                      const ewMean = mean(ew.map((w) => w!.abnormal!));
                      return (
                        <tr key={g} className="border-b border-line last:border-0">
                          <th scope="row" className="px-4 py-1.5 text-left font-normal text-ink md:pl-0" title={members.map((m) => m.symbol).join(", ")}>
                            {g}
                          </th>
                          <td className={`num px-2 py-1.5 text-right ${tone(ownMean)}`}>
                            {pct(ownMean)} <span className="text-[11px] text-ink-soft">{own.filter((w) => w!.significant).length}/{own.length}</span>
                          </td>
                          {hasEw && (
                            <td className={`num px-2 py-1.5 text-right ${tone(ewMean)}`}>
                              {ew.length ? (
                                <>
                                  {pct(ewMean)} <span className="text-[11px] text-ink-soft">{ew.filter((w) => w!.significant).length}/{ew.length}</span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-ink-muted md:pr-0">{nets.length ? nets.map((x) => NET_LABEL[x!]).join(" / ") : "not on the map"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sensitivity && v.day0TestsEqualWeight.significant !== v.day0Tests.significant && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{sensitivity}</p>}
            </div>
          );
        })}
        <p className="text-[12.5px] text-ink-muted">
          Equal-weighted group means; the small figure counts members whose own move passed both significance checks against that benchmark. Neither benchmark is the right one: where the two disagree, the result is sensitive to the benchmark and should be read that way. These are associations around a date, not proof of cause.
        </p>
      </Step>

      <Step n={3} title="What the evidence establishes" href={`${base}/evidence`} linkLabel="Evidence & timeline">
        <p className="flex flex-wrap items-center gap-1.5 text-ink-muted">
          {allClaims.length} claims across {c.events.length} event{c.events.length === 1 ? "" : "s"}:
          {counts.map(([v, n]) => (
            <span key={v} className="inline-flex items-center gap-1">
              <VerificationChip state={v} /> <span className="num text-[12.5px]">{n}</span>
            </span>
          ))}
        </p>
        {core.length > 0 && (
          <ul className="space-y-2">
            {core.map((x) => (
              <li key={x.id} className="flex gap-2">
                <span className="shrink-0 pt-0.5">
                  <VerificationChip state={x.verification} title={x.verificationReason} />
                </span>
                <span>
                  {x.statement} <EvidenceRefs ids={[x.id]} caseSlug={c.slug} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12.5px] text-ink-muted">
          {unread.length > 0 && `Not read and supporting nothing: ${unread.map((s) => s.publisher).join(", ")}. `}
          {corrected > 0 && `${corrected} claim${corrected === 1 ? " was" : "s were"} corrected after a second reading of the sources; each correction is shown on its claim.`}
        </p>
      </Step>

      <Step n={4} title="Competing explanations" href={base} linkLabel="Overview">
        {primary?.event.competingExplanations.length ? (
          <ul className="space-y-2.5">
            {primary.event.competingExplanations.map((x) => (
              <li key={x.id}>
                <span className="font-medium text-ink">{x.label}.</span> <span className="text-ink-muted">{x.summary}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] text-ink-soft">
                  For: <EvidenceRefs ids={x.supportedBy} caseSlug={c.slug} empty="nothing yet" /> · Against: <EvidenceRefs ids={x.challengedBy} caseSlug={c.slug} empty="nothing recorded" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">No competing explanations recorded for the primary event.</p>
        )}
        <p className="text-[12.5px] text-ink-muted">None is marked as the cause: one day of prices cannot separate drivers that arrive together.</p>
      </Step>

      <Step n={5} title="What it means for the research view" href="/theses" linkLabel="Thesis tracker">
        <p className="text-[12.5px] font-medium text-amber-800">Analyst interpretation. Not investment advice; no price targets or probabilities.</p>
        {theses.map((t) => (
          <div key={t.replay.thesis.id} className="border-l-2 border-line pl-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/theses#${t.replay.thesis.id}`} className="font-medium text-ink hover:text-accent">
                {t.replay.thesis.title}
              </Link>
              <ThesisStatusChip status={t.replay.status} />
              <OriginChip origin={t.replay.thesis.origin} />
            </div>
            <p className="mt-1 text-ink-muted">{t.replay.thesis.statement}</p>
            {t.assessments
              .filter((a) => a.target === "statement")
              .map((a) => (
                <p key={a.at} className="mt-1.5 border-l-2 border-amber-600 pl-2 text-[12.5px] text-ink-muted">
                  <span className="font-medium text-amber-900">Current assessment:</span> <CitedProse text={a.note} caseSlug={c.slug} />
                </p>
              ))}
            {t.ruleFindings.length > 0 && (
              <p className="mt-1 text-[12px] text-ink-soft">
                {t.ruleFindings.length} trigger wording issue{t.ruleFindings.length === 1 ? "" : "s"} under current rules;{" "}
                <Link href={`/theses#${t.replay.thesis.id}`} className="text-accent hover:underline">
                  see the thesis
                </Link>
                .
              </p>
            )}
          </div>
        ))}
        {c.scenarios.length > 0 && (
          <p className="text-[12.5px] text-ink-muted">
            Scenarios, unweighted: {c.scenarios.map((s) => `${s.case} — ${s.title.toLowerCase()}`).join("; ")}.{" "}
            <Link href={`${base}/scenarios`} className="text-accent hover:underline">
              See scenarios
            </Link>
          </p>
        )}
      </Step>

      <Step n={6} title="What would change the conclusion" href="/theses" linkLabel="Triggers">
        {weaken.length > 0 && (
          <ul className="space-y-1.5">
            {weaken.map((t) => (
              <li key={t.id} className="flex gap-2">
                <span className={`shrink-0 text-[12px] font-medium ${t.effect === "invalidate" ? "text-rose-800" : t.effect === "weaken" ? "text-amber-800" : "text-ink-soft"}`}>{t.effect}</span>
                <span>
                  {t.description}. <span className="text-ink-muted">{t.explanation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {base0 && base0.invalidation.length > 0 && (
          <div>
            <h3 className="text-[13px] font-medium text-ink-soft">The base case breaks if</h3>
            <ul className="mt-1 space-y-1 text-ink-muted">
              {base0.invalidation.map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
        )}
        {primary && primary.event.openQuestions.length > 0 && (
          <div>
            <h3 className="text-[13px] font-medium text-ink-soft">Open questions</h3>
            <ul className="mt-1 space-y-1 text-ink-muted">
              {primary.event.openQuestions.map((q) => (
                <li key={q}>
                  · <CitedProse text={q} caseSlug={c.slug} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[12.5px] text-ink-muted">A price move alone can only send a thesis to review; it cannot weaken or invalidate it.</p>
      </Step>
    </div>
  );
}
