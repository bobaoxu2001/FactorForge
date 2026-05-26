export default function MarketInsightCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-2 text-[17px] font-semibold text-ink">{value}</div>
      {detail && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>}
    </div>
  );
}
