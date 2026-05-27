export default function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="card grid min-h-[180px] place-items-center border-dashed p-8 text-center">
      <div>
        <div className="mx-auto mb-4 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{message}</p>
      </div>
    </div>
  );
}
