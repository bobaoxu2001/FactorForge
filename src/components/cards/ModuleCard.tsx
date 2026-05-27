import Link from "next/link";

interface Props {
  layer: string;
  label: string;
  title: string;
  description: string;
  href: string;
  status: string;
  metric?: string;
  icon?: React.ComponentType<{ className?: string }>;
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

export default function ModuleCard({ layer, label, title, description, href, status, metric, icon: Icon }: Props) {
  return (
    <Link href={href} className="card card-hover group relative flex min-h-[184px] flex-col overflow-hidden p-4">
      <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-400/10 blur-2xl transition-opacity group-hover:opacity-80" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
              <Icon className="h-4 w-4 text-blue-200" />
            </div>
          )}
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-soft">{label}</div>
        </div>
        <span className={`chip ${accentByLayer[layer] ?? accentByLayer.L0}`}>{layer}</span>
      </div>
      <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <span className="text-[12px] text-ink-soft">{status}</span>
        {metric && <span className="num text-[13px] font-semibold text-cyan-100">{metric}</span>}
      </div>
    </Link>
  );
}
