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
          Nineteen sections assembled from the project&apos;s computed evidence. Each citation links to its source in the Evidence Explorer. Status follows the research-quality checks: without recorded primary research the memo is a draft with incomplete verification, whatever the public data says.
        </p>
      </Panel>
      <MemoBuilder projectId={view.config.id} meta={memoMeta(view)} sections={buildMemoSections(view)} status={view.memoStatus} />
    </div>
  );
}
