export default function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="card grid min-h-[180px] place-items-center p-8 text-center">
      <div>
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{message}</p>
      </div>
    </div>
  );
}
