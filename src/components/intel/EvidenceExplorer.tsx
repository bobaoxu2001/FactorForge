"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Evidence, EvidenceOrigin, VerificationStatus } from "@/lib/intel/types";
import { OriginChip, StatusChip } from "./ui";
import { useWorkspace } from "./useWorkspace";

interface Props {
  projectId: string;
  evidence: Evidence[];
  hypotheses: Array<{ id: string; title: string }>;
  memoCitations: Record<string, string[]>;
  initialId?: string;
}

const ORIGINS: EvidenceOrigin[] = ["public-secondary", "user-primary", "ai-generated", "hypothesis"];
const STATUSES: VerificationStatus[] = ["verified", "partially-verified", "unverified", "contradicted", "stale"];

/**
 * Evidence Explorer: filter every claim the project relies on and trace it to
 * its source. The user's own interview notes (stored in this browser) appear
 * alongside public evidence, clearly typed as user-primary research.
 */
export default function EvidenceExplorer({ projectId, evidence, hypotheses, memoCitations, initialId }: Props) {
  const { state, ready, dispatch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<EvidenceOrigin | "all">("all");
  const [status, setStatus] = useState<VerificationStatus | "all">("all");
  const [hyp, setHyp] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);

  const userEvidence: Evidence[] = useMemo(
    () =>
      ready
        ? state.interviews
            .filter((r) => r.projectId === projectId)
            .map((r) => ({
              id: `UP-${r.id}`,
              projectId,
              subject: `Interview: ${r.sourceDescription}`,
              claim: r.notes.length > 220 ? `${r.notes.slice(0, 217)}…` : r.notes,
              excerpt: r.notes,
              location: `Your workspace · interview on ${r.interviewDate}${r.consentToQuote ? " · may be quoted" : " · not for quotation"}`,
              source: { id: `UP:${r.id}`, title: "Your interview notes", publisher: "You (user-provided)", documentRef: r.documentRef, sourceType: "user-primary-research" as const, retrievedAt: r.createdAt },
              origin: "user-primary" as const,
              status: r.status,
              confidence: "low" as const,
              confidenceRationale: "Single-source primary research recorded by you; not independently verified by FactorForge.",
              observationPeriod: { end: r.interviewDate },
              retrievedAt: r.createdAt,
              kpiIds: [],
              tickers: [],
              hypothesisIds: [],
              stance: {},
            }))
        : [],
    [ready, state.interviews, projectId],
  );

  const all = useMemo(() => [...evidence, ...userEvidence], [evidence, userEvidence]);
  const q = query.trim().toLowerCase();
  const filtered = all.filter(
    (e) =>
      (origin === "all" || e.origin === origin) &&
      (status === "all" || e.status === status) &&
      (hyp === "all" || e.hypothesisIds.includes(hyp)) &&
      (!q || `${e.id} ${e.subject} ${e.claim} ${e.tickers.join(" ")} ${e.source.publisher}`.toLowerCase().includes(q)),
  );
  const selected = all.find((e) => e.id === selectedId) ?? filtered[0];
  const note = selected ? state.evidenceNotes[selected.id] ?? "" : "";

  const counts = (key: "origin" | "status", value: string) => all.filter((e) => e[key] === value).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-3">
        <div className="card space-y-2 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search claims, tickers, sources…"
            className="h-9 w-full rounded-lg border border-line bg-ink/[0.04] px-3 text-[12.5px] text-ink placeholder:text-ink-soft focus:border-accent/50 focus:outline-none"
            aria-label="Search evidence"
          />
          <div className="flex flex-wrap gap-2 text-[11.5px]">
            <select aria-label="Origin" value={origin} onChange={(e) => setOrigin(e.target.value as EvidenceOrigin | "all")} className="h-8 rounded-lg border border-line bg-paper px-2 text-ink-muted">
              <option value="all">All origins ({all.length})</option>
              {ORIGINS.map((o) => <option key={o} value={o}>{o} ({counts("origin", o)})</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as VerificationStatus | "all")} className="h-8 rounded-lg border border-line bg-paper px-2 text-ink-muted">
              <option value="all">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s} ({counts("status", s)})</option>)}
            </select>
            <select aria-label="Hypothesis" value={hyp} onChange={(e) => setHyp(e.target.value)} className="h-8 rounded-lg border border-line bg-paper px-2 text-ink-muted">
              <option value="all">All hypotheses</option>
              {hypotheses.map((h) => <option key={h.id} value={h.id}>{h.id} {h.title}</option>)}
            </select>
          </div>
        </div>
        <ul className="max-h-[640px] space-y-1.5 overflow-y-auto pr-1" aria-label="Evidence list">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelectedId(e.id)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${selected?.id === e.id ? "border-accent/45 bg-accent/[0.07]" : "border-line bg-ink/[0.02] hover:border-accent/25"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-[10.5px] text-accent/90">{e.id}</span>
                  <StatusChip status={e.status} />
                </div>
                <div className="mt-1 text-[12px] leading-snug text-ink">{e.claim}</div>
                <div className="mt-1 text-[10.5px] text-ink-soft">{e.source.publisher} · {e.observationPeriod?.end ?? "n/a"}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="rounded-md border border-dashed border-line p-4 text-center text-[12px] text-ink-soft">No evidence matches these filters.</li>}
        </ul>
      </div>

      {selected ? (
        <article className="card space-y-3 p-4 xl:sticky xl:top-32 xl:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-[11px] text-accent">{selected.id}</span>
            <StatusChip status={selected.status} />
            <OriginChip origin={selected.origin} />
            <span className="chip border-line text-ink-muted">confidence: {selected.confidence}</span>
          </div>
          <div className="text-[11px] text-ink-soft">{selected.subject}</div>
          <p className="text-[14px] leading-relaxed text-ink">{selected.claim}</p>
          {selected.excerpt && (
            <blockquote className="rounded-md border-l-2 border-accent/50 bg-ink/[0.03] px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
              {selected.origin === "public-secondary" && selected.source.sourceType === "sec-filing" ? <>&ldquo;{selected.excerpt}&rdquo;</> : selected.excerpt}
            </blockquote>
          )}
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
            <dt className="text-ink-soft">Source</dt>
            <dd className="text-ink-muted">
              {selected.source.url ? (
                <a href={selected.source.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">{selected.source.title} ↗</a>
              ) : (
                <span>{selected.source.title}{selected.source.documentRef ? ` · ref: ${selected.source.documentRef}` : " · no document reference"}</span>
              )}
            </dd>
            <dt className="text-ink-soft">Publisher</dt><dd className="text-ink-muted">{selected.source.publisher}</dd>
            <dt className="text-ink-soft">Location</dt><dd className="text-ink-muted">{selected.location ?? "—"}</dd>
            <dt className="text-ink-soft">Observation</dt><dd className="text-ink-muted">{selected.observationPeriod ? `${selected.observationPeriod.start ? `${selected.observationPeriod.start} → ` : ""}${selected.observationPeriod.end}` : "—"}</dd>
            <dt className="text-ink-soft">Published</dt><dd className="text-ink-muted">{selected.publishedAt ?? "—"}</dd>
            <dt className="text-ink-soft">Retrieved</dt><dd className="text-ink-muted">{selected.retrievedAt ? new Date(selected.retrievedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—"}</dd>
            {selected.source.licence && (<><dt className="text-ink-soft">Licence</dt><dd className="text-ink-muted">{selected.source.licence}</dd></>)}
            <dt className="text-ink-soft">Confidence</dt><dd className="text-ink-muted">{selected.confidenceRationale}</dd>
            <dt className="text-ink-soft">Hypotheses</dt>
            <dd className="text-ink-muted">
              {Object.entries(selected.stance).length === 0
                ? "Not used by a hypothesis test"
                : Object.entries(selected.stance).map(([h, s]) => (
                    <div key={h} className="mb-2"><span className={s === "supports" ? "text-emerald-700" : s === "contradicts" ? "text-rose-700" : "text-ink-muted"}>{h}: {s === "supports" ? "direction consistent" : s === "contradicts" ? "direction against" : "context"}</span>{selected.stanceReasons?.[h] && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{selected.stanceReasons[h]}</p>}</div>
                  ))}
            </dd>
            <dt className="text-ink-soft">Related</dt>
            <dd className="flex flex-wrap gap-2 text-ink-muted">
              {selected.tickers.map((t) => <Link key={t} href={`/research/${projectId}/companies/${t}`} className="text-accent hover:text-ink">{t}</Link>)}
              {selected.kpiIds.map((k) => <Link key={k} href={`/research/${projectId}/kpis?kpi=${k}`} className="text-accent hover:text-ink">{k}</Link>)}
            </dd>
            <dt className="text-ink-soft">Cited in memo</dt>
            <dd className="text-ink-muted">{(memoCitations[selected.id] ?? []).length ? (memoCitations[selected.id] ?? []).join(", ") : "Not cited"}</dd>
          </dl>
          <label className="block text-[11px] text-ink-soft">
            Your note (stored in this browser)
            <textarea
              value={note}
              onChange={(e) => dispatch({ type: "evidence/note", evidenceId: selected.id, note: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-line bg-ink/[0.04] p-2 text-[12.5px] normal-case tracking-normal text-ink focus:border-accent/50 focus:outline-none"
              placeholder="e.g. Check whether the PPI includes fuel surcharges (BLS methodology)."
            />
          </label>
        </article>
      ) : (
        <div className="card grid place-items-center p-8 text-[12.5px] text-ink-soft">Select an evidence item.</div>
      )}
    </div>
  );
}
