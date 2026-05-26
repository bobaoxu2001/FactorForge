import Link from "next/link";

interface Props {
  layer: string;
  label: string;
  title: string;
  description: string;
  href: string;
  status: string;
}

const accentByLayer: Record<string, string> = {
  L0: "text-blue-300 border-blue-400/35 bg-blue-500/10",
  L1: "text-emerald-300 border-emerald-400/35 bg-emerald-500/10",
  L2: "text-sky-300 border-sky-400/35 bg-sky-500/10",
  L3: "text-purple-300 border-purple-400/35 bg-purple-500/10",
  L4: "text-amber-300 border-amber-400/35 bg-amber-500/10",
  L5: "text-blue-300 border-blue-400/35 bg-blue-500/10",
  L6: "text-slate-300 border-slate-400/35 bg-slate-500/10",
};

export default function ModuleCard({ layer, label, title, description, href, status }: Props) {
  return (
    <Link href={href} className="card card-hover relative flex min-h-[150px] flex-col overflow-hidden p-4">
      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
        <span className={`chip ${accentByLayer[layer] ?? accentByLayer.L0}`}>{layer}</span>
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>
      <div className="mt-auto border-t border-line pt-3 text-[12px] text-ink-soft">{status}</div>
    </Link>
  );
}
