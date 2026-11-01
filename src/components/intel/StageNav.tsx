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
    <nav aria-label="Research stages" className="sticky top-16 z-30 -mx-4 border-y border-line bg-[#030914]/90 px-4 backdrop-blur-xl md:-mx-6 md:px-6">
      <ol className="flex gap-1 overflow-x-auto py-2 text-[12px]">
        {stages.map((stage) => {
          const href = stage.slug ? `${base}/${stage.slug}` : base;
          const active = stage.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={stage.slug || "overview"} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                  active ? "border-cyan-300/45 bg-cyan-300/[0.09] text-white" : "border-transparent text-ink-muted hover:border-line hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className={`font-mono text-[10px] ${active ? "text-cyan-200" : "text-ink-soft"}`}>{stage.step}</span>
                <span className="font-medium">{stage.label}</span>
                {stage.status && <span className="hidden text-[10.5px] text-ink-soft xl:inline">· {stage.status}</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
