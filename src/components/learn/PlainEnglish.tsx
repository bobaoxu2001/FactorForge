import { Sparkles } from "lucide-react";

/**
 * "In plain English" callout. A friendly, low-visual-weight banner that tells a
 * non-expert what a page (or panel) is actually for, in one or two sentences —
 * without altering the dense, expert-facing content beneath it.
 *
 * Server component (no interactivity): it renders the same for everyone, so
 * experts simply skim past the cyan strip while newcomers get their bearings.
 * Children may include <Term> tooltips for any jargon that survives.
 */
export default function PlainEnglish({
  children,
  title = "In plain English",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <aside className="flex items-start gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10">
        <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{children}</p>
      </div>
    </aside>
  );
}
