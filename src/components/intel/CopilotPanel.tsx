"use client";

import Link from "next/link";
import { useState } from "react";
import { COPILOT_TASKS, type CopilotResponse, type CopilotTask, type Statement } from "@/lib/intel/copilotTypes";
import { newId } from "@/lib/intel/workspace";
import { EvidenceLinks, OriginChip, StatusChip } from "./ui";
import { useWorkspace } from "./useWorkspace";

interface Props {
  projectId: string;
  hypotheses: Array<{ id: string; title: string }>;
  tickers: string[];
  stakeholders: Array<{ id: string; label: string }>;
  llmConfigured: boolean;
}

const NEEDS_TEXT: CopilotTask[] = ["notes-analysis", "kpi-extract"];

function Block({ title, items, projectId, tone }: { title: string; items: Statement[]; projectId: string; tone?: string }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className={`mb-1 text-[11px] font-semibold ${tone ?? "text-ink-soft"}`}>{title}</h4>
      <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink">
        {items.map((s, i) => (
          <li key={i} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-1.5">
            {s.text} <EvidenceLinks ids={s.evidenceIds} projectId={projectId} max={5} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Generated work product carries its actual AI or template origin. */
export default function CopilotPanel({ projectId, hypotheses, tickers, stakeholders, llmConfigured }: Props) {
  const { dispatch } = useWorkspace();
  const [task, setTask] = useState<CopilotTask>("research-plan");
  const [question, setQuestion] = useState("");
  const [text, setText] = useState("");
  const [allowAi, setAllowAi] = useState(false);
  const [hypothesisId, setHypothesisId] = useState("");
  const [ticker, setTicker] = useState(tickers[0] ?? "");
  const [stakeholderId, setStakeholderId] = useState(stakeholders[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [saved, setSaved] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/research/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, task, question: question || undefined, text: NEEDS_TEXT.includes(task) ? text : undefined, allowAi, hypothesisId: hypothesisId || undefined, ticker, stakeholderId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAnswer(body as CopilotResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = () => {
    if (!answer) return;
    const body = [
      ...answer.facts.map((s) => `FACT: ${s.text} [${s.evidenceIds.join(", ")}]`),
      ...answer.calculations.map((s) => `CALC: ${s.text} [${s.evidenceIds.join(", ")}]`),
      ...answer.interpretation.map((s) => `INTERPRETATION: ${s.text}`),
      ...answer.hypotheses.map((s) => `HYPOTHESIS: ${s.text}`),
      ...answer.missing.map((s) => `MISSING: ${s.text}`),
      ...answer.followUps.map((f) => `FOLLOW-UP: ${f}`),
    ].join("\n");
    const error = dispatch({ type: "draft/save", draft: { id: newId("draft"), projectId, origin: answer.origin, task, title: COPILOT_TASKS.find((t) => t.id === task)?.label ?? task, body, createdAt: new Date().toISOString() } });
    setSaved(!error);
  };

  const input = "rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink focus:border-accent/50 focus:outline-none";

  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-ink">Ask the research copilot</h3>
          <span className={`chip ${llmConfigured ? "border-emerald-600/35 text-emerald-700" : "border-amber-600/35 text-amber-800"}`}>{llmConfigured ? "Live AI · citation checks" : "Demo · source-linked templates"}</span>
        </div>
        <label className="block text-[11px] text-ink-soft">Workflow
          <select value={task} onChange={(e) => setTask(e.target.value as CopilotTask)} className={`${input} mt-1 w-full`}>
            {COPILOT_TASKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        {(task === "evidence-check" || task === "hypotheses") && (
          <label className="block text-[11px] text-ink-soft">Hypothesis
            <select value={hypothesisId} onChange={(e) => setHypothesisId(e.target.value)} className={`${input} mt-1 w-full`}>
              <option value="">All hypotheses</option>
              {hypotheses.map((h) => <option key={h.id} value={h.id}>{h.id} {h.title}</option>)}
            </select>
          </label>
        )}
        {task === "explain-financials" && (
          <label className="block text-[11px] text-ink-soft">Company
            <select value={ticker} onChange={(e) => setTicker(e.target.value)} className={`${input} mt-1 w-full`}>{tickers.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
        )}
        {task === "interview-guide" && (
          <label className="block text-[11px] text-ink-soft">Stakeholder
            <select value={stakeholderId} onChange={(e) => setStakeholderId(e.target.value)} className={`${input} mt-1 w-full`}>{stakeholders.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>
        )}
        <label className="block text-[11px] text-ink-soft">Question (optional)
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={1000} placeholder="e.g. How much of KNX's revenue growth could be fuel surcharge?" className={`${input} mt-1 w-full`} />
        </label>
        {NEEDS_TEXT.includes(task) && (
          <div className="space-y-1">
            <label className="block text-[11px] text-ink-soft">Your notes or document text
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={12000} placeholder="Paste interview notes you recorded, or an excerpt from a document you are licensed to use." className={`${input} mt-1 w-full`} />
            </label>
            <label className="flex items-start gap-2 text-[11.5px] text-ink-muted">
              <input type="checkbox" checked={allowAi} onChange={(e) => setAllowAi(e.target.checked)} className="mt-0.5" />
              Allow sending this text (emails and phone numbers redacted) to the configured AI model. Unchecked: analysed by deterministic rules on the server and not forwarded. Text with possible MNPI is never forwarded.
            </label>
          </div>
        )}
        <button onClick={run} disabled={loading} className="w-full rounded-lg border border-accent/40 bg-accent/[0.1] px-3 py-2 text-[13px] font-medium text-accent hover:bg-accent/[0.18] disabled:opacity-50">{loading ? "Working…" : "Run"}</button>
        {error && <div className="text-[12px] text-rose-700">{error}</div>}
        <p className="text-[11px] leading-relaxed text-ink-soft">Rules: facts and calculations must cite retrieved evidence or are moved to &ldquo;unsupported&rdquo;; interpretation and hypotheses are labelled; nothing here is a recommendation.</p>
      </div>

      <div className="card min-h-[320px] space-y-4 p-4">
        {!answer ? (
          <div className="grid h-full place-items-center text-center text-[12.5px] text-ink-soft">Choose a workflow and run it. Answers are split into facts, calculations, interpretation, hypotheses and missing information.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><OriginChip origin={answer.origin} /><span className="text-[11.5px] text-ink-muted">{answer.source === "deepseek" ? "DeepSeek · citation IDs checked; claim support requires review" : "Source-linked rules and templates"}</span></div>
              <button onClick={saveDraft} className="text-[12px] text-accent hover:text-ink">{saved ? "Saved to workspace drafts" : "Save as draft"}</button>
            </div>
            {answer.warnings.length > 0 && <div className="space-y-1 rounded-md border border-amber-600/25 bg-amber-300/[0.06] p-2 text-[11.5px] text-amber-800/90">{answer.warnings.map((w) => <div key={w}>• {w}</div>)}</div>}
            <Block title="Facts (cited)" items={answer.facts} projectId={projectId} tone="text-emerald-700" />
            <Block title="Calculations (cited)" items={answer.calculations} projectId={projectId} tone="text-accent" />
            <Block title="Interpretation" items={answer.interpretation} projectId={projectId} tone="text-amber-800" />
            <Block title="Hypotheses (untested)" items={answer.hypotheses} projectId={projectId} tone="text-violet-700" />
            <Block title="Missing information" items={answer.missing} projectId={projectId} tone="text-rose-700" />
            {answer.followUps.length > 0 && (
              <section>
                <h4 className="mb-1 text-[11px] font-semibold text-ink-soft">Follow-up research</h4>
                <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-ink-muted">{answer.followUps.map((f) => <li key={f}>{f}</li>)}</ol>
              </section>
            )}
            {answer.unsupported.length > 0 && (
              <section className="rounded-md border border-rose-600/30 bg-rose-400/[0.05] p-3">
                <h4 className="mb-1 text-[11px] font-semibold text-rose-700">Removed: uncited or unverifiable statements</h4>
                <ul className="space-y-1 text-[12px] text-rose-800/80 line-through decoration-rose-300/40">{answer.unsupported.map((s, i) => <li key={i}>{s.text}</li>)}</ul>
              </section>
            )}
            <details className="text-[11.5px]">
              <summary className="cursor-pointer text-ink-soft">Retrieved evidence ({answer.retrieved.length})</summary>
              <ul className="mt-1 space-y-1">{answer.retrieved.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 text-ink-muted"><Link href={`/research/${projectId}/evidence?id=${r.id}`} className="num text-accent">{r.id}</Link><StatusChip status={r.status as never} />{r.claim}</li>)}</ul>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
