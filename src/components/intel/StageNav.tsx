"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Stage {
  slug: string;
  label: string;
  step: string;
  /** Short status computed on the server, e.g. "12/14 verified". */
  status?: string;
}

/**
 * Sticky stage navigator for a research project. Keeps the analyst in the
 * same project context while moving between workflow stages.
 */
export default function StageNav({ projectId, stages }: { projectId: string; stages: Stage[] }) {
  const pathname = usePathname();
  const base = `/research/${projectId}`;
  return (
    <nav aria-label="Research stages" className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/95 px-4 backdrop-blur md:-mx-8 md:px-8">
      <ol className="flex gap-5 overflow-x-auto text-[13.5px]">
        {stages.map((stage) => {
          const href = stage.slug ? `${base}/${stage.slug}` : base;
          const active = stage.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={stage.slug || "overview"} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={stage.status}
                className={`-mb-px flex items-center gap-1.5 border-b-2 py-3 transition-colors ${
                  active ? "border-accent font-semibold text-ink" : "border-transparent text-ink-muted hover:border-ink/20 hover:text-ink"
                }`}
              >
                <span className={`num text-[12px] ${active ? "text-accent" : "text-ink-soft"}`}>{stage.step}</span>
                <span>{stage.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
