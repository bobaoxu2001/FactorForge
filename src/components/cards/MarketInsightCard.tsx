export default function MarketInsightCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] text-ink-soft">{label}</div>
      <div className="num mt-2 text-[19px] font-semibold text-ink">{value}</div>
      {detail && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>}
    </div>
  );
}
