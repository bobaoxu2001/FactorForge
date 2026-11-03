import { notFound } from "next/navigation";
import MemoBuilder from "@/components/intel/MemoBuilder";
import { Panel } from "@/components/intel/ui";
import { buildMemoSections, memoMeta } from "@/lib/intel/memo";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;
export const metadata = { title: "Research memo" };

export default function MemoPage({ params }: { params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  return (
    <div className="space-y-4">
      <Panel eyebrow="Stage 07 · Investor research memo" title="Memo builder">
        <p className="max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          Public-source findings, calculations and interpretation, with a separate peer-sensitivity section. Each citation links to its dated evidence. Primary fieldwork is proposed; interview validation remains open without discounting the evidence from public statistics and company disclosures.
        </p>
      </Panel>
      <MemoBuilder projectId={view.config.id} meta={memoMeta(view)} sections={buildMemoSections(view)} status={view.memoStatus} />
    </div>
  );
}
