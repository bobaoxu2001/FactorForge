import { notFound } from "next/navigation";
import { caseMetadata } from "@/lib/events/caseMetadata";
import ImpactMap from "@/components/events/ImpactMap";
import { EPISTEMIC_LABEL, pct, tone } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import { caseBySlug } from "@/data/events";
import { EXPOSURE_DIMENSIONS, LAYERS, type ExposureCell, type ExposureLevel } from "@/lib/events/impact";
import { exposureRows, impacts } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => caseMetadata(params, "Impact map");

const LEVEL_STYLE: Record<ExposureLevel, string> = {
  high: "bg-ink/[0.85] text-paper",
  medium: "bg-ink/30 text-ink",
  low: "bg-ink/[0.08] text-ink-muted",
  none: "bg-transparent text-ink-soft",
  unknown: "border border-dashed border-ink/25 bg-transparent text-ink-soft",
};

function ExposureTag({ cell }: { cell: ExposureCell | undefined }) {
  if (!cell) return <span className="text-[11.5px] text-ink-soft">not assessed</span>;
  return (
    <span title={`${cell.basis} (${EPISTEMIC_LABEL[cell.epistemic]}${cell.verified ? "" : ", not yet checked against filings"})`} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium ${LEVEL_STYLE[cell.level]}`}>
      {cell.level}
      {!cell.verified && cell.epistemic === "ANALYST_INTERPRETATION" && <span aria-label="unverified">°</span>}
    </span>
  );
}

export default async function EventImpactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const imp = impacts(c);
  const rows = exposureRows(c);
  const windowLabel = c.windows.find((w) => w.id === c.graphWindowId)?.label ?? c.graphWindowId;

  return (
    <div className="space-y-5">
      <Panel title="Impact map" eyebrow="Event to price, one mechanism at a time" source={`Case impact graph; market check against day-0 abnormal returns in "${windowLabel}".`}>
        <p className="mb-4 max-w-[80ch] text-[13.5px] leading-relaxed text-ink-muted">
          Each link says which way it pushes and why, what kind of statement that is, and what evidence stands behind it. A company&apos;s direction is the product of the signs along each path. When evidence-backed paths disagree, the answer is ambiguous rather than forced. Choose a company to trace its paths.
        </p>
        <ImpactMap graph={c.graph} impacts={imp} layers={LAYERS} />
      </Panel>

      <Panel title="Map versus measured reaction" eyebrow="The data are not re-explained to fit the map" source={`Day-0 abnormal returns, ${windowLabel}.`}>
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line text-[12px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium md:pl-6">Company</th>
                <th scope="col" className="px-3 py-2 font-medium">Map direction</th>
                <th scope="col" className="px-3 py-2 font-medium">Paths (with evidence / total)</th>
                <th scope="col" className="px-3 py-2 font-medium md:pr-6">Market check</th>
              </tr>
            </thead>
            <tbody>
              {imp.map((i) => (
                <tr key={i.nodeId} className="border-b border-line last:border-0 align-top">
                  <td className="px-5 py-2 md:pl-6"><span className="font-medium text-ink">{i.ticker}</span> <span className="text-[12px] text-ink-soft">{i.label}</span></td>
                  <td className="px-3 py-2 text-ink">{i.net}</td>
                  <td className="num px-3 py-2 text-ink-muted">{i.paths.filter((p) => p.supported).length} / {i.paths.length}</td>
                  <td className={`px-3 py-2 md:pr-6 ${i.marketCheck === "contradicted" ? "font-medium text-rose-800" : "text-ink-muted"}`}>{i.marketNote}</td>
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
        <Panel title="Exposure watchlist" eyebrow="Seven ways a company can be exposed" source="Business exposure: analyst classification (° = not yet checked against the company's filing). Valuation and leverage: Yahoo quoteSummary snapshot. Sentiment: pre-event beta, 60-day return and day-0 volume from daily bars.">
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full min-w-[1080px] text-left text-[12.5px]">
              <thead className="border-b border-line text-[11.5px] text-ink-soft">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium md:pl-6">Company</th>
                  {EXPOSURE_DIMENSIONS.map((d) => (
                    <th key={d.key} className="px-2 py-2 font-medium">{d.label}</th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right font-medium md:pr-6">Day-0 abnormal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cells = { ...r.cells, ...r.measured };
                  const w0 = r.study?.windows[0];
                  return (
                    <tr key={r.ticker} className="border-b border-line last:border-0 align-top">
                      <td className="px-5 py-2 md:pl-6">
                        <div className="font-medium text-ink">{r.ticker}</div>
                        <div className="text-[11.5px] text-ink-soft">{r.role}</div>
                      </td>
                      {EXPOSURE_DIMENSIONS.map((d) => (
                        <td key={d.key} className="px-2 py-2"><ExposureTag cell={cells[d.key]} /></td>
                      ))}
                      <td className={`num px-2 py-2 text-right md:pr-6 ${tone(w0?.abnormal)}`} title={w0?.tStat != null ? `t = ${w0.tStat.toFixed(2)}` : undefined}>{pct(w0?.abnormal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Note tone="warn">Revenue exposure here is a classification from public business descriptions, not a measured share. Hover a cell for its basis. Checking each against the latest 10-K segment note is the next step before any of these supports a conclusion.</Note>
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
