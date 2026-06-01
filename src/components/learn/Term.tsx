"use client";

import { useId, useRef, useState } from "react";
import { lookupTerm } from "@/data/glossary";

/**
 * Inline jargon helper. Wrap any quant term and beginners get a plain-English
 * explanation on hover/focus/tap; experts simply ignore the dotted underline.
 *
 *   <Term term="sharpe" /># renders "Sharpe ratio" with a tooltip
 *   <Term term="sharpe">risk-adjusted return</Term> # custom visible label
 *
 * Accessible: the trigger is a real <button>, the panel is linked via
 * aria-describedby, and it opens on focus (keyboard) as well as hover/click.
 */
export default function Term({
  term,
  children,
}: {
  term: string;
  children?: React.ReactNode;
}) {
  const entry = lookupTerm(term);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  // Unknown term → render plain text, never a broken tooltip.
  if (!entry) return <>{children ?? term}</>;

  const label = children ?? entry.term;

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Small delay so moving the cursor from trigger into the panel doesn't flicker.
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <span className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-describedby={open ? panelId : undefined}
        aria-expanded={open}
        // Tap/click and keyboard-focus both OPEN; closing is handled by moving
        // away (mouseleave / blur). Toggling here would fight the focus-open that
        // a click also triggers, leaving the panel closed.
        onClick={show}
        onFocus={show}
        onBlur={hide}
        className="cursor-help border-b border-dotted border-cyan-300/50 text-inherit decoration-dotted underline-offset-2 transition-colors hover:border-cyan-300 focus:outline-none focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-cyan-300/60"
      >
        {label}
      </button>

      {open && (
        <span
          id={panelId}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute bottom-full left-1/2 z-50 mb-2 w-[min(20rem,80vw)] -translate-x-1/2 rounded-xl border border-cyan-300/25 bg-[#070c16] p-3 text-left shadow-[0_18px_50px_-20px_rgba(34,211,238,0.45)]"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-white">{entry.term}</span>
            <span className="chip border-cyan-300/30 bg-cyan-300/10 text-[9.5px] text-cyan-100">
              {entry.level === "starter" ? "basics" : "intermediate"}
            </span>
          </span>
          <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-muted">{entry.plain}</span>
          {entry.why && (
            <span className="mt-1.5 block text-[12px] leading-relaxed text-cyan-100/80">
              <span className="font-medium text-cyan-200">Why it matters: </span>
              {entry.why}
            </span>
          )}
          {entry.example && (
            <span className="mt-1.5 block text-[11.5px] leading-relaxed text-ink-soft">
              <span className="font-medium">e.g. </span>
              {entry.example}
            </span>
          )}
          <a
            href={`/learn#${entry.id}`}
            className="mt-2 inline-block text-[11px] text-blue-300 hover:text-blue-200"
          >
            More in Stocks 101 →
          </a>
        </span>
      )}
    </span>
  );
}
