import { notFound } from "next/navigation";
import CopilotPanel from "@/components/intel/CopilotPanel";
import { Panel } from "@/components/intel/ui";
import { isDeepseekConfigured } from "@/lib/ai/deepseek";
import { getResearchProject } from "@/lib/intel/project";

export const dynamic = "force-dynamic";
export const metadata = { title: "Research copilot" };

export default function CopilotPage({ params }: { params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  return (
    <div className="space-y-4">
      <Panel eyebrow="AI research copilot" title="Research assistance grounded in this case study">
        <p className="max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          {isDeepseekConfigured() ? "Live AI is available for supported workflows, with retrieved evidence and citation checks. A citation check confirms the reference exists; an analyst still needs to check that it supports the statement." : "This public demo uses source-linked templates and rules to demonstrate the research workflow. Live model generation is not enabled. You can explore the same evidence, compare views and generate an interview guide."} Outputs are labelled as work product and remain separate from source evidence. No measured time-saving or accuracy improvement is claimed.
        </p>
      </Panel>
      <CopilotPanel
        projectId={view.config.id}
        hypotheses={view.hypotheses.map((h) => ({ id: h.id, title: h.title }))}
        tickers={view.companies.map((c) => c.ticker)}
        stakeholders={view.config.stakeholders.map((s) => ({ id: s.id, label: s.label }))}
        llmConfigured={isDeepseekConfigured()}
      />
    </div>
  );
}
