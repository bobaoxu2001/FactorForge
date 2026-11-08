"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
export default function StageNav({ projectId, stages, basePath, label = "Research stages" }: { projectId: string; stages: Stage[]; basePath?: string; label?: string }) {
  const pathname = usePathname();
  const base = basePath ?? `/research/${projectId}`;
  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    const listBounds = list.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    if (activeBounds.left < listBounds.left || activeBounds.right > listBounds.right) {
      list.scrollLeft += activeBounds.left - listBounds.left - (list.clientWidth - activeBounds.width) / 2;
    }
  }, [pathname]);
  return (
    <nav aria-label={label} className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/95 px-4 backdrop-blur md:-mx-8 md:px-8">
      <ol ref={listRef} className="flex gap-5 overflow-x-auto text-[13.5px]">
        {stages.map((stage) => {
          const href = stage.slug ? `${base}/${stage.slug}` : base;
          const active = stage.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={stage.slug || "overview"} className="shrink-0">
              <Link
                href={href}
                ref={active ? activeRef : undefined}
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
