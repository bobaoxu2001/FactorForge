"use client";

import Link from "next/link";
import { useWorkspace } from "./useWorkspace";

/** Counts of the user's private research records (this browser only). */
export default function WorkspaceSummary({ projectId }: { projectId: string }) {
  const { state, ready } = useWorkspace();
  const interviews = ready ? state.interviews.filter((r) => r.projectId === projectId).length : 0;
  const drafts = ready ? state.drafts.filter((d) => d.projectId === projectId).length : 0;
  const edits = ready ? Object.keys(state.memoEdits[projectId] ?? {}).length : 0;
  const probabilities = ready ? Object.keys(state.scenarioProbabilities).length : 0;
  const items: Array<[string, number, string]> = [
    ["Interviews recorded", interviews, `/research/${projectId}/primary`],
    ["Copilot drafts saved", drafts, `/research/${projectId}/copilot`],
    ["Memo sections edited", edits, `/research/${projectId}/memo`],
    ["Scenario probability sets", probabilities, `/research/${projectId}/thesis`],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, n, href]) => (
        <Link key={label} href={href} className="stat-tile !p-3 transition-colors hover:border-accent/35">
          <div className="text-[10px] text-ink-soft">{label}</div>
          <div className="num mt-1 text-[19px] font-semibold text-ink">{ready ? n : "…"}</div>
        </Link>
      ))}
    </div>
  );
}
