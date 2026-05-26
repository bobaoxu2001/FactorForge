interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const cls =
    status.includes("candidate") || status.includes("active") || status.includes("holding")
      ? "border-blue-400/35 bg-blue-500/12 text-blue-200"
      : status.includes("reject") || status.includes("fallback")
        ? "border-rose-400/35 bg-rose-500/12 text-rose-200"
        : status.includes("ok") || status.includes("real")
          ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
          : "border-amber-400/35 bg-amber-500/12 text-amber-200";
  return <span className={`chip ${cls}`}>{status}</span>;
}
