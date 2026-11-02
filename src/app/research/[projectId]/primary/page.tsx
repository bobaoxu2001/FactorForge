import { notFound } from "next/navigation";
import PrimaryResearchWorkspace from "@/components/intel/PrimaryResearchWorkspace";
import { Note, OriginChip, Panel } from "@/components/intel/ui";
import { buildInterviewGuide } from "@/lib/intel/primary";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;
export const metadata = { title: "Primary research" };

export default function PrimaryResearchPage({ params }: { params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const { config } = view;
  const guides = config.stakeholders.map((s) => buildInterviewGuide(s, config.hypotheses));

  return (
    <div className="space-y-5">
      <Panel eyebrow="Stage 05 · Primary research & channel checks" title="Channel-check research plan">
        <div className="mb-3"><Note tone="warn">No interviews have been conducted for this case study, so none are shown as findings. This page is an honest plan: who to talk to, what to ask, and what each answer would confirm or refute. Real interviews you record below are stored only in your browser and labelled as your primary research.</Note></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-ink-soft">Hypotheses × stakeholders</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[12px]">
                <thead className="text-[10.5px] text-ink-soft"><tr><th className="py-1 pr-2">Stakeholder</th>{config.hypotheses.map((h) => <th key={h.id} className="px-1 text-center">{h.id}</th>)}</tr></thead>
                <tbody className="divide-soft">
                  {config.stakeholders.map((s) => (
                    <tr key={s.id}><td className="py-1 pr-2 text-ink-muted">{s.label}</td>{config.hypotheses.map((h) => <td key={h.id} className="text-center">{s.hypothesisIds.includes(h.id) ? <span className="text-accent">●</span> : <span className="text-ink-soft/40">·</span>}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11px] text-ink-soft">Key unanswered questions</div>
            <ul className="mt-1 space-y-1 text-[12px] text-ink-muted">{config.openQuestions.map((q) => <li key={q}>• {q}</li>)}</ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-soft">Compliance safeguards</div>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-ink-muted">{config.complianceNotes.map((n) => <li key={n} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-1.5">{n}</li>)}</ul>
            <div className="mt-3 text-[11px] text-ink-soft">Evidence gaps primary research can close</div>
            <ul className="mt-1 space-y-1 text-[12px] text-ink-muted">{config.hypotheses.flatMap((h) => h.missingEvidence.filter((m) => /channel|primary/i.test(m)).map((m) => <li key={h.id + m}>• {h.id}: {m}</li>))}</ul>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Interview guides" title="Question templates by stakeholder" actions={<OriginChip origin="ai-generated" />}>
        <p className="mb-3 text-[12px] text-ink-muted">Template-generated from the project hypotheses. Questions are work product, not evidence. Ask the Copilot for a tailored guide.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {guides.map((g) => (
            <details key={g.stakeholderId} className="rounded-md border border-line bg-ink/[0.02] p-3">
              <summary className="cursor-pointer text-[13px] font-medium text-ink">{g.stakeholder} <span className="ml-1 text-[11px] text-ink-soft">({g.hypotheses.map((h) => h.id).join(", ")})</span></summary>
              <p className="mt-2 text-[11.5px] text-ink-soft">{g.objective}</p>
              <div className="mt-2 text-[10.5px] text-ink-soft">Open</div>
              <ul className="text-[12px] text-ink-muted">{g.opening.map((q) => <li key={q}>– {q}</li>)}</ul>
              <div className="mt-2 text-[10.5px] text-ink-soft">Ask</div>
              <ol className="list-decimal pl-5 text-[12px] text-ink-muted">{g.questions.map((q) => <li key={q}>{q}</li>)}</ol>
              <div className="mt-2 text-[10.5px] text-ink-soft">Close</div>
              <ul className="text-[12px] text-ink-muted">{g.closing.map((q) => <li key={q}>– {q}</li>)}</ul>
              {g.cautions.length > 0 && <div className="mt-2 rounded-lg border border-amber-600/25 bg-amber-300/[0.05] px-2 py-1.5 text-[11.5px] text-amber-800/90">{g.cautions.join(" ")}</div>}
            </details>
          ))}
        </div>
      </Panel>

      <PrimaryResearchWorkspace projectId={config.id} stakeholders={config.stakeholders} />
    </div>
  );
}
