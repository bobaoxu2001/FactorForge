import { notFound } from "next/navigation";
import { pct, tone } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import { caseBySlug, instrument } from "@/data/events";
import type { EventStudy } from "@/lib/events/market";
import { windowView } from "@/lib/events/view";

export const metadata = { title: "Event market reaction" };

const PERSISTENCE_LABEL: Record<EventStudy["persistence"], string> = {
  persistent: "persistent",
  "partially-reversed": "partly reversed",
  reversed: "reversed",
  "no-significant-reaction": "within noise",
  "insufficient-data": "too early",
};

function Cell({ v, t, complete = true }: { v: number | null; t?: number | null; complete?: boolean }) {
  const sig = t != null && Math.abs(t) >= 1.96;
  return (
    <td className={`num px-2 py-2 text-right ${tone(v)} ${sig ? "font-semibold" : ""} ${complete ? "" : "opacity-60"}`} title={t != null ? `t = ${t.toFixed(2)}${complete ? "" : " · window not complete"}` : undefined}>
      {pct(v)}
      {sig && <span className="ml-0.5 text-[10px] text-ink-soft">*</span>}
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
        Abnormal return is the part of a move its benchmark does not explain: actual return minus α + β × benchmark return, with α and β fitted on 120 sessions that end ten sessions before day 0. Day 0 is the first daily bar that closed after the event, so an event after the New York close starts on the next session. Bold with * means |t| ≥ 1.96. Faded figures belong to windows that have not finished. Caveat: when the affected stocks dominate the benchmark (AI names in QQQ), the benchmark absorbs part of the event and abnormal returns understate it, so raw returns are shown too.
      </Note>

      {c.windows.map((w) => {
        const v = windowView(c, w.id);
        if (!v) return null;
        const groups = v.groups["[0,0]"].filter((g) => g.meanAbnormal !== null);
        const maxAbs = Math.max(0.01, ...groups.map((g) => Math.abs(g.meanAbnormal!)));
        const overlapLabels = Object.entries(v.overlaps).filter(([, xs]) => xs.length);
        return (
          <section key={w.id} id={w.id} className="scroll-mt-28">
            <Panel title={w.label} eyebrow={v.event.title} source="Yahoo Finance daily bars (adjusted closes); FactorForge event-study calculation. US equities on New York sessions, crypto on UTC days.">
              {overlapLabels.length > 0 && (
                <div className="mb-3">
                  <Note tone="warn">
                    Overlapping events: {overlapLabels.map(([label, xs]) => `${label} includes ${xs.map((o) => `${o.title} (${o.date})`).join(", ")}`).join("; ")}. Multi-day figures in those windows mix events and cannot be attributed to this one.
                  </Note>
                </div>
              )}
              <div className="-mx-5 overflow-x-auto md:-mx-6">
                <table className="w-full min-w-[960px] text-[12.5px]">
                  <thead className="border-b border-line text-[11.5px] text-ink-soft">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium md:pl-6">Instrument</th>
                      <th className="px-2 py-2 text-left font-medium">Day 0</th>
                      <th className="px-2 py-2 text-left font-medium">Benchmark · β</th>
                      <th className="px-2 py-2 text-right font-medium">Raw day 0</th>
                      <th className="px-2 py-2 text-right font-medium">Abnormal day 0</th>
                      <th className="px-2 py-2 text-right font-medium">Abnormal 2 days</th>
                      <th className="px-2 py-2 text-right font-medium">Abnormal 5 days</th>
                      <th className="px-2 py-2 text-right font-medium">Abnormal 20 days</th>
                      <th className="px-2 py-2 text-right font-medium">Volume vs 20d</th>
                      <th className="px-2 py-2 text-left font-medium md:pr-6">After 5 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.studies.map((s) => {
                      const [w0, w1, w4, w19] = s.windows;
                      return (
                        <tr key={s.symbol} className="border-b border-line last:border-0">
                          <td className="px-5 py-2 md:pl-6">
                            <span className="font-medium text-ink">{s.symbol}</span>
                            <span className="ml-1.5 text-[11.5px] text-ink-soft">{instrument(s.symbol)?.name}</span>
                          </td>
                          <td className="num px-2 py-2 text-ink-muted">{s.day0 ?? "—"}</td>
                          <td className="num px-2 py-2 text-ink-muted">{s.benchmark ? `${s.benchmark} · ${s.model.method === "market-model" ? s.model.beta.toFixed(2) : "1 (adj.)"}` : "is the benchmark"}</td>
                          <Cell v={w0?.raw ?? null} />
                          {s.benchmark ? <Cell v={w0?.abnormal ?? null} t={w0?.tStat} /> : <td className="px-2 py-2 text-right text-ink-soft">—</td>}
                          {s.benchmark ? <Cell v={w1?.abnormal ?? null} t={w1?.tStat} complete={w1?.complete} /> : <Cell v={w1?.raw ?? null} complete={w1?.complete} />}
                          {s.benchmark ? <Cell v={w4?.abnormal ?? null} t={w4?.tStat} complete={w4?.complete} /> : <Cell v={w4?.raw ?? null} complete={w4?.complete} />}
                          {s.benchmark ? <Cell v={w19?.abnormal ?? null} t={w19?.tStat} complete={w19?.complete} /> : <Cell v={w19?.raw ?? null} complete={w19?.complete} />}
                          <td className="num px-2 py-2 text-right text-ink-muted">{s.volumeRatio ? `${s.volumeRatio.toFixed(1)}×` : "—"}</td>
                          <td className="px-2 py-2 text-ink-muted md:pr-6" title={s.persistenceNote}>{PERSISTENCE_LABEL[s.persistence]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {groups.length > 0 && (
                <div className="mt-5">
                  <h3 className="section-label">Day-0 abnormal return by group (equal-weighted)</h3>
                  <ul className="mt-2 space-y-1.5">
                    {groups.map((g) => (
                      <li key={g.group} className="grid grid-cols-[minmax(0,180px)_1fr_64px] items-center gap-3 text-[12.5px]">
                        <span className="truncate text-ink-muted" title={g.members.join(", ")}>{g.group}</span>
                        <span className="relative h-3 rounded-sm bg-panel2">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden />
                          <span
                            className={`absolute inset-y-0 rounded-sm ${g.meanAbnormal! >= 0 ? "left-1/2 bg-emerald-700/70" : "right-1/2 bg-rose-700/70"}`}
                            style={{ width: `${(Math.abs(g.meanAbnormal!) / maxAbs) * 50}%` }}
                          />
                        </span>
                        <span className={`num text-right font-medium ${tone(g.meanAbnormal)}`}>{pct(g.meanAbnormal)}</span>
                      </li>
                    ))}
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
