import Link from "next/link";
import { notFound } from "next/navigation";
import ValueChainGraph, { type EdgeEvidence } from "@/components/intel/ValueChainGraph";
import { CitedText, EvidenceLinks, fmt, Note, Panel } from "@/components/intel/ui";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;
export const metadata = { title: "Industry map" };

export default function IndustryPage({ params }: { params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const pid = view.config.id;
  const evidence: Record<string, EdgeEvidence> = {};
  for (const e of view.evidence.filter((x) => x.id.startsWith("EV-10K-"))) evidence[e.id] = { id: e.id, claim: e.claim, excerpt: e.excerpt, ticker: e.tickers[0] };
  const counts = { verified: 0, inferred: 0, hypothetical: 0 };
  view.valueChain.relationships.forEach((r) => (counts[r.status] += 1));
  const kpiByCategory = (cat: string) => view.kpis.filter((k) => k.kpi.category === cat);

  return (
    <div className="space-y-5">
      <Panel eyebrow="Stage 01 · Industry mapping" title="U.S. freight value chain" source="Company 10-K filings; links marked verified quote the filing text.">
        <p className="mb-3 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          How freight moves from shippers to capacity, who sits in between, and which inputs drive cost. A relationship is
          <span className="text-emerald-700"> verified</span> only when a sentence in the company&apos;s latest 10-K supports it ({counts.verified}). The rest are
          <span className="text-amber-700"> inferred</span> from industry structure ({counts.inferred}) or
          <span className="text-ink-soft"> hypothetical</span> pending data ({counts.hypothetical}).
        </p>
        <ValueChainGraph projectId={pid} nodes={view.valueChain.nodes} relationships={view.valueChain.relationships} evidence={evidence} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {view.marketStructure.map((s) => (
          <Panel key={s.heading} eyebrow="Market structure" title={s.heading}>
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-muted">
              {s.points.map((p) => <li key={p}>• {p}</li>)}
            </ul>
            <div className="mt-2 text-[11px] text-ink-soft">Supporting filing excerpts: <EvidenceLinks ids={s.evidenceIds} projectId={pid} /></div>
          </Panel>
        ))}
      </div>

      <Panel eyebrow="Public peer group" title="Companies by position in the chain">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="text-[10.5px] text-ink-soft">
              <tr><th className="py-2 pr-3">Company</th><th className="py-2 pr-3">Business model</th><th className="py-2 pr-3">SIC</th><th className="py-2 pr-3">TTM revenue</th><th className="py-2 pr-3">Disclosed in 10-K</th></tr>
            </thead>
            <tbody className="divide-soft">
              {view.companies.map((c) => {
                const claims = view.config.excerptClaims.filter((x) => x.ticker === c.ticker);
                return (
                  <tr key={c.ticker} className="table-row align-top">
                    <td className="py-2 pr-3"><Link href={`/research/${pid}/companies/${c.ticker}`} className="font-medium text-ink hover:text-accent">{c.ticker}</Link><div className="text-[11px] text-ink-soft">{c.name}</div></td>
                    <td className="py-2 pr-3 text-ink-muted">{c.coverage.businessModel}</td>
                    <td className="py-2 pr-3 text-ink-muted">{c.sicDescription}</td>
                    <td className="py-2 pr-3 text-ink-muted">{fmt.usdB(c.latestTtm?.ttmRevenue)}</td>
                    <td className="py-2 pr-3 text-[11.5px] text-ink-muted">
                      {claims.slice(0, 2).map((cl) => <div key={cl.id}>{cl.claim} <EvidenceLinks ids={[`EV-10K-${cl.id}`]} projectId={pid} /></div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Demand drivers", "demand-driver"],
          ["Supply & capacity", "capacity"],
          ["Pricing & cost", "pricing"],
        ].map(([title, cat]) => (
          <Panel key={cat} eyebrow="Drivers" title={title}>
            <ul className="space-y-2 text-[12px]">
              {[...kpiByCategory(cat), ...(cat === "pricing" ? kpiByCategory("cost") : [])].map((k) => (
                <li key={k.kpi.id} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2">
                  <div className="flex justify-between gap-2"><span className="font-medium text-ink">{k.kpi.name}</span><span className="text-ink-muted">{fmt.pct(k.latest?.yoy)} YoY</span></div>
                  <div className="mt-0.5 text-[11px] text-ink-soft">{k.kpi.timing}: {k.kpi.timingRationale}</div>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel eyebrow="Industry catalysts & risks" title="What could change the picture">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-ink-soft">Scheduled data</div>
            <ul className="space-y-1 text-[12px] text-ink-muted">
              {view.catalysts.filter((c) => c.kind === "data-release").slice(0, 6).map((c) => <li key={c.label}>{c.date}: {c.label}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-soft">Structural risks (from filings)</div>
            <ul className="space-y-1 text-[12px] text-ink-muted">
              {view.marketStructure.find((s) => s.heading.startsWith("Structural"))?.points.map((p) => <li key={p}><CitedText text={p} projectId={pid} /></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-3"><Note>Regulatory items (emissions mandates, driver rules) appear in risk factors but are not modelled here. Open the 10-K links on each company page to read them in full.</Note></div>
      </Panel>
    </div>
  );
}
