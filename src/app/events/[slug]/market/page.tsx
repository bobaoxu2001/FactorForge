import { notFound } from "next/navigation";
import { caseMetadata } from "@/lib/events/caseMetadata";
import { pct, tone } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import { caseBySlug, instrument } from "@/data/events";
import type { EventStudy, WindowResult } from "@/lib/events/market";
import { benchmarkSensitivity, eventReactionSummary, windowView } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => caseMetadata(params, "Market reaction");

const PERSISTENCE_LABEL: Record<EventStudy["persistence"], string> = {
  persistent: "persistent",
  "partially-reversed": "partly reversed",
  reversed: "reversed",
  "no-significant-reaction": "within noise",
  "insufficient-data": "too early",
};

function describe(w: WindowResult | undefined): string | undefined {
  if (!w || w.tStat == null) return undefined;
  const placebo = w.placeboShare == null ? "" : ` · ${(w.placeboShare * 100).toFixed(1)}% of the previous ${w.placeboN} sessions moved at least as much`;
  return `t = ${w.tStat.toFixed(2)}${placebo}${w.complete ? "" : " · window not complete"}`;
}

function Cell({ w, value, emphasis = false }: { w?: WindowResult; value: number | null; emphasis?: boolean }) {
  const sig = !!w?.significant;
  const complete = w?.complete ?? true;
  return (
    <td className={`num px-2 py-2 text-right ${tone(value)} ${sig ? "font-semibold" : ""} ${emphasis ? "text-[13px]" : ""} ${complete ? "" : "opacity-60"}`} title={describe(w)}>
      {pct(value)}
      {sig && (
        <span className="ml-0.5 text-[11px] text-ink-soft" aria-label="significant">
          *
        </span>
      )}
    </td>
  );
}

