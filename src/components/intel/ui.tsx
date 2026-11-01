import Link from "next/link";
import type { ReactNode } from "react";
import type { EvidenceOrigin, Freshness, RelationshipStatus, TestOutcome, TriggerState, VerificationStatus } from "@/lib/intel/types";

/**
 * Shared research UI primitives. One visual vocabulary for provenance across
 * every research page: the same colour always means the same status.
 */

const STATUS_STYLE: Record<VerificationStatus, string> = {
  verified: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  "partially-verified": "border-cyan-300/35 bg-cyan-400/10 text-cyan-100",
  unverified: "border-amber-300/35 bg-amber-400/10 text-amber-100",
  contradicted: "border-rose-300/40 bg-rose-400/10 text-rose-100",
  stale: "border-slate-400/35 bg-slate-400/10 text-slate-200",
};

export function StatusChip({ status }: { status: VerificationStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{status.replace("-", " ")}</span>;
}

const ORIGIN_STYLE: Record<EvidenceOrigin, { label: string; cls: string }> = {
  "public-secondary": { label: "public source", cls: "border-blue-300/35 bg-blue-400/10 text-blue-100" },
  "user-primary": { label: "your primary research", cls: "border-violet-300/40 bg-violet-400/10 text-violet-100" },
  "ai-generated": { label: "AI-generated · not evidence", cls: "border-dashed border-amber-300/45 bg-transparent text-amber-100" },
  hypothesis: { label: "hypothesis", cls: "border-dashed border-slate-300/40 bg-transparent text-slate-200" },
};

export function OriginChip({ origin }: { origin: EvidenceOrigin }) {
  const o = ORIGIN_STYLE[origin];
  return <span className={`chip ${o.cls}`}>{o.label}</span>;
}

const OUTCOME_STYLE: Record<TestOutcome, string> = {
  supports: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  contradicts: "border-rose-300/40 bg-rose-400/10 text-rose-100",
  mixed: "border-amber-300/35 bg-amber-400/10 text-amber-100",
  "insufficient-data": "border-slate-400/35 bg-slate-400/10 text-slate-200",
};

export function OutcomeBadge({ outcome }: { outcome: TestOutcome }) {
  return <span className={`chip ${OUTCOME_STYLE[outcome]}`}>{outcome === "insufficient-data" ? "insufficient data" : outcome}</span>;
}

const TRIGGER_STYLE: Record<TriggerState, string> = {
  holding: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  triggered: "border-rose-300/45 bg-rose-400/15 text-rose-100",
  "insufficient-data": "border-slate-400/35 bg-slate-400/10 text-slate-200",
};

export function TriggerBadge({ state }: { state: TriggerState }) {
  return <span className={`chip ${TRIGGER_STYLE[state]}`}>{state === "holding" ? "not triggered" : state === "triggered" ? "triggered" : "insufficient data"}</span>;
}

const REL_STYLE: Record<RelationshipStatus, string> = {
  verified: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  inferred: "border-amber-300/35 bg-amber-400/10 text-amber-100",
  hypothetical: "border-dashed border-slate-300/40 bg-transparent text-slate-200",
};

export function RelationshipChip({ status }: { status: RelationshipStatus }) {
  return <span className={`chip ${REL_STYLE[status]}`}>{status}</span>;
}

const FRESH_STYLE: Record<Freshness, string> = {
  fresh: "text-emerald-200",
  lagging: "text-amber-200",
  stale: "text-rose-200",
};

export function FreshnessDot({ freshness, note }: { freshness: Freshness; note?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${FRESH_STYLE[freshness]}`} title={note}>
      <span className={`h-1.5 w-1.5 rounded-full ${freshness === "fresh" ? "bg-emerald-300" : freshness === "lagging" ? "bg-amber-300" : "bg-rose-300"}`} />
      {freshness}
    </span>
  );
}

/** Inline citation chip linking to the Evidence Explorer. */
export function EvidenceLink({ id, projectId, title }: { id: string; projectId: string; title?: string }) {
  return (
    <Link
      href={`/research/${projectId}/evidence?id=${encodeURIComponent(id)}`}
      title={title}
      className="mx-0.5 inline-flex items-center rounded-md border border-blue-300/25 bg-blue-400/[0.07] px-1.5 py-[1px] font-mono text-[10px] text-blue-100/90 transition-colors hover:border-blue-300/55 hover:bg-blue-400/15"
    >
      {id.replace(/^EV-/, "")}
    </Link>
  );
}

export function EvidenceLinks({ ids, projectId, max = 6 }: { ids: string[]; projectId: string; max?: number }) {
  if (ids.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-y-1">
      {ids.slice(0, max).map((id) => (
        <EvidenceLink key={id} id={id} projectId={projectId} />
      ))}
      {ids.length > max && <span className="ml-1 text-[10.5px] text-ink-soft">+{ids.length - max}</span>}
    </span>
  );
}

/** Render memo/copilot text whose citations are written as [EV-…, EV-…]. */
export function CitedText({ text, projectId }: { text: string; projectId: string }) {
  const parts = text.split(/(\[[^\]]*EV-[^\]]*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^\[.*EV-.*\]$/.test(part)) return <span key={i}>{part}</span>;
        const ids = part.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
        return <EvidenceLinks key={i} ids={ids} projectId={projectId} max={8} />;
      })}
    </>
  );
}

export function Panel({ title, eyebrow, actions, children, className = "" }: { title?: string; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 md:p-5 ${className}`}>
      {(title || eyebrow || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">{eyebrow}</div>}
            {title && <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight text-white">{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: ReactNode; tone?: "default" | "positive" | "negative" | "accent" }) {
  const toneCls = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : tone === "accent" ? "text-cyan-200" : "text-ink";
  return (
    <div className="stat-tile !p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className={`num mt-1 text-[19px] font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">{hint}</div>}
    </div>
  );
}

export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-[minmax(140px,max-content)_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="text-ink-muted">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const cls =
    tone === "warn"
      ? "border-amber-300/25 bg-amber-300/[0.06] text-amber-50/90"
      : tone === "danger"
        ? "border-rose-300/30 bg-rose-400/[0.07] text-rose-50/90"
        : "border-cyan-300/20 bg-cyan-300/[0.05] text-cyan-50/85";
  return <div className={`rounded-xl border px-3 py-2 text-[12px] leading-relaxed ${cls}`}>{children}</div>;
}

// ── Formatting ──────────────────────────────────────────────────────────────

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export const fmt = {
  pct: (v: number | null | undefined, d = 1) => (finite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%` : "—"),
  pctPlain: (v: number | null | undefined, d = 1) => (finite(v) ? `${(v * 100).toFixed(d)}%` : "—"),
  pp: (v: number | null | undefined, d = 1) => (finite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}pp` : "—"),
  x: (v: number | null | undefined, d = 1) => (finite(v) ? `${v.toFixed(d)}×` : "n/m"),
  usdM: (v: number | null | undefined) => (finite(v) ? `$${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M` : "—"),
  usdB: (v: number | null | undefined, d = 2) => (finite(v) ? `$${(v / 1e9).toFixed(d)}B` : "—"),
  usd: (v: number | null | undefined, d = 2) => (finite(v) ? `$${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}` : "—"),
  num: (v: number | null | undefined, d = 2) => (finite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—"),
};

export const toneOf = (v: number | null | undefined): "positive" | "negative" | "default" => (finite(v) ? (v >= 0 ? "positive" : "negative") : "default");
export const textTone = (v: number | null | undefined) => (finite(v) ? (v >= 0 ? "text-emerald-300" : "text-rose-300") : "text-ink-muted");
