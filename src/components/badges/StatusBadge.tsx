interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const normalized = status.toLowerCase();
  const cls =
    normalized.includes("candidate") || normalized.includes("active") || normalized.includes("holding") || normalized.includes("live")
      ? "border-blue-300/35 bg-blue-400/10 text-blue-100 shadow-[0_0_22px_rgba(96,165,250,0.08)]"
      : normalized.includes("reject") || normalized.includes("fallback") || normalized.includes("risk") || normalized.includes("paused")
        ? "border-rose-300/35 bg-rose-400/10 text-rose-100"
        : normalized.includes("ok") || normalized.includes("real") || normalized.includes("synced") || normalized.includes("adjusted") || normalized.includes("within limits") || normalized.includes("idle")
          ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
          : "border-amber-300/35 bg-amber-400/10 text-amber-100";
  return <span className={`chip ${cls}`}>{status}</span>;
}
