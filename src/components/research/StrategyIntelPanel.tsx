import { ArrowUpRight, FlaskConical, Gauge } from "lucide-react";
import type { StrategyIntel, Tilt } from "@/lib/quant/strategyIntel";
import { pct, num } from "@/lib/utils/format";

const GATE_STYLE: Record<StrategyIntel["researchGate"]["kind"], string> = {
  observe: "border-emerald-600/35 bg-emerald-500/12 text-emerald-700",
  investigate: "border-accent/30 bg-accent/[0.08] text-accent",
  watchlist: "border-amber-600/35 bg-amber-400/10 text-amber-800",
};

const TILT_STYLE: Record<Tilt, string> = {
  high: "text-emerald-700",
  moderate: "text-accent",
  low: "text-ink-soft",
  negative: "text-rose-700",
};

const RISK_STYLE: Record<StrategyIntel["currentRiskState"]["tone"], string> = {
  stable: "border-emerald-600/35 bg-emerald-500/12 text-emerald-700",
  watch: "border-amber-600/35 bg-amber-400/10 text-amber-800",
  stress: "border-rose-600/35 bg-rose-400/10 text-rose-800",
};

function Meter({ label, score, suffix = "/100" }: { label: string; score: number; suffix?: string }) {
  const bar = score >= 65 ? "from-emerald-400 to-accent" : score >= 45 ? "from-accent to-accent" : "from-amber-400 to-amber-300";
  return (
    <div className="stat-tile !p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-semibold text-ink-soft">{label}</span>
        <span className="num text-[13px] font-semibold text-ink">{score}<span className="text-ink-soft">{suffix}</span></span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
        <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

/**
 * Model Intelligence — the research-grade synthesis for a single strategy.
 * Renders the deterministic {@link StrategyIntel} as scores, factor tilts,
 * decomposition, and a research-gate classification. Research-only.
 */
export default function StrategyIntelPanel({ intel }: { intel: StrategyIntel }) {
  const gate = intel.researchGate;
  const dec = intel.recentDecomposition;
  return (
    <section className="card relative overflow-hidden p-6 panel-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-accent/20 bg-accent/[0.07]">
            <Gauge className="h-5 w-5 text-accent" />
          </div>
          <div>
            <div className="section-label">Model Intelligence</div>
            <p className="mt-0.5 text-[12px] text-ink-soft">Deterministic synthesis from the backtest, stress diagnostics, and live regime.</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`chip ${GATE_STYLE[gate.kind]}`}>{gate.label}</span>
          <p className="mt-1.5 max-w-[260px] text-[11px] leading-relaxed text-ink-soft">{gate.reason}</p>
        </div>
      </div>

      {/* Score row */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Meter label="Base score" score={intel.baseScore} />
        <Meter label="Stress-adjusted" score={intel.stressAdjustedScore} />
        <Meter label="Regime fit" score={intel.regimeFit.score} />
        <Meter label="Confidence" score={intel.confidence.score} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: factor exposure + decomposition */}
        <div className="space-y-5">
          <div>
            <div className="section-label">Factor exposure</div>
            <p className="mt-1 text-[11px] text-ink-soft">Behavioral tilt from the strategy rules and realized statistics.</p>
            <div className="mt-3 space-y-2.5">
              {intel.factorExposure.map((f) => (
                <div key={f.factor} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12px] text-ink-muted">{f.factor}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent" style={{ width: `${Math.round(f.weight * 100)}%` }} />
                  </div>
                  <span className={`w-16 shrink-0 text-right text-[11px] font-medium tracking-wide ${TILT_STYLE[f.tilt]}`}>{f.tilt}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-label">Recent performance decomposition</div>
            <p className="mt-1 text-[11px] text-ink-soft">{dec.windowLabel} · strategy return split into market vs selection.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="stat-tile !p-3">
                <div className="text-[9.5px] font-semibold text-ink-soft">Strategy</div>
                <div className={`num mt-1 text-[15px] font-semibold ${dec.strategyReturn >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pct(dec.strategyReturn)}</div>
              </div>
              <div className="stat-tile !p-3">
                <div className="text-[9.5px] font-semibold text-ink-soft">Benchmark</div>
                <div className="num mt-1 text-[15px] font-semibold text-ink">{pct(dec.benchmarkReturn)}</div>
              </div>
              <div className="stat-tile !p-3">
                <div className="text-[9.5px] font-semibold text-ink-soft">Market component</div>
                <div className="num mt-1 text-[14px] font-semibold text-ink-muted">{pct(dec.marketComponent)}</div>
              </div>
              <div className="stat-tile !p-3">
                <div className="text-[9.5px] font-semibold text-ink-soft">Selection / timing</div>
                <div className={`num mt-1 text-[14px] font-semibold ${dec.selectionComponent >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pct(dec.selectionComponent)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: sensitivities, behavior, freshness */}
        <div className="space-y-3">
          <Row label="Regime sensitivity" value={intel.regimeSensitivity.level} note={intel.regimeSensitivity.note} />
          <Row label="Catalyst sensitivity" value={`${intel.catalystSensitivity.score}/100`} note={intel.catalystSensitivity.label} />
          <Row label="Downside-risk priority" value={`${intel.downsideRiskPriority.score}/100`} note={intel.downsideRiskPriority.label} />
          <Row
            label="Benchmark behavior"
            value={intel.benchmarkBehavior.upCapture !== null && intel.benchmarkBehavior.downCapture !== null
              ? `${num(intel.benchmarkBehavior.upCapture, 2)}↑ / ${num(intel.benchmarkBehavior.downCapture, 2)}↓`
              : "—"}
            note={intel.benchmarkBehavior.label}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-line bg-ink/[0.025] p-3">
              <div className="text-[9.5px] font-semibold text-ink-soft">Current risk</div>
              <span className={`chip mt-1.5 ${RISK_STYLE[intel.currentRiskState.tone]}`}>{intel.currentRiskState.label}</span>
            </div>
            <div className="rounded-md border border-line bg-ink/[0.025] p-3">
              <div className="text-[9.5px] font-semibold text-ink-soft">Model freshness</div>
              <div className="mt-1.5 text-[12.5px] font-medium text-ink">{intel.modelFreshness.label}</div>
              <div className="num text-[10.5px] text-ink-soft">as of {intel.modelFreshness.asOf}</div>
            </div>
          </div>
          <div className="rounded-md border border-line bg-ink/[0.025] p-3">
            <div className="text-[9.5px] font-semibold text-ink-soft">Data quality</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink">{intel.dataQuality.label}</span>
              <span className="num text-[12px] text-ink-muted">{intel.dataQuality.score}/100</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2.5 border-t border-line pt-4">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-accent/80" />
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Suggested next research test. </span>
          {intel.suggestedResearchTest}
        </p>
      </div>
    </section>
  );
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-line bg-ink/[0.025] p-3">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{note}</div>
      </div>
      <div className="num shrink-0 text-[13px] font-semibold capitalize text-accent">{value}</div>
    </div>
  );
}
