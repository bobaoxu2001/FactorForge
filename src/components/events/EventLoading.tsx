/** Loading state for the event-intelligence pages. Their data is precomputed from committed files, so the wait is only page transfer. */
export default function EventLoading({ label, detail, compact = false }: { label: string; detail: string; compact?: boolean }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="section-label">{label}</div>
      <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">{detail}</p>
      {!compact && <div className="h-8 w-72 max-w-full animate-pulse rounded-md bg-ink/[0.08]" />}
      <div className="card h-40 animate-pulse bg-ink/[0.035]" />
      <div className="card h-24 animate-pulse bg-ink/[0.035]" />
    </div>
  );
}
