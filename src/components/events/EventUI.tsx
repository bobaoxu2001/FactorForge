import Link from "next/link";
import type { ReactNode } from "react";
import type { ThesisStatus } from "@/lib/events/thesis";
import { TIER_LABEL } from "@/lib/events/sources";
import type { ClaimView, EpistemicClass, LifecycleState, SourceRecord, VerificationState } from "@/lib/events/types";

/**
 * Event-intelligence UI vocabulary. Same rule as the freight case: one colour
 * per meaning. Verification uses the evidence palette; what kind of statement
 * something is (fact, claim, interpretation, hypothesis, estimate) is shown in
 * words with a neutral style, so a hypothesis never looks like a finding.
 */

const VERIFICATION_STYLE: Record<VerificationState, string> = {
  CONFIRMED: "border-emerald-600/35 bg-emerald-500/10 text-emerald-700",
  CORROBORATED: "border-accent/35 bg-accent/10 text-accent",
  REPORTED: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  RUMOR: "border-dashed border-amber-700/45 bg-transparent text-amber-800",
  DISPUTED: "border-rose-600/40 bg-rose-400/10 text-rose-800",
};

const VERIFICATION_LABEL: Record<VerificationState, string> = {
  CONFIRMED: "confirmed",
  CORROBORATED: "corroborated",
  REPORTED: "reported",
  RUMOR: "rumour",
  DISPUTED: "disputed",
};

export function VerificationChip({ state, title }: { state: VerificationState; title?: string }) {
  return (
    <span className={`chip ${VERIFICATION_STYLE[state]}`} title={title}>
      {VERIFICATION_LABEL[state]}
    </span>
  );
}

export const EPISTEMIC_LABEL: Record<EpistemicClass, string> = {
  OBSERVED_FACT: "observed fact",
  REPORTED_CLAIM: "reported claim",
  ANALYST_INTERPRETATION: "interpretation",
  CAUSAL_HYPOTHESIS: "causal hypothesis",
  MODEL_ESTIMATE: "model estimate",
  UNKNOWN: "unknown",
};

export function EpistemicChip({ value }: { value: EpistemicClass }) {
  const dashed = value === "CAUSAL_HYPOTHESIS" || value === "ANALYST_INTERPRETATION" || value === "UNKNOWN";
  return <span className={`chip border-ink/20 ${dashed ? "border-dashed" : ""} bg-transparent text-ink-muted`}>{EPISTEMIC_LABEL[value]}</span>;
}

const LIFECYCLE_STYLE: Record<LifecycleState, string> = {
  OPEN: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  PROPOSED: "border-dashed border-ink/25 bg-transparent text-ink-muted",
  ENACTED: "border-ink/30 bg-ink/[0.04] text-ink",
  IMPLEMENTED: "border-ink/30 bg-ink/[0.04] text-ink",
  REVISED: "border-accent/35 bg-accent/10 text-accent",
  RESOLVED: "border-ink/20 bg-transparent text-ink-soft",
};

export function LifecycleChip({ state, guard }: { state: LifecycleState; guard?: string }) {
  return (
    <span className={`chip ${LIFECYCLE_STYLE[state]}`} title={guard}>
      {state.toLowerCase()}
      {guard ? " (guarded)" : ""}
    </span>
  );
}

const THESIS_STYLE: Record<ThesisStatus, string> = {
  ACTIVE: "border-accent/35 bg-accent/10 text-accent",
  STRENGTHENED: "border-emerald-600/35 bg-emerald-500/10 text-emerald-700",
  WEAKENED: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  UNDER_REVIEW: "border-amber-700/45 bg-amber-400/15 text-amber-900",
  INVALIDATED: "border-rose-600/40 bg-rose-400/10 text-rose-800",
  CLOSED: "border-ink/25 bg-ink/[0.04] text-ink-muted",
};

export function ThesisStatusChip({ status }: { status: ThesisStatus }) {
  return <span className={`chip ${THESIS_STYLE[status]}`}>{status.replace("_", " ").toLowerCase()}</span>;
}

export function OriginChip({ origin }: { origin: "live" | "backfill" }) {
  return origin === "live" ? (
    <span className="chip border-accent/35 bg-accent/10 text-accent" title="Made before the outcome it predicts could be observed.">live</span>
  ) : (
    <span className="chip border-dashed border-ink/30 bg-transparent text-ink-muted" title="Made later using only data available at its cutoff. A worked example, not a track record.">
      backfill
    </span>
  );
}

