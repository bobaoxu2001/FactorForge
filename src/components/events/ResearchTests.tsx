import type { ReactNode } from "react";
import type { ChannelCheck, ResearchCase } from "@/data/events/types";
import { COMPARISON_LABEL } from "@/lib/events/impact";
import type { CompetingExplanation } from "@/lib/events/types";
import { resolveRefs, testPriceCheck } from "@/lib/events/view";
import { ResolvedRefs } from "./EventUI";

/**
 * Hypotheses written as research tests: what would be observable if each were
 * true, what the evidence says so far, and what to check next. They are not
 * mutually exclusive, and a premise (that a restriction exists) is kept apart
 * from evidence that tests the mechanism.
 */
export function ResearchTestCard({ c, t }: { c: ResearchCase; t: CompetingExplanation }) {
  const refs = (ids: string[] | undefined) => resolveRefs(c, ids ?? []);
  const check = testPriceCheck(c, t);
  const row = (label: string, body: ReactNode) => (
    <div className="grid gap-0.5 sm:grid-cols-[150px_1fr] sm:gap-3">
      <dt className="text-[12px] font-medium text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-[13px] leading-relaxed text-ink-muted">{body}</dd>
    </div>
  );
  return (
    <article id={t.id} className="scroll-mt-28 rounded-md border border-line p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-[15px] font-semibold text-ink">{t.label}</h3>
        <span className="text-[12px] text-ink-soft">hypothesis · {t.id}</span>
      </div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{t.summary}</p>
      <dl className="mt-3 space-y-2">
        {t.mechanism && row("Mechanism", t.mechanism)}
        {t.expectIfTrue && row("If true, expect", t.expectIfTrue)}
        {t.premise?.length ? row("Starts from", <><ResolvedRefs refs={refs(t.premise)} caseSlug={c.slug} /> <span className="text-[12px] text-ink-soft">(premise: sets the question up, does not test it)</span></>) : null}
        {row("Supporting", <ResolvedRefs refs={refs(t.supportedBy)} caseSlug={c.slug} empty="nothing yet" />)}
        {row("Challenging", <ResolvedRefs refs={refs(t.challengedBy)} caseSlug={c.slug} empty="nothing recorded" />)}
        {t.inconclusive?.length ? row("Inconclusive", <><ResolvedRefs refs={refs(t.inconclusive)} caseSlug={c.slug} /> <span className="text-[12px] text-ink-soft">(no statistically distinguishable move: neither supports nor rules out)</span></>) : null}
        {check && row("Price check", <><span className="font-medium text-ink">{COMPARISON_LABEL[check.state]}.</span> {check.note}</>)}
        {t.wouldWeaken && row("Would weaken it", t.wouldWeaken)}
        {t.nextStep && row("Next step", <span className="text-ink">{t.nextStep}</span>)}
      </dl>
    </article>
  );
}

export function ResearchTests({ c, tests }: { c: ResearchCase; tests: CompetingExplanation[] }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {tests.map((t) => (
        <ResearchTestCard key={t.id} c={c} t={t} />
      ))}
    </div>
  );
}

/** Planned conversations, each tied to the hypotheses it would test. Planned is never shown as done. */
export function ChannelPlan({ checks, testLabels }: { checks: ChannelCheck[]; testLabels: Record<string, string> }) {
  return (
    <div>
      <div className="-mx-5 overflow-x-auto md:-mx-6">
        <table className="w-full min-w-[900px] text-left text-[12.5px]" aria-label="Channel-check plan">
          <thead className="border-b border-line text-[11.5px] text-ink-soft">
            <tr>
              <th scope="col" className="px-5 py-2 font-medium md:pl-6">Who</th>
              <th scope="col" className="px-2 py-2 font-medium">Why they could know</th>
              <th scope="col" className="px-2 py-2 font-medium">Question (open, non-leading)</th>
              <th scope="col" className="px-2 py-2 font-medium">Tests</th>
              <th scope="col" className="px-2 py-2 font-medium">Limits of their view</th>
              <th scope="col" className="px-2 py-2 font-medium md:pr-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((k) => (
              <tr key={k.id} className="border-b border-line align-top last:border-0">
                <td className="px-5 py-2 text-ink md:pl-6">{k.participant}</td>
                <td className="px-2 py-2 text-ink-muted">{k.whyTheyKnow}</td>
                <td className="px-2 py-2 text-ink">&ldquo;{k.question}&rdquo;</td>
                <td className="px-2 py-2 text-ink-muted">{k.tests.map((id) => testLabels[id] ?? id).join("; ")}</td>
                <td className="px-2 py-2 text-ink-muted">{k.limitations}</td>
                <td className="px-2 py-2 md:pr-6">
                  <span className="rounded border border-dashed border-ink/30 px-1.5 py-0.5 text-[11.5px] text-ink-muted">{k.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
        No call has been made; every row is a plan. Calls would go through the usual expert-network screening and compliance review, ask only for public or non-confidential information, and never for a company&apos;s confidential plans, contract terms or other material nonpublic information.
      </p>
    </div>
  );
}
