"use client";

import { useMemo, useRef, useState } from "react";
import type { StakeholderCategory } from "@/data/research/types";
import { analyzeNotes, contradictionsWithHypotheses, crossSourceAgreement, redactPersonalData, screenText, type ScreenFlag } from "@/lib/intel/primary";
import { migrateWorkspace, newId, serializeWorkspace, type InterviewRecord } from "@/lib/intel/workspace";
import { OriginChip, StatusChip } from "./ui";
import { useWorkspace } from "./useWorkspace";

const STATUSES: InterviewRecord["status"][] = ["unverified", "partially-verified", "verified", "contradicted"];

/**
 * Record and analyse YOUR channel checks. Everything stays in this browser.
 * Notes are screened for personal data and MNPI language before saving, and
 * the user must acknowledge any flag explicitly.
 */
export default function PrimaryResearchWorkspace({ projectId, stakeholders }: { projectId: string; stakeholders: StakeholderCategory[] }) {
  const { state, ready, persisted, dispatch } = useWorkspace();
  const [stakeholderId, setStakeholderId] = useState(stakeholders[0]?.id ?? "");
  const [sourceDescription, setSourceDescription] = useState("");
  const [interviewDate, setInterviewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [consentToQuote, setConsentToQuote] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<InterviewRecord["status"]>("unverified");
  const [documentRef, setDocumentRef] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flags: ScreenFlag[] = useMemo(() => screenText(`${sourceDescription}\n${notes}`), [sourceDescription, notes]);
  const interviews = useMemo(() => (ready ? state.interviews.filter((r) => r.projectId === projectId) : []), [ready, state.interviews, projectId]);
  const analyses = useMemo(() => interviews.map((r) => ({ id: r.id, label: r.sourceDescription, record: r, analysis: analyzeNotes(r.notes) })), [interviews]);
  const agreement = useMemo(() => crossSourceAgreement(analyses), [analyses]);
  const coverage = stakeholders.map((s) => ({ s, n: interviews.filter((r) => r.stakeholderId === s.id).length }));

  const save = () => {
    if (flags.length > 0 && !acknowledged) {
      setMessage("Review the compliance flags and confirm before saving.");
      return;
    }
    const now = new Date().toISOString();
    const error = dispatch({
      type: "interview/save",
      record: {
        id: newId("int"),
        projectId,
        origin: "user-primary",
        stakeholderId,
        // Contact details are redacted on save regardless of acknowledgement.
        sourceDescription: redactPersonalData(sourceDescription.trim()) || "Unnamed source",
        interviewDate,
        consentToQuote,
        notes: redactPersonalData(notes),
        status,
        documentRef: documentRef.trim() || undefined,
        acknowledgedFlags: flags.map((f) => f.kind),
        createdAt: now,
        updatedAt: now,
      },
    });
    if (error) {
      setMessage(error);
      return;
    }
    setNotes("");
    setSourceDescription("");
    setDocumentRef("");
    setAcknowledged(false);
    setStatus("unverified");
    setMessage("Saved to this browser. It is not sent anywhere.");
  };

  const exportJson = () => {
    const blob = new Blob([serializeWorkspace(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factorforge-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const imported = migrateWorkspace(JSON.parse(await file.text()));
      dispatch({ type: "replace", state: { ...imported, interviews: [...state.interviews.filter((r) => !imported.interviews.some((i) => i.id === r.id)), ...imported.interviews] } });
      setMessage(`Imported ${imported.interviews.length} interview(s). Invalid or mislabelled records were dropped.`);
    } catch {
      setMessage("Could not read that file.");
    }
  };

  const input = "w-full rounded-lg border border-line bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-ink focus:border-cyan-300/50 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-white">Record an interview or channel check</h3>
            <OriginChip origin="user-primary" />
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-soft">Only record conversations you actually had, with consent. Describe the source by role, not by name. Stored in this browser only{!persisted && " (storage unavailable: kept in memory until you leave)"}.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-ink-soft">Stakeholder type
              <select value={stakeholderId} onChange={(e) => setStakeholderId(e.target.value)} className={`${input} mt-1 bg-[#07111d]`}>
                {stakeholders.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-ink-soft">Interview date
              <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-[11px] text-ink-soft">Source description (role, not name)
            <input value={sourceDescription} onChange={(e) => setSourceDescription(e.target.value)} placeholder="e.g. Owner, 40-truck reefer fleet, Midwest" className={`${input} mt-1`} />
          </label>
          <label className="block text-[11px] text-ink-soft">Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder="What did they observe directly? Volumes, spot vs contract rates ex-fuel, capacity, fuel, inventory…" className={`${input} mt-1`} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-ink-soft">Verification status
              <select value={status} onChange={(e) => setStatus(e.target.value as InterviewRecord["status"])} className={`${input} mt-1 bg-[#07111d]`}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-ink-soft">Document reference {status === "verified" && <span className="text-amber-200">(required)</span>}
              <input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} placeholder="e.g. calls/2026-11-03-carrier.pdf" className={`${input} mt-1`} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-ink-muted"><input type="checkbox" checked={consentToQuote} onChange={(e) => setConsentToQuote(e.target.checked)} /> Source consented to being quoted (anonymised)</label>
          {flags.length > 0 && (
            <div className="space-y-1 rounded-xl border border-rose-300/30 bg-rose-400/[0.06] p-3 text-[12px] text-rose-50/90">
              <div className="font-semibold">Compliance screen</div>
              {flags.map((f) => <div key={`${f.kind}-${f.match}`}>• {f.message} <span className="font-mono text-[11px] text-rose-200">({f.match})</span></div>)}
              <label className="mt-1 flex items-start gap-2"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5" /> Emails, phone numbers and ID numbers will be redacted on save. I confirm these notes contain no material non-public information and I have permission to keep them.</label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={!notes.trim()} className="rounded-lg border border-cyan-300/35 bg-cyan-300/[0.08] px-3 py-1.5 text-[12.5px] text-cyan-100 hover:bg-cyan-300/[0.15] disabled:opacity-40">Save interview</button>
            {message && <span className="text-[11.5px] text-ink-muted">{message}</span>}
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h3 className="text-[14px] font-semibold text-white">Coverage tracker</h3>
          <ul className="space-y-1.5 text-[12px]">
            {coverage.map(({ s, n }) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5">
                <span className="text-ink">{s.label}<span className="ml-2 text-[10.5px] text-ink-soft">tests {s.hypothesisIds.join(", ")}</span></span>
                <span className={n > 0 ? "text-emerald-300" : "text-ink-soft"}>{n} interview{n === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
          <div className="text-[11.5px] text-ink-muted">Research confidence from primary sources: <span className="text-ink">{interviews.length === 0 ? "none: no interviews yet" : interviews.length < 3 ? "low: single or few sources" : agreement.some((a) => a.agreement === "disagree") ? "contested: sources disagree on at least one theme" : "moderate: several sources, no disagreement detected"}</span></div>
          <div className="flex flex-wrap gap-2 text-[12px]">
            <button onClick={exportJson} className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:text-white">Export workspace (JSON)</button>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:text-white">Import…</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </div>
          {agreement.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ink-soft">Cross-source comparison</div>
              <table className="w-full text-left text-[11.5px]">
                <thead className="text-ink-soft"><tr><th className="py-1">Theme</th><th>Up</th><th>Down</th><th>Mixed</th><th>Read</th></tr></thead>
                <tbody className="divide-soft text-ink-muted">
                  {agreement.map((a) => (
                    <tr key={a.theme}><td className="py-1 text-ink">{a.label}</td><td>{a.up.length}</td><td>{a.down.length}</td><td>{a.mixed.length}</td><td className={a.agreement === "disagree" ? "text-amber-200" : ""}>{a.agreement}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-[14px] font-semibold text-white">Your interviews ({interviews.length})</h3>
        {interviews.length === 0 && <div className="card border-dashed p-5 text-center text-[12.5px] text-ink-soft">No primary research recorded. The memo will stay a draft with incomplete verification until real channel checks are added.</div>}
        {analyses.map(({ id, record, analysis }) => {
          const contradictions = contradictionsWithHypotheses(analysis);
          return (
            <article key={id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-medium text-ink">{record.sourceDescription}</div>
                  <div className="text-[11px] text-ink-soft">{stakeholders.find((s) => s.id === record.stakeholderId)?.label} · {record.interviewDate} · {record.consentToQuote ? "quotable (anonymised)" : "not for quotation"}{record.documentRef ? ` · ref ${record.documentRef}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <OriginChip origin="user-primary" />
                  <StatusChip status={record.status} />
                  <button onClick={() => dispatch({ type: "interview/delete", id })} className="text-[11.5px] text-rose-200 hover:text-white">Delete</button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">{record.notes}</p>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-line p-2 text-[11.5px]">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Themes (direction)</div>
                  {analysis.themes.length === 0 ? <span className="text-ink-soft">none detected</span> : analysis.themes.map((t) => <div key={t.theme} className="text-ink-muted">{t.label}: <span className={t.direction === "up" ? "text-emerald-300" : t.direction === "down" ? "text-rose-300" : "text-amber-200"}>{t.direction}</span></div>)}
                </div>
                <div className="rounded-lg border border-line p-2 text-[11.5px]">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Reported indicators</div>
                  {analysis.indicators.length === 0 ? <span className="text-ink-soft">no numbers mentioned</span> : analysis.indicators.slice(0, 5).map((i) => <div key={i.context + i.value} className="text-ink-muted"><span className="text-ink">{i.value}</span>: {i.context}</div>)}
                </div>
                <div className="rounded-lg border border-line p-2 text-[11.5px]">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Versus hypotheses</div>
                  {contradictions.length === 0 ? <span className="text-ink-soft">no contradictions detected</span> : contradictions.map((c) => <div key={c.hypothesisId + c.theme} className="text-amber-100/90">Contradicts {c.hypothesisId} ({c.theme} {c.observed})</div>)}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
