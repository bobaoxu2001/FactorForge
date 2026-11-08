import Link from "next/link";
import { notFound } from "next/navigation";
import { caseMetadata } from "@/lib/events/caseMetadata";
import { CitedProse, EpistemicChip, EvidenceRefs, LifecycleChip, ThesisStatusChip, VerificationChip, When } from "@/components/events/EventUI";
import { KeyFinding, Note, Panel } from "@/components/intel/ui";
import { caseBySlug } from "@/data/events";
import { EVENT_CATEGORIES } from "@/lib/events/categories";
import type { QuantityKind } from "@/lib/events/types";
import { quantityLedger } from "@/lib/events/verification";
import { eventView, thesisViews } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => caseMetadata(params, "Overview");

const QUANTITY_LABEL: Partial<Record<QuantityKind, string>> = {
  affected: "Affected",
  frozen: "Frozen or intercepted",
  replenished: "Replenished from company funds",
  recovered: "Actually recovered",
};

const money = (v: number, unit: string) => (unit === "USD" ? `US$${(v / 1e9).toFixed(2)}bn` : unit === "pct" ? `${(v * 100).toFixed(0)}%` : `${v.toLocaleString("en-US")} ${unit}`);

export default async function EventCaseOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const primary = eventView(c.primaryEventId);
  const theses = thesisViews().filter((t) => t.replay.thesis.caseId === c.id);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5 md:p-6">
          <div className="text-[12.5px] font-medium text-ink-soft">The research question</div>
          <KeyFinding className="mt-2">{c.theses[0]?.question ?? c.dek}</KeyFinding>
          <ul className="mt-4 space-y-1.5 text-[14px] leading-relaxed text-ink-muted">
            {c.researchQuestions.map((q) => (
              <li key={q} className="flex gap-2">
                <span className="text-ink-soft">·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5 md:p-6">
          <div className="text-[12.5px] font-medium text-ink-soft">Theses in this case</div>
          <ul className="mt-2 space-y-3">
            {theses.map((t) => (
              <li key={t.replay.thesis.id}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ThesisStatusChip status={t.replay.status} />
                  <span className="text-[12px] text-ink-soft">{t.replay.thesis.origin === "backfill" ? "worked example" : "live"}</span>
                </div>
                <Link href={`/theses#${t.replay.thesis.id}`} className="mt-1 block text-[15px] font-semibold leading-snug text-ink hover:text-accent">
                  {t.replay.thesis.title}
                </Link>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{t.replay.revisions.length} revision{t.replay.revisions.length === 1 ? "" : "s"} · {t.replay.pendingTriggers.length} triggers still open</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {c.events.map((e) => {
        const v = eventView(e.id);
        if (!v) return null;
        const ledger = quantityLedger(v.claims, ["affected", "frozen", "replenished", "recovered"]).filter((l) => l.history.length || l.kind === "recovered");
        const showLedger = ledger.some((l) => l.history.length);
        const byState = (s: string) => v.claims.filter((x) => x.verification === s).length;
        return (
          <section key={e.id} id={e.id} className="scroll-mt-28">
            <Panel
              eyebrow={e.categories.map((k) => EVENT_CATEGORIES[k].label).join(" · ")}
              title={e.title}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <VerificationChip state={v.verification} title={v.confidenceReason} />
                  <LifecycleChip state={e.lifecycle} />
                </div>
              }
            >
              <p className="max-w-[80ch] text-[14.5px] leading-relaxed text-ink">{e.summary}</p>
              <dl className="mt-4 grid gap-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-ink-soft">Occurred</dt><dd className="text-ink"><When iso={e.occurredAt} precision={e.occurredPrecision} /></dd></div>
                <div><dt className="text-ink-soft">First published (sources read)</dt><dd className="text-ink">{v.firstPublishedAt ? <When iso={v.firstPublishedAt} /> : "—"}</dd></div>
                <div><dt className="text-ink-soft">Last verified</dt><dd className="text-ink">{v.lastVerifiedAt ? <When iso={v.lastVerifiedAt} /> : "—"}</dd></div>
                <div><dt className="text-ink-soft">Confidence</dt><dd className="text-ink">{v.confidence} — <span className="text-ink-muted">{v.confidenceReason}</span></dd></div>
              </dl>
              <p className="mt-3 text-[12.5px] text-ink-muted">
                Claims: {byState("CONFIRMED")} confirmed · {byState("CORROBORATED")} corroborated · {byState("REPORTED")} reported · {byState("RUMOR")} rumour · {byState("DISPUTED")} disputed.{" "}
                <Link href={`/events/${c.slug}/evidence`} className="text-accent hover:underline">See every claim and source →</Link>
              </p>
              <p className="mt-1 text-[12.5px] text-ink-muted">Entities: {e.entities.map((x) => `${x.name} (${x.role}${x.listed ? `, ${x.ticker}` : ", not listed"})`).join("; ")}.</p>

              {showLedger && (
                <div className="mt-5">
                  <h3 className="section-label">Amounts, kept apart</h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <thead className="text-[12px] text-ink-soft">
                        <tr className="border-b border-line">
                          <th scope="col" className="py-1.5 pr-3 font-medium">Measure</th>
                          <th scope="col" className="py-1.5 pr-3 font-medium">Latest figure</th>
                          <th scope="col" className="py-1.5 pr-3 font-medium">As of</th>
                          <th scope="col" className="py-1.5 font-medium">Earlier figures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((l) => (
                          <tr key={l.kind} className="border-b border-line last:border-0 align-top">
                            <td className="py-2 pr-3 text-ink">{QUANTITY_LABEL[l.kind] ?? l.kind}</td>
                            <td className="py-2 pr-3">
                              {l.latest ? (
                                <span className="num font-semibold text-ink">
                                  {l.latest.quantity.lowerBound ? "> " : l.latest.quantity.approximate ? "≈ " : ""}
                                  {money(l.latest.quantity.value, l.latest.quantity.unit)} <EvidenceRefs ids={[l.latest.claimId]} caseSlug={c.slug} />
                                </span>
                              ) : (
                                <span className="font-medium text-amber-800">Unknown — no source gives it</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-ink-muted">{l.latest ? <When iso={l.latest.quantity.asOf} precision="day" /> : "—"}</td>
                            <td className="py-2 text-[12.5px] text-ink-muted">
                              {l.history.slice(0, -1).map((h) => (
                                <span key={h.claimId} className="mr-2 inline-flex items-center gap-1">
                                  {money(h.quantity.value, h.quantity.unit)} <EvidenceRefs ids={[h.claimId]} caseSlug={c.slug} />
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(ledger.find((l) => l.kind === "frozen")?.history.length ?? 0) > 1 && (
                    <p className="mt-2 text-[12px] text-ink-muted">Freezes reported by different parties are listed separately and never added together: the sources do not say whether they overlap. Replenishment from company funds is not recovery.</p>
                  )}
                </div>
              )}

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="section-label">Open questions</h3>
                  <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
                    {e.openQuestions.map((q) => (
                      <li key={q}>
                        · <CitedProse text={q} caseSlug={c.slug} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="section-label">Why it matters for research</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{e.researchImpact}</p>
                </div>
              </div>
            </Panel>
          </section>
        );
      })}

      {primary && primary.event.competingExplanations.length > 0 && (
        <Panel title="Competing explanations" eyebrow="Possible drivers, none proven" source="Claims on this case's evidence page and benchmark-adjusted returns on its market page.">
          <div className="grid gap-4 md:grid-cols-2">
            {primary.event.competingExplanations.map((x) => (
              <div key={x.id} className="rounded-md border border-line p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink">{x.label}</span>
                  <EpistemicChip value={x.epistemic} />
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{x.summary}</p>
                <div className="mt-2 text-[12.5px] text-ink-muted">
                  <div className="flex flex-wrap items-center gap-1">For: <EvidenceRefs ids={x.supportedBy} caseSlug={c.slug} /></div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">Against: <EvidenceRefs ids={x.challengedBy} caseSlug={c.slug} empty="nothing recorded yet" /></div>
                  {x.inconclusive?.length ? <div className="mt-1 flex flex-wrap items-center gap-1">Inconclusive: <EvidenceRefs ids={x.inconclusive} caseSlug={c.slug} /></div> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Note tone="warn">An explanation is a hypothesis until evidence separates it from the others. One day of prices cannot do that when several drivers arrive together, so none is marked as the cause. A market check listed as inconclusive found no statistically distinguishable move under the current benchmark and model; that neither supports nor rules out the explanation.</Note>
          </div>
        </Panel>
      )}
    </div>
  );
}
