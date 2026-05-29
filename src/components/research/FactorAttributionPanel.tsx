import type { FactorAttribution } from "@/lib/quant/factorAttribution";
import { num, pct, pctPlain } from "@/lib/utils/format";

interface Props {
  attribution: FactorAttribution | null;
}

const FACTOR_DESCRIPTIONS: Record<"mkt" | "mom" | "vol", { label: string; tooltip: string }> = {
  mkt: { label: "Market", tooltip: "SPY daily return (or QQQ fallback)." },
  mom: { label: "Momentum", tooltip: "Top-50% minus bottom-50% of 60-day momentum within the watchlist." },
  vol: { label: "Low-vol", tooltip: "Bottom-50% minus top-50% of 60-day realized volatility." },
};

export default function FactorAttributionPanel({ attribution }: Props) {
  if (!attribution) {
    return (
      <div className="card p-5">
        <div className="panel-title">Factor Attribution (OLS)</div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          Not enough overlapping factor data to fit an attribution regression for this strategy.
        </p>
      </div>
    );
  }

  const alphaSigned = (attribution.alphaAnnualized > 0 ? "+" : "") + pct(attribution.alphaAnnualized);
  const sigT = (t: number) => (Math.abs(t) >= 2 ? "significant" : "not significant");

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="panel-title">Factor Attribution (OLS)</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            Strategy daily return regressed on [Market, Momentum, Low-vol]. Alpha is what&apos;s left after these known factors are accounted for — the part the simple factors cannot explain.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] px-4 py-3 text-right">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-cyan-100/70">Annualized alpha</div>
          <div className={`num mt-1 text-[22px] font-semibold ${attribution.alphaAnnualized > 0 ? "text-emerald-200" : "text-rose-200"}`}>{alphaSigned}</div>
          <div className="text-[11px] text-ink-soft">t = {num(attribution.tStats.alpha, 2)} ({sigT(attribution.tStats.alpha)})</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(["mkt", "mom", "vol"] as const).map((key) => (
          <FactorRow
            key={key}
            name={FACTOR_DESCRIPTIONS[key].label}
            tooltip={FACTOR_DESCRIPTIONS[key].tooltip}
            beta={attribution.betas[key]}
            t={attribution.tStats[key]}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-4">
        <Mini label="R²" value={num(attribution.rSquared, 3)} />
        <Mini label="Residual vol (ann.)" value={pctPlain(attribution.residualVolatility)} />
        <Mini label="Observations" value={String(attribution.observations)} />
        <Mini label="Sample" value={`${attribution.startDate} → ${attribution.endDate}`} />
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-soft">
        A high R² with small alpha means the factors explain most of the return — be skeptical of &ldquo;edge&rdquo;. Significant alpha (|t| ≥ 2) with low R² is more interesting evidence that something beyond Market/Momentum/Low-vol is driving the strategy.
      </p>
    </div>
  );
}

function FactorRow({ name, tooltip, beta, t }: { name: string; tooltip: string; beta: number; t: number }) {
  const significant = Math.abs(t) >= 2;
  return (
    <div className="rounded-2xl border border-line bg-white/[0.035] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-ink">{name}</div>
        <span className={`chip ${significant ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200" : "border-line bg-white/[0.04] text-ink-muted"}`}>
          {significant ? "t-significant" : "noise"}
        </span>
      </div>
      <div className="num mt-2 text-[20px] font-semibold text-ink">β = {num(beta, 2)}</div>
      <div className="text-[11px] text-ink-soft">t = {num(t, 2)}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-ink-muted">{tooltip}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-ink">{value}</div>
    </div>
  );
}
