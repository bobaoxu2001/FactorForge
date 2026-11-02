"use client";

import { useState } from "react";
import { memoToMarkdown, type MemoMeta } from "@/lib/intel/memo";
import { MEMO_STATUS_LABEL } from "@/lib/intel/quality";
import type { MemoSection, MemoStatus } from "@/lib/intel/types";
import { CitedText } from "./ui";
import { useWorkspace } from "./useWorkspace";

/**
 * Editable research memo. Computed sections are the source of truth; an
 * analyst can replace a section's text (kept in this browser) and the export
 * marks which sections were edited by hand.
 */
export default function MemoBuilder({ projectId, meta, sections, status }: { projectId: string; meta: MemoMeta; sections: MemoSection[]; status: MemoStatus }) {
  const { state, ready, dispatch } = useWorkspace();
  const edits = ready ? state.memoEdits[projectId] ?? {} : {};
  const interviews = ready ? state.interviews.filter((r) => r.projectId === projectId).length : 0;
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const download = () => {
    const md = memoToMarkdown(meta, sections, status, edits);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectId}-research-memo-${meta.asOf}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
        <div>
          <div className="text-[11px] text-ink-soft">Memo status</div>
          <div className="text-[15px] font-semibold text-amber-800">{MEMO_STATUS_LABEL[status]}</div>
          <div className="text-[11.5px] text-ink-muted">
            {interviews > 0 ? `${interviews} interview(s) in your workspace. Cite them in your edits; they stay unverified unless documented.` : "No primary research recorded, so this cannot become an evidence-backed report."}
            {Object.keys(edits).length > 0 && ` · ${Object.keys(edits).length} section(s) edited by you.`}
          </div>
        </div>
        <div className="flex gap-2 text-[12px]">
          <button onClick={download} className="rounded-lg border border-accent/35 bg-accent/[0.08] px-3 py-1.5 text-accent hover:bg-accent/[0.15]">Export Markdown</button>
          <button onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:text-ink">Print / PDF</button>
        </div>
      </div>
      <article className="card space-y-5 p-5 md:p-7">
        <header>
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">{meta.title}</h2>
          <p className="text-[13px] text-ink-muted">{meta.subtitle}</p>
          <p className="mt-1 text-[11.5px] text-ink-soft">As of {meta.asOf} · data snapshot {meta.builtAt.slice(0, 10)} · independent research, not investment advice</p>
        </header>
        {sections.map((s) => {
          const edited = edits[s.id];
          return (
            <section key={s.id} className="group border-t border-line/70 pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[14.5px] font-semibold text-ink"><span className="mr-2 font-mono text-[11px] text-accent/80">{String(s.number).padStart(2, "0")}</span>{s.title}</h3>
                <div className="flex gap-2 text-[11px] opacity-70 group-hover:opacity-100 print:hidden">
                  {edited !== undefined && <span className="chip border-violet-600/40 text-violet-800">edited by you</span>}
                  <button onClick={() => { setEditing(s.id); setDraft(edited ?? s.body.join("\n\n")); }} className="text-accent hover:text-ink">Edit</button>
                  {edited !== undefined && <button onClick={() => dispatch({ type: "memo/reset", projectId, sectionId: s.id })} className="text-ink-soft hover:text-ink">Restore computed</button>}
                </div>
              </div>
              {editing === s.id ? (
                <div className="mt-2 space-y-2">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="w-full rounded-lg border border-line bg-ink/[0.04] p-2 text-[12.5px] text-ink focus:border-accent/50 focus:outline-none" />
                  <div className="flex gap-2 text-[12px]">
                    <button onClick={() => { dispatch({ type: "memo/edit", projectId, sectionId: s.id, text: draft }); setEditing(null); }} className="rounded-lg border border-accent/35 bg-accent/[0.08] px-3 py-1 text-accent">Save</button>
                    <button onClick={() => setEditing(null)} className="rounded-lg border border-line px-3 py-1 text-ink-muted">Cancel</button>
                  </div>
                </div>
              ) : edited !== undefined ? (
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{edited}</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink">
                  {s.body.length === 0 ? <li className="text-ink-soft">No content: inputs unavailable.</li> : s.body.map((p, i) => <li key={i}><CitedText text={p} projectId={projectId} /></li>)}
                </ul>
              )}
              {s.limitation && <div className="mt-2 text-[11.5px] text-amber-800/80">Limitation: {s.limitation}</div>}
            </section>
          );
        })}
      </article>
    </div>
  );
}
