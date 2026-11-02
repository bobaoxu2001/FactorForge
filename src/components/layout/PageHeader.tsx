import type { ReactNode } from "react";

interface Props {
  /** Short context line above the title, e.g. "L1 Factors" or "Research". */
  eyebrow: string;
  title: string;
  /** Supporting copy under the title. Accepts rich nodes (Term tooltips, links). */
  subtitle?: ReactNode;
  /** Optional right-aligned slot for a badge, toggle, or meta block. */
  actions?: ReactNode;
}

/**
 * Canonical page header for every L0–L6 console. Standardizes the eyebrow,
 * title scale, and supporting copy so the workbench reads as one premium
 * surface instead of a set of differently-styled dashboards.
 */
export default function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <header className="relative">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink-soft">{eyebrow}</div>
          <h1 className="mt-2 font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.015em] text-ink md:text-[40px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0 lg:pb-1">{actions}</div>}
      </div>
      <div className="mt-6 h-px w-full bg-line" />
    </header>
  );
}
