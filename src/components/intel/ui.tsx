import Link from "next/link";
import type { ReactNode } from "react";
import type { EvidenceOrigin, Freshness, RelationshipStatus, TestOutcome, TriggerState, VerificationStatus } from "@/lib/intel/types";

/**
 * Shared research UI primitives. One visual vocabulary for provenance across
 * every research page: the same colour always means the same status.
 */

const STATUS_STYLE: Record<VerificationStatus, string> = {
  verified: "border-emerald-600/35 bg-emerald-500/10 text-emerald-700",
  "partially-verified": "border-accent/35 bg-accent/10 text-accent",
  unverified: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  contradicted: "border-rose-600/40 bg-rose-400/10 text-rose-800",
  stale: "border-ink/25 bg-slate-400/10 text-ink-soft",
};

export function StatusChip({ status }: { status: VerificationStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{status.replace("-", " ")}</span>;
}

const ORIGIN_STYLE: Record<EvidenceOrigin, { label: string; cls: string }> = {
  "public-secondary": { label: "public source", cls: "border-accent/35 bg-accent/10 text-accent" },
  "user-primary": { label: "your primary research", cls: "border-violet-600/40 bg-violet-400/10 text-violet-800" },
  "ai-generated": { label: "AI-generated · not evidence", cls: "border-dashed border-amber-600/45 bg-transparent text-amber-800" },
  "template-generated": { label: "Template-generated · not evidence", cls: "border-dashed border-accent/40 bg-transparent text-accent" },
  hypothesis: { label: "hypothesis", cls: "border-dashed border-ink/25 bg-transparent text-ink-soft" },
};

export function OriginChip({ origin }: { origin: EvidenceOrigin }) {
  const o = ORIGIN_STYLE[origin];
  return <span className={`chip ${o.cls}`}>{o.label}</span>;
}

const OUTCOME_STYLE: Record<TestOutcome, string> = {
  supports: "border-emerald-600/35 bg-emerald-500/10 text-emerald-700",
  contradicts: "border-rose-600/40 bg-rose-400/10 text-rose-800",
  mixed: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  "insufficient-data": "border-ink/25 bg-slate-400/10 text-ink-soft",
};

export function OutcomeBadge({ outcome }: { outcome: TestOutcome }) {
  return <span className={`chip ${OUTCOME_STYLE[outcome]}`}>{outcome === "insufficient-data" ? "insufficient data" : outcome}</span>;
}

const TRIGGER_STYLE: Record<TriggerState, string> = {
  holding: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700",
  triggered: "border-rose-600/45 bg-rose-400/15 text-rose-800",
  "insufficient-data": "border-ink/25 bg-slate-400/10 text-ink-soft",
};

export function TriggerBadge({ state }: { state: TriggerState }) {
  return <span className={`chip ${TRIGGER_STYLE[state]}`}>{state === "holding" ? "not triggered" : state === "triggered" ? "triggered" : "insufficient data"}</span>;
}

const REL_STYLE: Record<RelationshipStatus, string> = {
  verified: "border-emerald-600/35 bg-emerald-500/10 text-emerald-700",
  inferred: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  hypothetical: "border-dashed border-ink/25 bg-transparent text-ink-soft",
};

export function RelationshipChip({ status }: { status: RelationshipStatus }) {
  return <span className={`chip ${REL_STYLE[status]}`}>{status}</span>;
}

const FRESH_STYLE: Record<Freshness, string> = {
  fresh: "text-emerald-700",
  lagging: "text-amber-700",
  stale: "text-rose-700",
};

export function FreshnessDot({ freshness, note }: { freshness: Freshness; note?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${FRESH_STYLE[freshness]}`} title={note}>
      <span className={`h-1.5 w-1.5 rounded-full ${freshness === "fresh" ? "bg-emerald-600" : freshness === "lagging" ? "bg-amber-600" : "bg-rose-600"}`} />
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
      className="num mx-0.5 inline-flex items-center rounded border border-accent/20 bg-accent-soft px-1 py-px text-[11px] font-medium text-accent transition-colors hover:border-accent/50"
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

/**
 * A section of a research page. Passing `source` makes it an exhibit, as in a
 * printed note: the title gets a running "Exhibit n" number (a CSS counter, so
 * numbering follows page order) and the source line is printed underneath.
 */
export function Panel({
  title,
  eyebrow,
  actions,
  source,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  source?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card min-w-0 p-5 md:p-6 ${className}`}>
      {(title || eyebrow || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="text-[12.5px] font-medium text-ink-soft">{eyebrow}</div>}
            {title && (
              <h2 className={`mt-0.5 text-[19px] font-semibold leading-snug text-ink ${source ? "exhibit-title" : ""}`}>{title}</h2>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
      {source && <p className="mt-4 border-t border-line pt-2.5 text-[12px] leading-relaxed text-ink-soft">Source: {source}</p>}
    </section>
  );
}

/** A key finding set as a serif sentence; wrap the decisive phrase in <Highlight>. */
export function KeyFinding({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`max-w-[46ch] font-serif text-[22px] leading-[1.4] text-ink md:text-[25px] ${className}`}>{children}</p>;
}

export function Highlight({ children }: { children: ReactNode }) {
  return <mark className="highlight bg-transparent text-inherit">{children}</mark>;
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: ReactNode; tone?: "default" | "positive" | "negative" | "accent" }) {
  const toneCls = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : tone === "accent" ? "text-accent" : "text-ink";
  return (
    <div className="border-l-2 border-line py-0.5 pl-3">
      <div className="text-[12.5px] text-ink-soft">{label}</div>
      <div className={`num mt-1 text-[22px] font-semibold leading-tight tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{hint}</div>}
    </div>
  );
}

export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13.5px] sm:grid-cols-[minmax(140px,max-content)_1fr]">
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
      ? "border-amber-600 bg-amber-50 text-amber-900"
      : tone === "danger"
        ? "border-rose-700 bg-rose-50 text-rose-900"
        : "border-accent bg-accent-soft text-ink-muted";
  return <div className={`border-l-2 px-3 py-2 text-[13px] leading-relaxed ${cls}`}>{children}</div>;
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
export const textTone = (v: number | null | undefined) => (finite(v) ? (v >= 0 ? "text-emerald-700" : "text-rose-700") : "text-ink-muted");
