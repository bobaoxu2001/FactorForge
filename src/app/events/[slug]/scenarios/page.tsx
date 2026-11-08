import Link from "next/link";
import { notFound } from "next/navigation";
import { caseMetadata } from "@/lib/events/caseMetadata";
import { OriginChip, pct } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import { caseBySlug, instrument } from "@/data/events";
import { HORIZONS } from "@/lib/events/forecast";
import { evaluation, scoredForecasts } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => caseMetadata(params, "Scenarios");

const CASE_STYLE = { base: "border-ink/25", bull: "border-emerald-700/40", bear: "border-rose-700/40" } as const;

export default async function EventScenariosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const forecasts = scoredForecasts().filter((f) => c.events.some((e) => e.id === f.record.eventId));
  const latestCutoff = forecasts.map((f) => f.record.informationCutoff).sort().at(-1);
  const current = forecasts.filter((f) => f.record.informationCutoff === latestCutoff);
  const symbols = [...new Set(current.map((f) => f.record.instrument))];

  return (
    <div className="space-y-5">
      <Note>
        Scenarios are written cases, not predictions: no probabilities are attached, because no model here is calibrated for what happens after events like these. What can be measured is shown below them: how wide the range of outcomes has been for each instrument, and how honest that range has proved out of sample.
      </Note>

      <section className="grid gap-4 xl:grid-cols-3">
        {c.scenarios.map((s) => (
          <article key={s.case} className={`card border-t-[3px] p-5 ${CASE_STYLE[s.case]}`}>
            <div className="text-[12.5px] font-medium capitalize text-ink-soft">{s.case} case</div>
            <h2 className="mt-0.5 text-[19px] font-semibold leading-snug text-ink">{s.title}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{s.narrative}</p>
            <dl className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed">
              <div><dt className="font-semibold text-ink">Assumes</dt><dd className="text-ink-muted">{s.assumptions.join(" ")}</dd></div>
              <div>
                <dt className="font-semibold text-ink">Catalysts</dt>
                <dd>
                  <ul className="text-ink-muted">
                    {s.catalysts.map((k) => (
                      <li key={k.what}><span className="text-ink">{k.when}:</span> {k.what}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div><dt className="font-semibold text-ink">Risks</dt><dd className="text-ink-muted">{s.risks.join(" ")}</dd></div>
              <div><dt className="font-semibold text-rose-800">Invalidated by</dt><dd className="text-ink-muted">{s.invalidation.join(" ")}</dd></div>
              <div><dt className="font-semibold text-ink">Watch</dt><dd className="text-ink-muted">{s.indicators.join(" · ")}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <Panel
        title="Measured ranges"
        eyebrow={`Baseline forecasts made with data to ${latestCutoff ?? "—"}`}
        source="Forecast ledger (model ewma-interval-v1, zero drift, 80% range from EWMA volatility). Coverage: walk-forward test on the snapshot history."
        actions={<Link href="/forecasts" className="text-[12.5px] text-accent hover:underline">Full scorecard →</Link>}
      >
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 text-left font-medium md:pl-6">Instrument</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Horizon</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Direction</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">80% range</th>
                <th scope="col" className="px-2 py-2 text-right font-medium" title="Relative wealth return: (1 + return) / (1 + benchmark return) − 1. Not the arithmetic difference.">Relative to benchmark (80%)</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Base rate up</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Past coverage</th>
                <th scope="col" className="px-2 py-2 text-left font-medium md:pr-6">Made</th>
              </tr>
            </thead>
            <tbody>
              {symbols.flatMap((sym) =>
                HORIZONS.map((h) => {
                  const f = current.find((x) => x.record.instrument === sym && x.record.horizon === h);
                  if (!f) return null;
                  const p = f.record.prediction;
                  const ev = evaluation(sym, h);
                  return (
                    <tr key={`${sym}-${h}`} className={`border-b border-line last:border-0 ${h === 1 ? "border-t border-t-ink/15" : ""}`}>
                      <td className="px-5 py-1.5 md:pl-6">{h === 1 ? <><span className="font-medium text-ink">{sym}</span> <span className="text-[11.5px] text-ink-soft">{instrument(sym)?.name}</span></> : null}</td>
                      <td className="num px-2 py-1.5 text-ink-muted">{h} {f.record.calendar === "crypto-utc" ? "day" : "session"}{h === 1 ? "" : "s"}</td>
                      <td className="px-2 py-1.5 text-ink-muted" title={p.directionReason}>{p.direction === "ABSTAIN" ? "abstain" : p.direction.toLowerCase()}</td>
                      <td className="num px-2 py-1.5 text-right text-ink">{p.interval ? `${pct(p.interval[0])} to ${pct(p.interval[1])}` : p.reason}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{p.relInterval ? `${pct(p.relInterval[0])} to ${pct(p.relInterval[1])}` : "—"}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{p.pUp === null ? "—" : `${(p.pUp * 100).toFixed(0)}%`}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted" title={ev ? `${ev.n} forecasts, ${ev.effectiveN} effectively independent` : undefined}>{ev?.coverage == null ? "—" : `${(ev.coverage * 100).toFixed(0)}% of ${ev.n}`}</td>
                      <td className="px-2 py-1.5 md:pr-6"><OriginChip origin={f.record.origin} /></td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-muted">
          &ldquo;Abstain&rdquo; means no directional skill was found for that instrument and horizon in walk-forward testing, so the range is the forecast. &ldquo;Base rate up&rdquo; is how often the instrument rose over that horizon in the past two years, shrunk toward 50%; it is context, not a call.
        </p>
      </Panel>
    </div>
  );
}
