import { notFound } from "next/navigation";
import EvidenceExplorer from "@/components/intel/EvidenceExplorer";
import { Note, Panel } from "@/components/intel/ui";
import { buildMemoSections } from "@/lib/intel/memo";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;
export const metadata = { title: "Evidence explorer" };

export default function EvidencePage({ params, searchParams }: { params: { projectId: string }; searchParams: { id?: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const memoCitations: Record<string, string[]> = {};
  for (const s of buildMemoSections(view)) {
    for (const id of new Set(s.body.join(" ").match(/EV-[A-Za-z0-9-]+/g) ?? [])) {
      (memoCitations[id] ??= []).push(`§${s.number} ${s.title}`);
    }
  }
  const byOrigin = view.evidence.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.source.sourceType]: (acc[e.source.sourceType] ?? 0) + 1 }), {});
  return (
    <div className="space-y-4">
      <Panel eyebrow="Stage 02 · Research evidence" title="Evidence explorer">
        <p className="max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          Every claim the project relies on, traced to its source. Data-derived items come from FRED and SEC XBRL; business descriptions are verbatim 10-K sentences; calculations are labelled partially verified because they depend on method choices.
          By source type: {Object.entries(byOrigin).map(([k, v]) => `${k} ${v}`).join(" · ")}.
        </p>
        {view.evidenceIssues.length > 0 && <div className="mt-2"><Note tone="danger">Integrity issues: {view.evidenceIssues.join("; ")}</Note></div>}
      </Panel>
      <EvidenceExplorer
        projectId={view.config.id}
        evidence={view.evidence}
        hypotheses={view.hypotheses.map((h) => ({ id: h.id, title: h.title }))}
        memoCitations={memoCitations}
        initialId={searchParams.id}
      />
    </div>
  );
}
