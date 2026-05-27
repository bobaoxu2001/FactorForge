import type { WalkForwardSplit } from "@/lib/quant/walkForward";
import { num, pct } from "@/lib/utils/format";

interface Props {
  split: WalkForwardSplit | null;
}

const VERDICT_COLOR: Record<WalkForwardSplit["verdict"], string> = {
  robust: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  "mild degradation": "border-amber-300/35 bg-amber-400/10 text-amber-100",
  "severe degradation": "border-rose-300/35 bg-rose-400/10 text-rose-100",
  "insufficient sample": "border-line bg-white/[0.04] text-ink-muted",
};

export default function WalkForwardPanel({ split }: Props) {
  if (!split) {
    return (
      <div className="card p-5">
        <div className="panel-title">Walk-Forward Evaluation</div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          Equity curve is too short to produce a stable in-sample / out-of-sample split.
        </p>
      </div>
    );
  }

  const verdictClass = VERDICT_COLOR[split.verdict];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="panel-title">Walk-Forward Evaluation</div>
        <span className={`chip ${verdictClass}`}>{split.verdict}</span>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
        Calendar split at <span className="num text-ink">{split.splitDate}</span> ({(split.splitRatio * 100).toFixed(0)}% in-sample). Backtest is unchanged — the engine simply re-derives metrics for each window from the same equity curve. Numbers are not refit; this is an honesty check.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <WindowCard label="In-sample" window={split.inSample} accent="text-cyan-200" />
        <WindowCard label="Out-of-sample" window={split.outOfSample} accent="text-emerald-200" />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white/[0.035] p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Degradation (OOS minus In-sample)</div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-4">
          <Stat label="Sharpe Δ" value={signedNum(split.degradation.sharpe, 2)} positiveIsGood />
          <Stat label="Annualized Δ" value={signedPct(split.degradation.annualizedReturn)} positiveIsGood />
          <Stat label="Drawdown Δ" value={signedPct(split.degradation.maxDrawdown)} positiveIsGood />
          <Stat label="Win-rate Δ" value={signedPct(split.degradation.winRate)} positiveIsGood />
        </div>
      </div>
    </div>
  );
}

function WindowCard({ label, window, accent }: { label: string; window: WalkForwardSplit["inSample"]; accent: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.035] p-4">
      <div className="flex items-center justify-between">
        <div className={`text-[11px] uppercase tracking-[0.18em] ${accent}`}>{label}</div>
        <span className="text-[11px] text-ink-soft">{window.bars} bars</span>
      </div>
      <div className="mt-1 text-[12px] text-ink-soft">{window.startDate} → {window.endDate}</div>
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[12.5px]">
        <dt className="text-ink-soft">Annualized</dt>
        <dd className="num text-right text-ink">{pct(window.annualizedReturn)}</dd>
        <dt className="text-ink-soft">vs benchmark</dt>
        <dd className="num text-right text-ink">{pct(window.excessReturn)}</dd>
        <dt className="text-ink-soft">Sharpe</dt>
        <dd className="num text-right text-ink">{num(window.sharpe)}</dd>
        <dt className="text-ink-soft">Max drawdown</dt>
        <dd className="num text-right text-ink">{pct(window.maxDrawdown)}</dd>
        <dt className="text-ink-soft">Trades</dt>
        <dd className="num text-right text-ink">{window.tradeCount}</dd>
        <dt className="text-ink-soft">Win rate</dt>
        <dd className="num text-right text-ink">{pct(window.winRate)}</dd>
      </dl>
    </div>
  );
}

function Stat({ label, value, positiveIsGood }: { label: string; value: string; positiveIsGood?: boolean }) {
  const isPositive = value.startsWith("+");
  const isNegative = value.startsWith("-");
  const color = positiveIsGood
    ? isPositive
      ? "text-emerald-200"
      : isNegative
        ? "text-rose-200"
        : "text-ink"
    : "text-ink";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className={`num mt-1 text-[15px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function signedNum(value: number, digits: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${num(value, digits)}`;
}

function signedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${pct(value)}`;
}
