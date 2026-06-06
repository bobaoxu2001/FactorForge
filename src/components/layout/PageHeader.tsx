import type { ReactNode } from "react";

interface Props {
  /** Short eyebrow, e.g. "L1 Factors" or "Research". Rendered in the cyan lab-label style. */
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
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
            <span className="h-1 w-5 rounded-full bg-gradient-to-r from-cyan-300 to-blue-400 shadow-[0_0_14px_rgba(34,211,238,0.6)]" />
            {eyebrow}
          </div>
          <h1 className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] text-white md:text-[38px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0 lg:pb-1">{actions}</div>}
      </div>
      <div className="mt-5 h-px w-full bg-gradient-to-r from-cyan-300/30 via-line to-transparent" />
    </header>
  );
}