export default async function EventMarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();

  return (
    <div className="space-y-5">
      <Note>
        <strong className="font-semibold">Associations around a date, not proof of cause.</strong> Abnormal return is the part of a move its benchmark does not explain: actual return minus α + β × benchmark return, with α and β fitted on 120 sessions that end ten sessions before day 0. Day 0 is the first daily bar that closed after the event, so an event after the New York close starts on the next session. A figure is bold with * only when two checks agree: the t-statistic (which includes the error in estimating α and β, so a big market day widens the band) is at least 1.96, and no more than 5% of the asset&apos;s own previous 500 sessions moved as much. Hover a figure for both numbers. Faded figures belong to windows that have not finished.
      </Note>

      {c.windows.map((w) => {
        const v = windowView(c, w.id);
        if (!v) return null;
        const groups = v.groups["[0,0]"].filter((g) => g.meanAbnormal !== null);
        const maxAbs = Math.max(0.01, ...groups.map((g) => Math.abs(g.meanAbnormal!)));
        const overlapLabels = Object.entries(v.overlaps).filter(([, xs]) => xs.length);
        const day0s = [...new Set(v.studies.map((s) => s.day0).filter(Boolean))];
        const hasEqualWeight = Object.keys(v.equalWeight).length > 0;
        const sigBySymbol = new Map(v.studies.map((s) => [s.symbol, s.windows[0]?.significant ?? false]));
        return (
          <section key={w.id} id={w.id} className="scroll-mt-28">
            <Panel
              title={w.label}
              eyebrow={`${v.event.title} · day 0: ${day0s.join(" / ") || "—"}`}
              source="Yahoo Finance daily bars (adjusted closes); FactorForge event-study calculation. US equities on New York sessions, crypto on UTC days."
            >
              <div className="mb-3 space-y-2">
                <p className="text-[13px] leading-relaxed text-ink">
                  {benchmarkSensitivity(v) ?? (
                    <>
                      <span className="font-semibold">{v.day0Tests.significant}</span> of {v.day0Tests.run} benchmark-adjusted day-0 moves pass both checks. With this many tests, about {v.day0Tests.expectedByChance.toFixed(1)} would pass by chance alone.
                    </>
                  )}
                </p>
                {overlapLabels.length > 0 && (
                  <Note tone="warn">
                    Overlapping events: {overlapLabels.map(([label, xs]) => `${label} includes ${xs.map((o) => `${o.title} (${o.date})`).join(", ")}`).join("; ")}. Multi-day figures in those windows mix events and cannot be attributed to this one.
                  </Note>
                )}
                {v.estimationOverlaps.length > 0 && (
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">
                    The 120-session estimation window also contains{" "}
                    {v.estimationOverlaps
                      .map((o) => {
                        const r = eventReactionSummary(o.eventId);
                        const what = r.run === 0 ? "not measured here" : r.significant === 0 ? `no significant day-0 reaction in ${r.run} tests` : `${r.significant} significant day-0 reaction${r.significant === 1 ? "" : "s"} in ${r.run} tests`;
                        return `${o.title} (${o.date}; ${what})`;
                      })
                      .join("; ")}
                    . Events without a measurable reaction move α and β little; any that did react bias the baseline toward their own move.
                  </p>
                )}
              </div>
              <p className="mb-1 text-[11.5px] text-ink-soft md:hidden">Scroll sideways for more columns; the instrument stays pinned.</p>
              <div className="-mx-5 overflow-x-auto md:-mx-6">
                <table className="w-full min-w-[980px] text-[12.5px]" aria-label={`Market reaction: ${w.label}`}>
                  <thead className="border-b border-line text-[11.5px] text-ink-soft">
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 bg-panel px-5 py-2 text-left font-medium md:pl-6">Instrument</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">Abnormal day 0</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">Raw day 0</th>
                      {hasEqualWeight && (
                        <th scope="col" className="px-2 py-2 text-right font-medium" title="Abnormal return against the equal-weight S&P 500 (RSP), which the largest stocks do not dominate">
                          vs equal-weight
                        </th>
                      )}
                      <th scope="col" className="px-2 py-2 text-right font-medium">2 days</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">5 days</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">20 days</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">Benchmark · β</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">Volume vs 20d</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium md:pr-6">After 5 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.studies.map((s) => {
                      const [w0, w1, w4, w19] = s.windows;
                      const ew = v.equalWeight[s.symbol]?.windows[0];
                      const adj = !!s.benchmark;
                      return (
                        <tr key={s.symbol} className="border-b border-line last:border-0">
                          <th scope="row" className="sticky left-0 z-10 bg-panel px-5 py-2 text-left font-normal md:pl-6">
                            <span className="font-medium text-ink">{s.symbol}</span>
                            <span className="ml-1.5 hidden text-[11.5px] text-ink-soft sm:inline">{instrument(s.symbol)?.name}</span>
                            {day0s.length > 1 && <span className="num block text-[11px] text-ink-soft">day 0 {s.day0}</span>}
                          </th>
                          {adj ? <Cell w={w0} value={w0?.abnormal ?? null} emphasis /> : <td className="px-2 py-2 text-right text-[11.5px] text-ink-soft">benchmark</td>}
                          <td className={`num px-2 py-2 text-right ${tone(w0?.raw ?? null)}`}>{pct(w0?.raw ?? null)}</td>
                          {hasEqualWeight && (ew ? <Cell w={ew} value={ew.abnormal} /> : <td className="px-2 py-2 text-right text-ink-soft">—</td>)}
                          <Cell w={adj ? w1 : undefined} value={(adj ? w1?.abnormal : w1?.raw) ?? null} />
                          <Cell w={adj ? w4 : undefined} value={(adj ? w4?.abnormal : w4?.raw) ?? null} />
                          <Cell w={adj ? w19 : undefined} value={(adj ? w19?.abnormal : w19?.raw) ?? null} />
                          <td className="num px-2 py-2 text-ink-muted">{s.benchmark ? `${s.benchmark} · ${s.model.method === "market-model" ? s.model.beta.toFixed(2) : "1 (adj.)"}` : "—"}</td>
                          <td className="num px-2 py-2 text-right text-ink-muted">{s.volumeRatio ? `${s.volumeRatio.toFixed(1)}×` : "—"}</td>
                          <td className="px-2 py-2 text-ink-muted md:pr-6" title={s.persistenceNote}>
                            {PERSISTENCE_LABEL[s.persistence]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {groups.length > 0 && (
                <div className="mt-5">
                  <h3 className="section-label">Day-0 abnormal return by group (equal-weighted mean of members)</h3>
                  <ul className="mt-2 space-y-1.5">
                    {groups.map((g) => {
                      const sigCount = g.members.filter((m) => sigBySymbol.get(m)).length;
                      return (
                        <li key={g.group} className="grid grid-cols-[minmax(0,180px)_1fr_64px] items-center gap-3 text-[12.5px]">
                          <span className="truncate text-ink-muted" title={g.members.join(", ")}>
                            {g.group} <span className="text-ink-soft">({sigCount}/{g.n} sig.)</span>
                          </span>
                          <span className="relative h-3 rounded-sm bg-panel2" aria-hidden>
                            <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                            <span
                              className={`absolute inset-y-0 rounded-sm ${g.meanAbnormal! >= 0 ? "left-1/2 bg-emerald-700/70" : "right-1/2 bg-rose-700/70"}`}
                              style={{ width: `${(Math.abs(g.meanAbnormal!) / maxAbs) * 50}%` }}
                            />
                          </span>
                          <span className={`num text-right font-medium ${tone(g.meanAbnormal)}`}>{pct(g.meanAbnormal)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Panel>
          </section>
        );
      })}
    </div>
  );
}
