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
      <Panel eyebrow="AI research copilot" title="A disciplined analyst, not a stock picker">
        <p className="max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          The copilot retrieves this project&apos;s evidence and answers only from it. With <code className="text-accent">DEEPSEEK_API_KEY</code> set, a model writes the answer and a validator strips any fact that does not cite retrieved evidence. Without a key, deterministic handlers answer from the same evidence. Either way the output is AI-generated work product and never becomes evidence.
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
