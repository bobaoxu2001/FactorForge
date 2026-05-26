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
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className={`num mt-2 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-[12px] text-ink-muted">{hint}</div>}
    </div>
  );
}
