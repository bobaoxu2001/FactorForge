import Link from "next/link";
import { ClaimCard, LifecycleChip, OriginChip, ThesisStatusChip, VerificationChip, When, pct, tone } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import PageHeader from "@/components/layout/PageHeader";
import { ALL_SOURCES, caseOfEvent } from "@/data/events";
import { EVENT_CATEGORIES } from "@/lib/events/categories";
import { PLATFORM_AS_OF, RESEARCH_CASES, SNAPSHOT, eventViews, integrity, pricesThrough, scoredForecasts, thesisViews, windowView } from "@/lib/events/view";

export const metadata = {
  title: "Event radar",
  description: "Material events tracked for their effect on investment theses, with verification state, freshness, affected industries and measured market reaction.",
};

export default function EventRadarPage() {
  const events = eventViews().sort((a, b) => Date.parse(b.event.occurredAt) - Date.parse(a.event.occurredAt));
  const theses = thesisViews();
  const check = integrity();
  const issues = Object.values(check.caseIssues).flat().length + Object.values(check.graphIssues).flat().length + Object.values(check.thesisIssues).flat().length;
  const forecasts = scoredForecasts();
  const sources = new Map(ALL_SOURCES.map((s) => [s.id, s]));
  const through = pricesThrough();

  // Largest significant day-0 move per event (benchmark-adjusted), from the windows that measure it.
  // "Significant" means both the t-test and the placebo rank agree (see the market page).
  const headline = (eventId: string) => {
    const c = caseOfEvent(eventId);
    if (!c) return null;
    const views = c.windows.filter((w) => w.eventId === eventId).map((w) => windowView(c, w.id)).filter((v) => v !== null);
    const studies = views.flatMap((v) => v.studies);
    const sig = studies.filter((s) => s.benchmark && s.windows[0]?.significant).sort((a, b) => Math.abs(b.windows[0].abnormal!) - Math.abs(a.windows[0].abnormal!));
    // Benchmarks themselves (no benchmark of their own) carry the market-wide move.
    const market = studies.filter((s) => !s.benchmark && s.windows[0]?.significant).sort((a, b) => Math.abs(b.windows[0].raw!) - Math.abs(a.windows[0].raw!))[0] ?? null;
    // The same stocks against the equal-weight S&P 500, which the AI names do not dominate.
    const ew = views
      .flatMap((v) => Object.values(v.equalWeight))
      .filter((s) => studies.some((x) => x.symbol === s.symbol && x.benchmark) && s.windows[0]?.significant)
      .sort((a, b) => Math.abs(b.windows[0].abnormal!) - Math.abs(a.windows[0].abnormal!));
    return { measured: studies.length, top: sig[0] ?? null, count: sig.length, market, ewTop: ew[0] ?? null, ewCount: ew.length };
  };

  type Headline = ReturnType<typeof headline>;
  const reaction = (h: Headline) => (
    <>
      {h?.top ? (
        <>
          <span className="font-medium text-ink">{h.top.symbol}</span>{" "}
          <span className={`num font-semibold ${tone(h.top.windows[0].abnormal)}`}>{pct(h.top.windows[0].abnormal)}</span>
          <span className="text-ink-soft"> vs {h.top.benchmark} on {h.top.day0}</span>
          <div className="text-[11.5px] text-ink-soft">{h.count} of {h.measured} measured moved beyond noise</div>
        </>
      ) : h?.market ? (
        <>
          <span className="font-medium text-ink">{h.market.symbol}</span>{" "}
          <span className={`num font-semibold ${tone(h.market.windows[0].raw)}`}>{pct(h.market.windows[0].raw)}</span>
          <span className="text-ink-soft"> on {h.market.day0}</span>
          <div className="text-[11.5px] text-ink-soft">No stock moved beyond its own benchmark ({h.measured} measured)</div>
          {h.ewTop && (
            <div className="text-[11.5px] text-ink-muted">
              Against the equal-weight S&amp;P 500, {h.ewCount} did, led by {h.ewTop.symbol}{" "}
              <span className={`num font-medium ${tone(h.ewTop.windows[0].abnormal)}`}>{pct(h.ewTop.windows[0].abnormal)}</span>
            </div>
          )}
        </>
      ) : h && h.measured ? (
        <span className="text-ink-muted">None beyond noise ({h.measured} measured)</span>
      ) : (
        <span className="text-ink-soft">Not measured</span>
      )}
    </>
  );
  const thesisImpact = (linked: typeof theses, c: NonNullable<ReturnType<typeof caseOfEvent>>) => (
    <>
      {linked.length ? (
        <ul className="space-y-1">
          {linked.map((t) => (
            <li key={t.replay.thesis.id} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <Link href={`/theses#${t.replay.thesis.id}`} className="text-ink hover:text-accent">{t.replay.thesis.id}</Link>
              <ThesisStatusChip status={t.replay.status} />
              <OriginChip origin={t.replay.thesis.origin} />
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[12px] text-ink-soft">Context for {c.theses.length ? "the case theses" : "the case"}</span>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Event intelligence"
        title="Event radar"
        subtitle="Events that could change an investment thesis, ranked by date. Each one shows how well it is sourced as of today, where it is in its legal or operational life, and what markets measurably did, so a loud headline and a verified fact never look alike."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {RESEARCH_CASES.map((c) => (
          <Link key={c.id} href={`/events/${c.slug}/brief`} className="card card-hover block p-5">
            <div className="text-[12.5px] font-medium text-ink-soft">Research case · edition as of <When iso={c.asOf} precision="day" /></div>
            <h2 className="mt-1 text-[21px] font-semibold leading-snug text-ink">{c.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{c.dek}</p>
            <div className="mt-3 text-[12.5px] text-ink-soft">
              {c.events.length} event{c.events.length === 1 ? "" : "s"} · {c.claims.length} claims · {c.sources.filter((s) => s.retrieval === "read").length} sources read, {c.sources.filter((s) => s.retrieval !== "read").length} unreadable · {c.theses.length} theses
            </div>
            <div className="mt-3 text-[13px] font-medium text-accent">Open the three-minute brief</div>
          </Link>
        ))}
      </section>

      <Panel title="Events" eyebrow={`${events.length} tracked · as of ${PLATFORM_AS_OF.slice(0, 16).replace("T", " ")} UTC`} source="Case files (claims paraphrased from the sources listed on each case's evidence page); Yahoo Finance daily bars for market reactions.">
        <ul className="-mx-5 divide-y divide-line md:hidden" aria-label="Events">
          {events.map((v) => {
            const c = caseOfEvent(v.event.id)!;
            const linked = theses.filter((t) => t.replay.thesis.eventId === v.event.id);
            return (
              <li key={v.event.id} className="px-5 py-4">
                <Link href={`/events/${c.slug}#${v.event.id}`} className="font-semibold leading-snug text-ink hover:text-accent">{v.event.title}</Link>
                <div className="mt-1 text-[12px] text-ink-soft">
                  <When iso={v.event.occurredAt} precision={v.event.occurredPrecision} /> · {v.event.categories.map((k) => EVENT_CATEGORIES[k].label).join(" · ")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <VerificationChip state={v.verification} title={v.confidenceReason} />
                  <LifecycleChip state={v.event.lifecycle} />
                  <span className="text-[12px] text-ink-muted">{v.confidence} confidence</span>
                </div>
                <div className="mt-2 text-[12.5px]">
                  <span className="text-ink-soft">Measured reaction: </span>
                  {reaction(headline(v.event.id))}
                </div>
                <div className="mt-2">{thesisImpact(linked, c)}</div>
              </li>
            );
          })}
        </ul>
        <div className="-mx-5 hidden overflow-x-auto md:-mx-6 md:block">
          <table className="w-full min-w-[920px] text-left text-[13px]" aria-label="Tracked events">
            <thead className="border-b border-line text-[12px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium md:pl-6">Event</th>
                <th scope="col" className="px-3 py-2 font-medium">Occurred</th>
                <th scope="col" className="px-3 py-2 font-medium">Sourcing</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Largest measured reaction</th>
                <th scope="col" className="px-3 py-2 font-medium md:pr-6">Thesis impact</th>
              </tr>
            </thead>
            <tbody>
              {events.map((v) => {
                const c = caseOfEvent(v.event.id)!;
                const h = headline(v.event.id);
                const linked = theses.filter((t) => t.replay.thesis.eventId === v.event.id);
                return (
                  <tr key={v.event.id} className="border-b border-line align-top last:border-0">
                    <td className="px-5 py-3 md:pl-6">
                      <Link href={`/events/${c.slug}#${v.event.id}`} className="font-semibold text-ink hover:text-accent">{v.event.title}</Link>
                      <div className="mt-1 text-[12px] text-ink-soft">{v.event.categories.map((k) => EVENT_CATEGORIES[k].label).join(" · ")}</div>
                      <div className="mt-1 text-[12px] text-ink-muted">{v.event.industries.join(", ")}</div>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-muted"><When iso={v.event.occurredAt} precision={v.event.occurredPrecision} /></td>
                    <td className="px-3 py-3">
                      <VerificationChip state={v.verification} title={v.confidenceReason} />
                      <div className="mt-1 text-[12px] text-ink-muted">{v.confidence} confidence</div>
                      <div className="mt-0.5 text-[11.5px] text-ink-soft">verified <When iso={v.lastVerifiedAt ?? v.asOf} precision="day" /></div>
                    </td>
                    <td className="px-3 py-3"><LifecycleChip state={v.event.lifecycle} /></td>
                    <td className="px-3 py-3 text-[12.5px]">{reaction(h)}</td>
                    <td className="px-3 py-3 md:pr-6">{thesisImpact(linked, c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Disputed and guarded claims" eyebrow="Where the sources disagree">
          {events.flatMap((v) => v.claims.filter((c) => c.verification === "DISPUTED" || c.lifecycleGuard)).map((c) => (
            <ClaimCard key={c.id} claim={c} sources={sources} compact />
          ))}
        </Panel>
        <Panel title="Engine status" eyebrow="Data, ledgers and checks">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div><dt className="text-ink-soft">Market snapshot</dt><dd className="num text-ink">{SNAPSHOT.status} · equities through {through.equity}, crypto through {through.crypto}</dd></div>
            <div><dt className="text-ink-soft">Instruments priced</dt><dd className="num text-ink">{SNAPSHOT.counts.pricesOk}/{SNAPSHOT.counts.instruments}{SNAPSHOT.counts.pricesCarriedOver ? ` (${SNAPSHOT.counts.pricesCarriedOver} carried over)` : ""}</dd></div>
            <div><dt className="text-ink-soft">Forecast ledger</dt><dd className={check.forecastChain.ok ? "text-ink" : "text-rose-800"}>{check.forecastChain.message}</dd></div>
            <div><dt className="text-ink-soft">Thesis ledger</dt><dd className={check.thesisChain.ok ? "text-ink" : "text-rose-800"}>{check.thesisChain.message}</dd></div>
            <div><dt className="text-ink-soft">Validation</dt><dd className={issues ? "text-rose-800" : "text-ink"}>{issues ? `${issues} problem(s) in case data` : "Case data, graphs and theses validate"}</dd></div>
            <div><dt className="text-ink-soft">Forecasts realized</dt><dd className="num text-ink">{forecasts.filter((f) => f.score.status === "scored" && f.record.origin === "live").length} live · {forecasts.filter((f) => f.score.status === "scored" && f.record.origin === "backfill").length} backfilled · {forecasts.filter((f) => f.score.status === "pending").length} pending</dd></div>
          </dl>
          <div className="mt-4">
            <Note>
              Refreshes run in the weekly GitHub workflow (<span className="num">npm run events:refresh</span>), not on the web server. A failed symbol keeps its previous prices and is marked carried-over in the run log; a missing benchmark fails the run.
            </Note>
          </div>
        </Panel>
      </section>
    </div>
  );
}
