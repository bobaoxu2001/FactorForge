import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { DataCoverage, ProxyRef } from "@/lib/agents/types";
import { pct } from "@/lib/utils/format";

function MomentumGlyph({ m }: { m: number | null }) {
  if (m === null) return <Minus className="h-3 w-3 text-ink-soft" />;
  if (m > 0.001) return <ArrowUpRight className="h-3 w-3 text-emerald-300" />;
  if (m < -0.001) return <ArrowDownRight className="h-3 w-3 text-rose-300" />;
  return <Minus className="h-3 w-3 text-ink-soft" />;
}

/**
 * Public-market proxy basket. In-universe proxies show a live momentum read;
 * out-of-universe proxies are clearly labeled reference-only (no live data),
 * so the UI never implies a computed signal where there isn't one.
 */
export default function ProxyBasket({
  proxies,
  coverage,
  title = "Public-market proxy basket",
}: {
  proxies: ProxyRef[];
  coverage?: DataCoverage;
  title?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{title}</span>
        {coverage && (
          <span className="num text-[10.5px] text-ink-soft">
            {coverage.inUniverse}/{coverage.total} in research universe
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {proxies.map((p) => {
          const live = p.live;
          return live ? (
            <span
              key={p.symbol}
              title={`${p.name} · ${p.role} proxy · 20d ${pct(live.momentum20d ?? 0)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.045] px-2.5 py-1 text-[11px] font-medium text-ink"
            >
              <span className="num font-semibold text-white">{p.symbol}</span>
              <MomentumGlyph m={live.momentum20d} />
            </span>
          ) : (
            <span
              key={p.symbol}
              title={`${p.name} · ${p.role} proxy · reference only (outside research universe)`}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line/80 bg-transparent px-2.5 py-1 text-[11px] text-ink-soft"
            >
              <span className="num font-semibold text-ink-muted">{p.symbol}</span>
              <span className="text-[8.5px] uppercase tracking-[0.12em] text-ink-soft">ref</span>
            </span>
          );
        })}
      </div>
      {coverage && coverage.inUniverse < coverage.total && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
          Dashed “ref” chips are outside the research universe — shown for context only, with no live factor read.
        </p>
      )}
    </div>
  );
}
