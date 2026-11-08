import Link from "next/link";
import { CitedProse, EvidenceRefs, OriginChip, ThesisStatusChip, When, pct, tone } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import PageHeader from "@/components/layout/PageHeader";
import { THESIS_RULES_V2_FROM } from "@/lib/events/thesis";
import { PLATFORM_AS_OF, thesisViews } from "@/lib/events/view";

export const metadata = {
  title: "Thesis tracker",
  description: "Research theses with their original wording, assumptions, revision history, invalidation triggers and realized outcomes.",
};

const EFFECT_STYLE = { strengthen: "text-emerald-700", weaken: "text-amber-800", invalidate: "text-rose-800", review: "text-amber-900" } as const;

export default function ThesisTrackerPage() {
  const views = thesisViews();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Event intelligence"
        title="Thesis tracker"
        subtitle="Every thesis keeps its original wording. Its history is replayed from the evidence: a revision appears only when one of the thesis's own triggers fires, with the reason and what the earlier view got wrong. Evidence that touches no trigger is logged and left alone, and a price move alone can only prompt a review."
      />
      <Note>
        <strong>Worked examples versus live theses.</strong> Theses marked backfill were written on 8 Nov 2026 using only sources dated before their cutoff, to show the revision engine on real events. Their author knew what came later, so they are not a track record. Live theses count evidence from when the platform recorded it, so later additions cannot rewrite their past.
      </Note>

      {views.map((v) => {
        const t = v.replay.thesis;
        return (
          <section key={t.id} id={t.id} className="scroll-mt-20">
            <Panel
              eyebrow={`${t.id} · ${t.horizonLabel}`}
              title={t.title}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <ThesisStatusChip status={v.replay.status} />
                  <OriginChip origin={t.origin} />
                </div>
              }
              source={
                <>
                  Ledger: {v.integrity.recorded ? (v.integrity.matches ? "original recorded and unchanged (content hash matches)" : "CHANGED since recording — treat as a new thesis") : "not yet recorded"} · replayed as of <When iso={PLATFORM_AS_OF} /> ·{" "}
                  <Link href={`/events/${v.caseSlug}`} className="text-accent hover:underline">case</Link>
                </>
              }
            >
              <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  <div className="text-[12.5px] font-medium text-ink-soft">Question</div>
                  <p className="mt-0.5 text-[14px] text-ink">{t.question}</p>
                  <div className="mt-3 text-[12.5px] font-medium text-ink-soft">
                    Original thesis, as published <When iso={t.publishedAt} /> (information cutoff <When iso={t.informationCutoff} />)
                  </div>
                  <blockquote className="mt-1 border-l-2 border-accent/50 pl-3 font-serif text-[16.5px] leading-relaxed text-ink">{t.statement}</blockquote>
                  {t.originNote && <p className="mt-2 text-[12.5px] italic text-ink-muted">{t.originNote}</p>}
                  {(v.assessments.length > 0 || v.ruleFindings.length > 0) && (
                    <div className="mt-3 border-l-2 border-amber-600 bg-amber-50/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
                      <div className="font-medium text-amber-900">Current assessment (the original above is unchanged)</div>
                      <ul className="mt-1 space-y-1.5">
                        {v.assessments.map((a) => (
                          <li key={a.target + a.at}>
                            <span className="font-medium text-ink">{a.target === "statement" ? "Statement" : a.target.replace("trigger:", "Trigger ")}, <When iso={a.at} precision="day" />:</span> <CitedProse text={a.note} caseSlug={v.caseSlug} />
                          </li>
                        ))}
                        {v.ruleFindings.map((f) => (
                          <li key={f}>
                            <span className="font-medium text-ink">Trigger wording rules now in force:</span> {f}. These rules bind theses published from <When iso={THESIS_RULES_V2_FROM} precision="day" />; this one predates them and keeps its triggers.
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[12.5px] font-medium text-ink-soft">Assumptions</div>
                  <ul className="mt-1 space-y-1.5 text-[13px]">
                    {v.replay.assumptions.map((a) => (
                      <li key={a.id} className="flex gap-2">
                        <span className={`mt-0.5 shrink-0 text-[11px] font-semibold ${a.holds === null ? "text-ink-soft" : a.holds ? "text-emerald-700" : "text-rose-800"}`}>{a.holds === null ? "untested" : a.holds ? "holding" : "broken"}</span>
                        <span className="text-ink">{a.text}{a.critical && <span className="text-ink-soft"> (critical)</span>}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-[12.5px] font-medium text-ink-soft">Evidence at publication</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-ink-muted">
                    For <EvidenceRefs ids={t.supportingClaimIds} caseSlug={v.caseSlug} /> · against <EvidenceRefs ids={t.contradictingClaimIds} caseSlug={v.caseSlug} />
                  </div>
                </div>
              </div>

              <h3 className="section-label mt-6">Revision history</h3>
              {v.replay.revisions.length === 0 ? (
                <p className="mt-1 text-[13px] text-ink-muted">No trigger has fired since publication. {v.replay.immaterialClaims.length ? `${v.replay.immaterialClaims.length} new claim(s) were reviewed and changed nothing.` : ""}</p>
              ) : (
                <ol className="mt-2 space-y-3">
                  {v.replay.revisions.map((r) => (
                    <li key={r.seq} className="rounded-md border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="num text-ink-soft">#{r.seq}</span>
                        <When iso={r.at} />
                        <ThesisStatusChip status={r.from} />
                        <span className="text-ink-soft">→</span>
                        <ThesisStatusChip status={r.to} />
                        {r.reconstructed && <span className="text-[11.5px] text-ink-soft">reconstructed</span>}
                      </div>
                      {r.fired.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
                          {r.fired.map((f) => (
                            <li key={f.id}>
                              <span className={`font-medium ${EFFECT_STYLE[f.effect]}`}>{f.effect}</span> <span className="text-ink">{f.description}</span>{" "}
                              <EvidenceRefs ids={f.evidence.filter((id) => !id.startsWith("OBS-"))} caseSlug={v.caseSlug} empty="" />
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{r.explanation}</p>
                      {r.lessons.map((l) => (
                        <p key={l} className="mt-1 text-[12.5px] text-rose-800">What the earlier view got wrong: {l}</p>
                      ))}
                      {r.reviewedWithoutChange.length > 0 && <p className="mt-1 text-[12px] text-ink-soft">Also arrived and changed nothing: {r.reviewedWithoutChange.join(", ")}</p>}
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="section-label">Triggers still open</h3>
                  <ul className="mt-1.5 space-y-1 text-[12.5px]">
                    {v.replay.pendingTriggers.map((tr) => (
                      <li key={tr.id}>
                        <span className={`font-medium ${EFFECT_STYLE[tr.effect]}`}>{tr.effect}</span> <span className="text-ink">{tr.description}</span>
                        {tr.condition.kind === "market" && <span className="text-ink-soft"> (price: review only)</span>}
                      </li>
                    ))}
                    {v.replay.pendingTriggers.length === 0 && <li className="text-ink-muted">None.</li>}
                  </ul>
                  <h3 className="section-label mt-4">Monitoring</h3>
                  <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-muted">
                    {t.monitor.map((m) => (
                      <li key={m.label}><span className="text-ink">{m.label}:</span> {m.detail}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="section-label">Outcome</h3>
                  <p className={`mt-1.5 text-[13px] ${v.outcome.state === "right" ? "text-emerald-700" : v.outcome.state === "wrong" ? "text-rose-800" : "text-ink-muted"}`}>
                    <span className="font-semibold capitalize">{v.outcome.state}</span> — {v.outcome.detail}
                  </p>
                  {v.postHorizonClaims.length > 0 && (
                    <p className="mt-2 text-[12.5px] text-ink-muted">
                      Arrived after the horizon closed (for the post-mortem, not the record): <EvidenceRefs ids={v.postHorizonClaims} caseSlug={v.caseSlug} />
                    </p>
                  )}
                  {v.forecasts.length > 0 && (
                    <>
                      <h3 className="section-label mt-4">Linked forecasts</h3>
                      <ul className="mt-1.5 space-y-1 text-[12.5px]">
                        {v.forecasts.slice(0, 8).map((f) => (
                          <li key={f.record.id} className="flex flex-wrap items-center gap-x-2">
                            <span className="num font-medium text-ink">{f.record.instrument} {f.record.horizon}d</span>
                            {f.score.status === "scored" ? (
                              <>
                                <span className={`num ${tone(f.score.realized)}`}>{pct(f.score.realized)}</span>
                                <span className="text-ink-muted">{f.score.inInterval ? "inside" : "outside"} its 80% range</span>
                              </>
                            ) : (
                              <span className="text-ink-muted">{f.score.note}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {v.forecasts.length > 8 && <Link href="/forecasts" className="mt-1 block text-[12.5px] text-accent hover:underline">All {v.forecasts.length} on the scorecard →</Link>}
                    </>
                  )}
                </div>
              </div>
            </Panel>
          </section>
        );
      })}
    </div>
  );
}
