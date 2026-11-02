interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const normalized = status.toLowerCase();
  const cls =
    normalized.includes("candidate") || normalized.includes("active") || normalized.includes("holding") || normalized.includes("live")
      ? "border-accent/35 bg-accent/10 text-accent"
      : normalized.includes("reject") || normalized.includes("fallback") || normalized.includes("risk") || normalized.includes("paused")
        ? "border-rose-600/35 bg-rose-400/10 text-rose-800"
        : normalized.includes("ok") || normalized.includes("real") || normalized.includes("synced") || normalized.includes("adjusted") || normalized.includes("within limits") || normalized.includes("idle")
          ? "border-emerald-600/35 bg-emerald-500/12 text-emerald-700"
          : "border-amber-600/35 bg-amber-400/10 text-amber-800";
  return <span className={`chip ${cls}`}>{status}</span>;
}
