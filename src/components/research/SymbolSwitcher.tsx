import Link from "next/link";
import { num, pct } from "@/lib/utils/format";

export interface SymbolOption {
  symbol: string;
  score: number;
  annualizedReturn: number;
  sharpe: number;
  isBest: boolean;
}

/**
 * Symbol selector for the strategy detail page. Renders one chip per symbol the
 * strategy was backtested on, ranked by research score. The "best" symbol is the
 * default; selecting any other re-runs the page against that symbol via ?symbol=.
 *
 * This exists to make the "best symbol per strategy" assumption an explicit,
 * inspectable product feature rather than a hidden methodological choice.
 */
export default function SymbolSwitcher({
  strategyId,
  options,
  selected,
}: {
  strategyId: string;
  options: SymbolOption[];
  selected: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          Backtest universe · {options.length} symbols
        </div>
        <div className="text-[11px] text-ink-soft">ranked by research score</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.symbol === selected;
          const href = option.isBest
            ? `/strategies/${strategyId}`
            : `/strategies/${strategyId}?symbol=${option.symbol}`;
          return (
            <Link
              key={option.symbol}
              href={href}
              scroll={false}
              aria-current={isActive ? "true" : undefined}
              className={[
                "group flex min-w-[112px] flex-col rounded-xl border px-3 py-2 transition-colors",
                isActive
                  ? "border-blue-300/60 bg-blue-300/10"
                  : "border-line bg-white/[0.02] hover:border-blue-300/30 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{option.symbol}</span>
                {option.isBest && (
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-cyan-200">
                    best
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
                <span className="num">{pct(option.annualizedReturn)}</span>
                <span className="text-ink-soft">·</span>
                <span className="num">Sh {num(option.sharpe)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
