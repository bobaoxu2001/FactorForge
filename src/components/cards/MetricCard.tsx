interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "accent";
}

const tones: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-ink",
  positive: "text-brand-green",
  negative: "text-rose-300",
  accent: "text-brand-blue",
};

export default function MetricCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="card group relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-soft">{label}</div>
      <div className={`num mt-2 text-[24px] font-semibold tracking-tight ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-[12px] text-ink-muted">{hint}</div>}
    </div>
  );
}
