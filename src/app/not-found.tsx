import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-2xl p-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md border border-accent/25 bg-accent/10">
          <Compass className="h-5 w-5 text-accent" />
        </div>
        <div className="text-[11px] text-accent/75">Error 404</div>
      </div>
      <h1 className="mt-4 text-[24px] font-semibold text-ink">This research page does not exist</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        The strategy, symbol, or route you followed isn&apos;t part of the platform. It may have been renamed, or the
        link may be stale.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-[13px] text-accent hover:shadow-cardHover"
        >
          Back to overview
        </Link>
        <Link
          href="/strategies"
          className="rounded-md border border-line bg-ink/[0.04] px-3 py-1.5 text-[13px] text-ink-muted hover:text-ink"
        >
          Browse strategies
        </Link>
      </div>
    </div>
  );
}
