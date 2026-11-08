import Link from "next/link";
import { OriginChip, pct, tone } from "@/components/events/EventUI";
import { Note, Panel, Stat } from "@/components/intel/ui";
import PageHeader from "@/components/layout/PageHeader";
import { caseOfEvent } from "@/data/events";
import { HORIZONS, INTERVAL_LEVEL, MODEL_VERSION } from "@/lib/events/forecast";
import { EVALUATED_SYMBOLS, evaluation, integrity, scoredForecasts } from "@/lib/events/view";

export const metadata = {
  title: "Forecast scorecard",
  description: "Every forecast the event engine has made, with its information cutoff, what happened, and how the baseline model has performed out of sample.",
};

const share = (num: number, den: number) => (den ? `${Math.round((num / den) * 100)}%` : "—");

export default function ForecastScorecardPage() {
  const all = scoredForecasts();
  const scored = all.filter((f) => f.score.status === "scored");
  const pending = all.filter((f) => f.score.status === "pending");
  const inside = scored.filter((f) => f.score.inInterval).length;
  const calls = all.filter((f) => f.record.prediction.direction !== "ABSTAIN");
  const chain = integrity().forecastChain;
  const symbols = EVALUATED_SYMBOLS();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Event intelligence"
        title="Forecast scorecard"
        subtitle="Every forecast is written to a hash-chained ledger before its outcome is known, with the data cutoff it used. Current predictions and historical outcomes are kept apart, and the baseline's out-of-sample record sits underneath both."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Forecasts on the ledger" value={String(all.length)} hint={`${all.filter((f) => f.record.origin === "live").length} live · ${all.filter((f) => f.record.origin === "backfill").length} backfill`} />
        <Stat label="Realized" value={String(scored.length)} hint={`${pending.length} still pending`} />
        <Stat label={`Inside the ${INTERVAL_LEVEL * 100}% range`} value={share(inside, scored.length)} hint={`${inside} of ${scored.length} realized`} />
        <Stat label="Directional calls" value={String(calls.length)} hint="The rest abstained: no skill shown" />
        <Stat label="Ledger integrity" value={chain.ok ? "Intact" : "Broken"} tone={chain.ok ? "positive" : "negative"} hint={chain.message} />
      </section>

      <Note>
        Model <span className="num">{MODEL_VERSION}</span>: a random walk with an honest range. The point forecast is zero; the 80% range comes from exponentially weighted volatility (λ = 0.94) scaled by √horizon; the base rate of up-moves is shrunk toward 50%. A direction is issued only where walk-forward testing found skill (hit rate above 50% at p &lt; 0.05 on effectively independent observations, Brier score better than a coin flip, both halves agreeing). The model only ever sees bars dated on or before its cutoff; tests confirm that adding future prices changes nothing. Costs of 5 bp (ETFs), 10 bp (stocks) and 20 bp (crypto) are charged on any directional call.
      </Note>

      <Panel title="Current predictions" eyebrow={`${pending.length} pending · not yet scorable`} source="Forecast ledger. Ranges are for the instrument's own return and for its return relative to the benchmark.">
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[960px] text-[12.5px]">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th className="px-5 py-2 text-left font-medium md:pl-6">Instrument</th>
                <th className="px-2 py-2 text-left font-medium">Horizon</th>
                <th className="px-2 py-2 text-left font-medium">Data to</th>
                <th className="px-2 py-2 text-left font-medium">Direction</th>
                <th className="px-2 py-2 text-right font-medium">80% range</th>
                <th className="px-2 py-2 text-right font-medium">vs benchmark</th>
                <th className="px-2 py-2 text-left font-medium">Realizes</th>
                <th className="px-2 py-2 text-left font-medium md:pr-6">Made</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(({ record: r, score }) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-1.5 md:pl-6"><span className="font-medium text-ink">{r.instrument}</span> <span className="text-[11.5px] text-ink-soft">vs {r.benchmark ?? "—"}</span></td>
                  <td className="num px-2 py-1.5 text-ink-muted">{r.horizon}</td>
                  <td className="num px-2 py-1.5 text-ink-muted">{r.dataAsOf}</td>
                  <td className="px-2 py-1.5 text-ink-muted" title={r.prediction.directionReason}>{r.prediction.direction === "ABSTAIN" ? "abstain" : r.prediction.direction.toLowerCase()}</td>
                  <td className="num px-2 py-1.5 text-right text-ink">{r.prediction.interval ? `${pct(r.prediction.interval[0])} to ${pct(r.prediction.interval[1])}` : "—"}</td>
                  <td className="num px-2 py-1.5 text-right text-ink-muted">{r.prediction.relInterval ? `${pct(r.prediction.relInterval[0])} to ${pct(r.prediction.relInterval[1])}` : "—"}</td>
                  <td className="px-2 py-1.5 text-ink-muted">{score.note}</td>
                  <td className="px-2 py-1.5 md:pr-6"><OriginChip origin={r.origin} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Historical outcomes" eyebrow={`${scored.length} realized`} source="Forecast ledger scored against Yahoo Finance daily closes; benchmark return over the same interval.">
        {scored.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No forecast has reached its horizon yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full min-w-[1000px] text-[12.5px]">
              <thead className="border-b border-line text-[11.5px] text-ink-soft">
                <tr>
                  <th className="px-5 py-2 text-left font-medium md:pl-6">Forecast</th>
                  <th className="px-2 py-2 text-left font-medium">Case</th>
                  <th className="px-2 py-2 text-right font-medium">80% range</th>
                  <th className="px-2 py-2 text-right font-medium">Realized</th>
                  <th className="px-2 py-2 text-right font-medium">Benchmark</th>
                  <th className="px-2 py-2 text-right font-medium">Excess</th>
                  <th className="px-2 py-2 text-left font-medium">In range</th>
                  <th className="px-2 py-2 text-left font-medium">Direction</th>
                  <th className="px-2 py-2 text-right font-medium">Brier</th>
                  <th className="px-2 py-2 text-left font-medium md:pr-6">Made</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ record: r, score: s }) => {
                  const c = r.eventId ? caseOfEvent(r.eventId) : null;
                  return (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-1.5 md:pl-6">
                        <span className="font-medium text-ink">{r.instrument}</span>
                        <span className="num ml-1.5 text-[11.5px] text-ink-soft">{r.horizon}-bar from {r.dataAsOf} → {s.targetDate}</span>
                      </td>
                      <td className="px-2 py-1.5 text-[12px]">{c ? <Link href={`/events/${c.slug}`} className="text-accent hover:underline">{c.slug}</Link> : "—"}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{r.prediction.interval ? `${pct(r.prediction.interval[0])} to ${pct(r.prediction.interval[1])}` : "—"}</td>
                      <td className={`num px-2 py-1.5 text-right font-medium ${tone(s.realized)}`}>{pct(s.realized)}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{pct(s.benchmarkReturn)}</td>
                      <td className={`num px-2 py-1.5 text-right ${tone(s.excess)}`}>{pct(s.excess)}</td>
                      <td className={`px-2 py-1.5 ${s.inInterval ? "text-ink" : "font-medium text-rose-800"}`}>{s.inInterval ? "yes" : "no"}</td>
                      <td className="px-2 py-1.5 text-ink-muted">{r.prediction.direction === "ABSTAIN" ? "abstained" : `${r.prediction.direction.toLowerCase()} · ${s.directionHit ? "hit" : "miss"} · net ${pct(s.netDirectionalReturn)}`}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{s.brier?.toFixed(3) ?? "—"}</td>
                      <td className="px-2 py-1.5 md:pr-6"><OriginChip origin={r.origin} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-muted">Backfilled forecasts were generated later from data available at their cutoff. They test the scoring machinery on real outcomes but are not evidence of foresight.</p>
      </Panel>

      <Panel title="Out-of-sample record of the baseline" eyebrow="Walk-forward, every 5 bars, no refitting on the test period" source="Snapshot price history (3 years). Regimes from the benchmark's 20-day volatility percentile within its trailing year.">
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[1100px] text-[12.5px]">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th className="px-5 py-2 text-left font-medium md:pl-6">Instrument</th>
                <th className="px-2 py-2 text-left font-medium">Horizon</th>
                <th className="px-2 py-2 text-right font-medium">Forecasts (effective)</th>
                <th className="px-2 py-2 text-right font-medium">80% coverage</th>
                <th className="px-2 py-2 text-right font-medium">Relative coverage</th>
                <th className="px-2 py-2 text-right font-medium">Coverage calm / normal / stressed</th>
                <th className="px-2 py-2 text-right font-medium">MAE zero vs drift</th>
                <th className="px-2 py-2 text-right font-medium">Hit rate vs up share</th>
                <th className="px-2 py-2 text-right font-medium">Brier skill</th>
                <th className="px-2 py-2 text-left font-medium md:pr-6">Direction</th>
              </tr>
            </thead>
            <tbody>
              {symbols.flatMap((sym) =>
                HORIZONS.map((h) => {
                  const e = evaluation(sym, h);
                  if (!e || e.n === 0) return null;
                  const covTone = e.coverage === null ? "" : Math.abs(e.coverage - INTERVAL_LEVEL) > 0.1 ? "font-medium text-amber-800" : "text-ink";
                  const reg = (k: "calm" | "normal" | "stressed") => (e.byRegime[k].coverage === null ? "—" : `${Math.round(e.byRegime[k].coverage! * 100)}`);
                  return (
                    <tr key={`${sym}-${h}`} className={`border-b border-line last:border-0 ${h === 1 ? "border-t border-t-ink/15" : ""}`}>
                      <td className="px-5 py-1.5 md:pl-6">{h === 1 ? <span className="font-medium text-ink">{sym}</span> : null}</td>
                      <td className="num px-2 py-1.5 text-ink-muted">{h}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{e.n} ({e.effectiveN})</td>
                      <td className={`num px-2 py-1.5 text-right ${covTone}`}>{e.coverage === null ? "—" : `${Math.round(e.coverage * 100)}%`}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{e.relCoverage === null ? "—" : `${Math.round(e.relCoverage * 100)}%`}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{reg("calm")} / {reg("normal")} / {reg("stressed")}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted" title="Mean absolute error of a zero-return forecast versus a trailing-mean drift forecast">
                        {e.maeZero === null ? "—" : `${(e.maeZero * 100).toFixed(1)} vs ${(e.maeDrift! * 100).toFixed(1)}`}
                        <span className="ml-1 text-ink-soft">{e.maeDrift !== null && e.maeZero !== null ? (e.maeDrift < e.maeZero ? "drift" : "zero") : ""}</span>
                      </td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{e.hitRate === null ? "—" : `${Math.round(e.hitRate * 100)}% vs ${Math.round(e.upShare! * 100)}%`}</td>
                      <td className={`num px-2 py-1.5 text-right ${tone(e.brierSkill)}`}>{e.brierSkill === null ? "—" : e.brierSkill.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-ink-muted md:pr-6" title={e.validationNote}>{e.directionValidated ? <span className="font-medium text-ink">validated</span> : "abstain"}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
          <p>
            Coverage far from 80% (amber) means the range is miscalibrated for that instrument and horizon. &ldquo;MAE zero vs drift&rdquo; compares the random walk with a trailing-mean forecast; a more complex model earns a place only by beating the simpler one here. A hit rate equal to the up share means the base rate adds nothing beyond &ldquo;it usually goes up&rdquo;.
          </p>
          <p>
            Long horizons overlap (a 60-bar forecast every 5 bars), so the effective number of independent observations is much smaller than the count. Three years of history covers few market regimes; a stressed-regime coverage figure rests on a handful of episodes.
          </p>
        </div>
      </Panel>
    </div>
  );
}
