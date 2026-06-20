import Link from "next/link";
import { Compass } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  message: string;
  /** Optional leading icon. Falls back to a friendly compass glyph. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional one-line tip shown under the message — e.g. why a panel is empty by design. */
  hint?: ReactNode;
  /** Optional primary call-to-action so empty panels still point somewhere useful. */
  action?: { href: string; label: string };
}

/**
 * Shared empty-state surface used across every research console. Keeping the
 * structure and copy tone consistent here means an empty Radar, Paper, or
 * Strategy panel reads as one welcoming product rather than a broken page.
 */
export default function EmptyState({ title, message, icon: Icon = Compass, hint, action }: Props) {
  return (
    <div className="card grid min-h-[180px] place-items-center border-dashed p-8 text-center">
      <div className="max-w-xl">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.08] shadow-[0_0_22px_-6px_rgba(34,211,238,0.7)]">
          <Icon className="h-5 w-5 text-cyan-200" />
        </div>
        <div className="mt-4 text-[15px] font-semibold text-ink">{title}</div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{message}</p>
        {hint && (
          <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">{hint}</p>
        )}
        {action && (
          <Link
            href={action.href}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-4 py-2 text-[12.5px] font-medium text-cyan-100 transition-colors hover:border-cyan-300/55 hover:bg-cyan-300/[0.14]"
          >
            {action.label}
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