const fmtDateTime = (iso: string, precision: "minute" | "day" = "minute") => {
  // A day-precision time is stored as the end of that day in its own time zone;
  // show that local calendar date, not the UTC date it rolls into.
  if (precision === "day") {
    return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
};

export function When({ iso, precision = "minute" }: { iso: string; precision?: "minute" | "day" }) {
  return (
    <time dateTime={iso} className="num" title={iso}>
      {fmtDateTime(iso, precision)}
    </time>
  );
}

export function SourceLine({ source }: { source: SourceRecord }) {
  return (
    <span>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
        {source.publisher}
      </a>
      <span className="text-ink-soft"> · {TIER_LABEL[source.tier]}</span>
      {source.retrieval !== "read" && <span className="ml-1 text-rose-800">· not read ({source.retrieval})</span>}
    </span>
  );
}

/** A claim with its kind, verification and every citation, each linked to its source. */
export function ClaimCard({ claim, sources, compact = false }: { claim: ClaimView; sources: Map<string, SourceRecord>; compact?: boolean }) {
  return (
    <article id={claim.id} className="scroll-mt-28 border-t border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="num text-[11.5px] font-medium text-ink-soft">{claim.id}</span>
        <VerificationChip state={claim.verification} title={claim.verificationReason} />
        <EpistemicChip value={claim.epistemic} />
        {claim.effectiveLifecycle && <LifecycleChip state={claim.effectiveLifecycle} guard={claim.lifecycleGuard} />}
      </div>
      <p className="mt-1.5 max-w-[80ch] text-[14px] leading-relaxed text-ink">{claim.statement}</p>
      {!compact && (
        <>
          <p className="mt-1 text-[12.5px] text-ink-muted">{claim.verificationReason}</p>
          {claim.lifecycleGuard && <p className="mt-1 text-[12.5px] text-amber-800">{claim.lifecycleGuard}</p>}
          <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-muted">
            {claim.citations.map((c) => {
              const s = sources.get(c.sourceId);
              return (
                <li key={c.sourceId} className={c.stance === "contradicts" ? "text-rose-800" : undefined}>
                  {s ? <SourceLine source={s} /> : <span>{c.sourceId}</span>}
                  {c.stance === "contradicts" && <span className="font-medium"> · contradicts</span>}
                  {c.secondHand && <span> · second-hand</span>}
                  {c.unattributed && <span> · unnamed sourcing</span>}
                  <span className="text-ink"> — {c.says}</span>
                </li>
              );
            })}
          </ul>
          {claim.notes && <p className="mt-1.5 text-[12.5px] italic text-ink-muted">{claim.notes}</p>}
          {claim.corrections?.length ? (
            <ul className="mt-1.5 space-y-0.5 text-[12px] text-ink-muted" aria-label="Corrections">
              {claim.corrections.map((c) => (
                <li key={c.at + c.note}>
                  <span className="font-medium text-ink">Corrected {c.at.slice(0, 10)}:</span> {c.note}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </article>
  );
}

/** Renders a claim id or a market-check reference as a link into the case. */
export function EvidenceRef({ id, caseSlug }: { id: string; caseSlug: string }) {
  if (id.startsWith("MKT:")) {
    const [, windowId, symbol] = id.split(":");
    return (
      <Link href={`/events/${caseSlug}/market#${windowId}`} className="num inline-block whitespace-nowrap rounded border border-ink/15 bg-panel2 px-1 py-px text-[11px] text-ink-muted hover:text-ink">
        market: {symbol}
      </Link>
    );
  }
  if (id.startsWith("EXP:")) {
    const [, ticker, dim] = id.split(":");
    return (
      <Link href={`/events/${caseSlug}/impact#exposure`} className="num inline-block whitespace-nowrap rounded border border-ink/15 bg-panel2 px-1 py-px text-[11px] text-ink-muted hover:text-ink">
        exposure: {ticker} {dim === "directRevenue" ? "revenue" : dim}
      </Link>
    );
  }
  return (
    <Link href={`/events/${caseSlug}/evidence#${id}`} className="num inline-block whitespace-nowrap rounded border border-accent/20 bg-accent-soft px-1 py-px text-[11px] font-medium text-accent hover:underline">
      {id}
    </Link>
  );
}

export function EvidenceRefs({ ids, caseSlug, empty = "none" }: { ids: string[]; caseSlug: string; empty?: ReactNode }) {
  if (ids.length === 0) return <span className="text-[12px] text-ink-soft">{empty}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => (
        <EvidenceRef key={id} id={id} caseSlug={caseSlug} />
      ))}
    </span>
  );
}

/** Inline text with [ID] citations turned into links. */
export function CitedProse({ text, caseSlug }: { text: string; caseSlug: string }) {
  const parts = text.split(/(\[[A-Z]-C\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([A-Z]-C\d+)\]$/);
        return m ? <EvidenceRef key={i} id={m[1]} caseSlug={caseSlug} /> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

export const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
export const tone = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "text-ink-muted" : v >= 0 ? "text-emerald-700" : "text-rose-700");
