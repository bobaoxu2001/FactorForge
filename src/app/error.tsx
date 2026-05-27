"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card mx-auto max-w-2xl p-8">
      <div className="text-[11px] uppercase tracking-[0.16em] text-rose-200">Runtime error</div>
      <h1 className="mt-2 text-[24px] font-semibold text-ink">Research data could not be loaded</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        The market data source or local build cache may be temporarily unavailable. The platform will not disguise failed requests as real results.
      </p>
      <pre className="mt-4 max-h-40 overflow-auto rounded-xl border border-line bg-white/[0.035] p-3 text-[11px] text-ink-soft">
        {error.message}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl border border-blue-300/30 bg-blue-300/10 px-3 py-1.5 text-[13px] text-blue-100 hover:shadow-cardHover"
      >
        Retry
      </button>
    </div>
  );
}
