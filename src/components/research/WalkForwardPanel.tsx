import type { RollingWalkForwardReport, WalkForwardSplit } from "@/lib/quant/walkForward";
import { num, pct, pctPlain, signedText } from "@/lib/utils/format";

interface Props {
  split: WalkForwardSplit | null;
  rolling?: RollingWalkForwardReport | null;
}

const VERDICT_COLOR: Record<WalkForwardSplit["verdict"], string> = {
  robust: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  "mild degradation": "border-amber-300/35 bg-amber-400/10 text-amber-100",
  "severe degradation": "border-rose-300/35 bg-rose-400/10 text-rose-100",
  "insufficient sample": "border-line bg-white/[0.04] text-ink-muted",
};

const ROLLING_VERDICT_COLOR: Record<RollingWalkForwardReport["verdict"], string> = {
  consistent: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  mixed: "border-amber-300/35 bg-amber-400/10 text-amber-100",
  fragile: "border-rose-300/35 bg-rose-400/10 text-rose-100",
  "insufficient sample": "border-line bg-white/[0.04] text-ink-muted",
};

export default function WalkForwardPanel({ split, rolling }: Props) {
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

      {rolling && <RollingSection rolling={rolling} />}
    </div>
  );
}

function RollingSection({ rolling }: { rolling: RollingWalkForwardReport }) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          Rolling windows (anchored, {rolling.windows.length} OOS segments)
        </div>
        <span className={`chip ${ROLLING_VERDICT_COLOR[rolling.verdict]}`}>{rolling.verdict}</span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
        After a {(rolling.burnInRatio * 100).toFixed(0)}% burn-in, the remaining curve is cut into sequential
        out-of-sample segments; each segment&apos;s in-sample is everything before it. One good split can be luck —
        consistency across windows is the harder test. Same equity curve, no refitting.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-4">
        <Stat label="OOS positive" value={pctPlain(rolling.oosPositiveShare, 0)} />
        <Stat label="Beat benchmark" value={pctPlain(rolling.oosBeatBenchmarkShare, 0)} />
        <Stat label="Avg OOS Sharpe" value={num(rolling.avgOosSharpe)} />
        <Stat label="Sharpe spread (σ)" value={num(rolling.oosSharpeStd)} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead className="border-y border-line text-[10px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-2 py-2 text-left">Window</th>
              <th className="px-2 py-2 text-left">OOS period</th>
              <th className="px-2 py-2 text-right">OOS return</th>
              <th className="px-2 py-2 text-right">vs bench</th>
              <th className="px-2 py-2 text-right">Sharpe</th>
              <th className="px-2 py-2 text-right">Max DD</th>
              <th className="px-2 py-2 text-left">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rolling.windows.map((window) => (
              <tr key={window.index}>
                <td className="num px-2 py-2">#{window.index}</td>
                <td className="px-2 py-2 text-ink-soft">
                  {window.outOfSample.startDate} → {window.outOfSample.endDate}
                </td>
                <td className={`num px-2 py-2 text-right ${signedText(window.outOfSample.totalReturn)}`}>
                  {pct(window.outOfSample.totalReturn)}
                </td>
                <td className={`num px-2 py-2 text-right ${signedText(window.outOfSample.excessReturn)}`}>
                  {pct(window.outOfSample.excessReturn)}
                </td>
                <td className="num px-2 py-2 text-right text-ink">{num(window.outOfSample.sharpe)}</td>
                <td className="num px-2 py-2 text-right text-ink">{pct(window.outOfSample.maxDrawdown)}</td>
                <td className="px-2 py-2">
                  <span className={`chip ${VERDICT_COLOR[window.verdict]}`}>{window.verdict}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <dd className="num text-right text-ink">{pctPlain(window.winRate)}</dd>
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
