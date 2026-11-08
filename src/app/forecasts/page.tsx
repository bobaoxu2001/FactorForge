import Link from "next/link";
import { OriginChip, pct, tone } from "@/components/events/EventUI";
import { Note, Panel, Stat } from "@/components/intel/ui";
import PageHeader from "@/components/layout/PageHeader";
import { caseOfEvent } from "@/data/events";
import { REGIMES, type CoverageStat } from "@/lib/events/evaluation";
import { HORIZONS, INTERVAL_LEVEL, MODEL_HISTORY, MODEL_VERSION, SCORING_HISTORY, SCORING_VERSION } from "@/lib/events/forecast";
import { EVALUATED_SYMBOLS, evaluation, evaluationFamily, integrity, pooled, scoredForecasts, type ScoredForecast } from "@/lib/events/view";

export const metadata = {
  title: "Forecast scorecard",
  description: "Live forecasts recorded before their outcome, backfilled worked examples shown apart, and how the baseline model has performed out of sample: interval calibration by regime and directional skill against constant rules.",
};

const share = (num: number, den: number) => (den ? `${Math.round((num / den) * 100)}%` : "—");
const pct0 = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const ci = (c: CoverageStat) => (c.ci ? `${Math.round(c.ci[0] * 100)}–${Math.round(c.ci[1] * 100)}%` : "—");
const VERDICT: Record<CoverageStat["verdict"], { label: string; cls: string }> = {
  consistent: { label: "consistent with 80%", cls: "text-ink-muted" },
  "too-narrow": { label: "too narrow", cls: "font-medium text-rose-800" },
  "too-wide": { label: "too wide", cls: "font-medium text-amber-800" },
  "too-few": { label: "too few to judge", cls: "text-ink-soft" },
};

/** Horizontal interval: where the empirical coverage sits against the 80% target, on a 50–100% scale. */
function CoverageBar({ stat }: { stat: CoverageStat }) {
  if (stat.coverage === null || !stat.ci) return <span className="text-ink-soft">—</span>;
  const x = (v: number) => `${Math.min(100, Math.max(0, ((v - 0.5) / 0.5) * 100))}%`;
  const color = stat.verdict === "too-narrow" ? "bg-rose-700" : stat.verdict === "too-wide" ? "bg-amber-700" : "bg-ink";
  return (
    <span className="relative block h-4 w-full min-w-[140px]" role="img" aria-label={`Empirical coverage ${pct0(stat.coverage)}, 95% interval ${ci(stat)}, target 80%`}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <span className="absolute top-0 h-4 w-px bg-accent" style={{ left: x(INTERVAL_LEVEL) }} />
      <span className={`absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full opacity-40 ${color}`} style={{ left: x(stat.ci[0]), width: `calc(${x(stat.ci[1])} - ${x(stat.ci[0])})` }} />
      <span className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color}`} style={{ left: x(stat.coverage) }} />
    </span>
  );
}

function OutcomeTable({ rows, caption }: { rows: ScoredForecast[]; caption: string }) {
  return (
    <div className="-mx-5 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[1000px] text-[12.5px]" aria-label={caption}>
        <thead className="border-b border-line text-[11.5px] text-ink-soft">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-panel px-5 py-2 text-left font-medium md:pl-6">Forecast</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Case</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">80% range</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Realized</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Benchmark</th>
            <th scope="col" className="px-2 py-2 text-right font-medium" title="Relative wealth return: (1 + return) / (1 + benchmark return) − 1. Not the arithmetic difference.">Relative</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">In range</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Direction</th>
            <th scope="col" className="px-2 py-2 text-left font-medium md:pr-6">Model</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ record: r, score: s, ruleCheck }) => {
            const c = r.eventId ? caseOfEvent(r.eventId) : null;
            return (
              <tr key={r.id} className="border-b border-line align-top last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-panel px-5 py-1.5 text-left font-normal md:pl-6">
                  <span className="font-medium text-ink">{r.instrument}</span>
                  <span className="num ml-1.5 text-[11.5px] text-ink-soft">{r.horizon}-bar from {r.dataAsOf} → {s.targetDate}</span>
                </th>
                <td className="px-2 py-1.5 text-[12px]">{c ? <Link href={`/events/${c.slug}`} className="text-accent hover:underline">{c.slug}</Link> : "—"}</td>
                <td className="num px-2 py-1.5 text-right text-ink-muted">{r.prediction.interval ? `${pct(r.prediction.interval[0])} to ${pct(r.prediction.interval[1])}` : "—"}</td>
                <td className={`num px-2 py-1.5 text-right font-medium ${tone(s.realized)}`}>{pct(s.realized)}</td>
                <td className="num px-2 py-1.5 text-right text-ink-muted">{pct(s.benchmarkReturn)}</td>
                <td
                  className={`num px-2 py-1.5 text-right ${tone(s.relative)}`}
                  title={`Relative wealth return ${pct(s.relative)}; arithmetic excess ${pct(s.excess)}${r.prediction.relInterval ? `; relative range ${pct(r.prediction.relInterval[0])} to ${pct(r.prediction.relInterval[1])}` : ""}`}
                >
                  {pct(s.relative)}
                  {s.inRelInterval !== null && <div className={`text-[11px] ${s.inRelInterval ? "text-ink-soft" : "font-medium text-rose-800"}`}>{s.inRelInterval ? "in rel. range" : "outside rel. range"}</div>}
                </td>
                <td className={`px-2 py-1.5 ${s.inInterval ? "text-ink" : "font-medium text-rose-800"}`}>{s.inInterval ? "yes" : "no"}</td>
                <td className="max-w-[300px] px-2 py-1.5 text-ink-muted">
                  {r.prediction.direction === "ABSTAIN" ? "abstained" : `${r.prediction.direction.toLowerCase()} · ${s.directionHit ? "hit" : "miss"} · net ${pct(s.netDirectionalReturn)}`}
                  {ruleCheck && <div className="mt-0.5 text-[11.5px] leading-snug text-amber-800">{ruleCheck.currentRuleWouldCall ? `${ruleCheck.currentVersion} would also call it.` : `${ruleCheck.currentVersion} would have abstained.`}</div>}
                </td>
                <td className="px-2 py-1.5 md:pr-6">
                  <OriginChip origin={r.origin} />
                  <div className="num mt-0.5 text-[11px] text-ink-soft">{r.modelVersion}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ForecastScorecardPage() {
  const all = scoredForecasts();
  const scored = all.filter((f) => f.score.status === "scored");
  const pending = all.filter((f) => f.score.status === "pending");
  const liveScored = scored.filter((f) => f.record.origin === "live");
  const backfillScored = scored.filter((f) => f.record.origin === "backfill");
  const backfillInside = backfillScored.filter((f) => f.score.inInterval).length;
  const liveInside = liveScored.filter((f) => f.score.inInterval).length;
  const firstLive = pending.filter((f) => f.record.origin === "live").sort((a, b) => (a.score.barsRemaining ?? 0) - (b.score.barsRemaining ?? 0))[0];
  const calls = all.filter((f) => f.record.prediction.direction !== "ABSTAIN");
  const overturned = calls.filter((f) => f.ruleCheck && !f.ruleCheck.currentRuleWouldCall);
  const chain = integrity().forecastChain;
  const symbols = EVALUATED_SYMBOLS();
  const family = [...evaluationFamily().values()];
  const validated = family.filter((s) => s.directionValidated).length;
  const pools = pooled();
  const mstr = overturned[0];
  const relScored = scored.filter((f) => f.score.inRelInterval !== null);
  const relChanged = relScored.filter((f) => f.score.inRelInterval !== f.score.inRelIntervalV1);
  const avgRegime = (g: (typeof REGIMES)[number]) => {
    const xs = pools.map((p) => p.byRegime[g].coverage).filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const calmCov = avgRegime("calm");
  const stressedCov = avgRegime("stressed");
  const regimeGap = calmCov !== null && stressedCov !== null ? stressedCov - calmCov : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Event intelligence"
        title="Forecast scorecard"
        subtitle="Only live forecasts are recorded before their outcome is known: each is written to a hash-chained ledger with the data cutoff it used. Backfilled worked examples were reconstructed afterwards from data available at each cutoff; they are shown separately and are not a forward-looking record. The baseline's out-of-sample record sits underneath both."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Forecasts on the ledger" value={String(all.length)} hint={`${all.filter((f) => f.record.origin === "live").length} live · ${all.filter((f) => f.record.origin === "backfill").length} backfill`} />
        <Stat
          label="Live forecasts realized"
          value={String(liveScored.length)}
          hint={liveScored.length ? `${liveInside} inside the 80% range` : firstLive ? `First realizes in ${firstLive.score.barsRemaining} bar${firstLive.score.barsRemaining === 1 ? "" : "s"} (${firstLive.record.instrument})` : "None pending"}
        />
        <Stat label="Worked examples inside range" value={share(backfillInside, backfillScored.length)} hint={`${backfillInside} of ${backfillScored.length} backfilled; not a track record`} />
        <Stat label="Directional calls" value={String(calls.length)} hint={overturned.length ? `${overturned.length} would abstain under ${MODEL_VERSION}` : "The rest abstained: no skill shown"} />
        <Stat label="Ledger integrity" value={chain.ok ? "Intact" : "Broken"} tone={chain.ok ? "positive" : "negative"} hint={chain.message} />
      </section>

      <Note>
        Model <span className="num">{MODEL_VERSION}</span>: a random walk with an honest range. The point forecast is zero; the 80% range comes from exponentially weighted volatility (λ = 0.94) scaled by √horizon; the base rate of up-moves is shrunk toward 50%. {MODEL_HISTORY[MODEL_VERSION]} The model only ever sees bars dated on or before its cutoff; tests confirm that adding future prices changes nothing. Costs of 5 bp (ETFs), 10 bp (stocks) and 20 bp (crypto) are charged on any directional call.
      </Note>

      <Note>
        Scoring <span className="num">{SCORING_VERSION}</span>: {SCORING_HISTORY[SCORING_VERSION]} The previous rule, score-v1, compared the relative range with arithmetic excess, a different quantity.{" "}
        {relScored.length > 0 && `Of ${relScored.length} realized relative ranges, ${relChanged.length} ${relChanged.length === 1 ? "lands" : "land"} differently under the two rules.`} Stored forecasts are unchanged; scores are recomputed from the ledger and prices.
      </Note>

      {mstr && (
        <Note tone="warn">
          <strong className="font-semibold">A v1 call the current rule would not make.</strong> {mstr.record.id} called {mstr.record.prediction.direction.toLowerCase()} under {mstr.record.modelVersion}, whose gate compared the hit rate with a coin flip and tested each instrument alone. {mstr.ruleCheck!.note} The record stays on the ledger unchanged; this note sits beside it.
        </Note>
      )}

      <Panel title="Current predictions" eyebrow={`${pending.length} pending · not yet scorable`} source="Forecast ledger. Ranges are for the instrument's own return and for its return relative to the benchmark.">
        <p className="mb-1 text-[11.5px] text-ink-soft md:hidden">Scroll sideways for more columns.</p>
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[960px] text-[12.5px]" aria-label="Pending forecasts">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-panel px-5 py-2 text-left font-medium md:pl-6">Instrument</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Horizon</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Data to</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Direction</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">80% range</th>
                <th scope="col" className="px-2 py-2 text-right font-medium" title="Relative wealth return: (1 + return) / (1 + benchmark return) − 1. Not the arithmetic difference.">Relative to benchmark</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Realizes</th>
                <th scope="col" className="px-2 py-2 text-left font-medium md:pr-6">Made</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(({ record: r, score }) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-panel px-5 py-1.5 text-left font-normal md:pl-6"><span className="font-medium text-ink">{r.instrument}</span> <span className="text-[11.5px] text-ink-soft">vs {r.benchmark ?? "—"}</span></th>
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

      <Panel title="Live outcomes" eyebrow={`${liveScored.length} realized`} source="Forecast ledger scored against Yahoo Finance daily closes.">
        {liveScored.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No live forecast has reached its horizon yet{firstLive ? `; the first, ${firstLive.record.instrument} over ${firstLive.record.horizon} bar${firstLive.record.horizon === 1 ? "" : "s"}, realizes after ${firstLive.score.barsRemaining} more.` : "."} Until then the platform has no forward track record, and nothing below should be read as one.
          </p>
        ) : (
          <OutcomeTable rows={liveScored} caption="Live forecast outcomes" />
        )}
      </Panel>

      <Panel title="Worked examples (backfilled)" eyebrow={`${backfillScored.length} realized · not evidence of foresight`} source="Forecast ledger scored against Yahoo Finance daily closes; benchmark return over the same interval.">
        <p className="mb-3 text-[12.5px] leading-relaxed text-ink-muted">
          These were generated after the fact, from data available at each cutoff. They test the scoring machinery on real outcomes. Whoever ran them already knew what happened, so they cannot show foresight, however well they scored.
        </p>
        {backfillScored.length > 0 && <OutcomeTable rows={backfillScored} caption="Backfilled forecast outcomes" />}
      </Panel>

      <Panel
        title="Are the 80% ranges honest?"
        eyebrow="Nominal 80% versus what happened out of sample"
        source={`Walk-forward over the snapshot's three years: ${symbols.length} instruments, a forecast every 5 bars, no refitting on the test period. Regimes from the benchmark's 20-day volatility percentile within its trailing year.`}
      >
        <p className="text-[13px] leading-relaxed text-ink">
          An 80% range should contain the outcome 80% of the time. The dot is the share that did, pooled across instruments; the bar is a 95% interval on the effective sample size, after allowing for overlapping horizons and for instruments missing together (a market-wide shock breaks every range at once). When the whole bar sits off the 80% line, the gap is larger than chance usually produces at that effective sample size: evidence of miscalibration under this test, not proof, since the effective-sample adjustment is itself an approximation.
        </p>
        <div className="-mx-5 mt-4 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[720px] text-[12.5px]" aria-label="Pooled interval coverage by horizon and volatility regime">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 text-left font-medium md:pl-6">Horizon · regime</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Coverage</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">50% · 80% · 100%</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">95% interval</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Forecasts (effective)</th>
                <th scope="col" className="px-2 py-2 text-left font-medium md:pr-6">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {pools.flatMap((p) => [
                { key: `${p.horizon}`, label: `${p.horizon}-bar, all regimes`, stat: p.overall, head: true, rho: p.meanCorrelation },
                ...REGIMES.map((g) => ({ key: `${p.horizon}-${g}`, label: g, stat: p.byRegime[g], head: false, rho: p.meanCorrelation })),
              ]).map((row) => (
                <tr key={row.key} className={`border-b border-line last:border-0 ${row.head ? "border-t border-t-ink/15" : ""}`}>
                  <th scope="row" className={`px-5 py-1.5 text-left md:pl-6 ${row.head ? "font-medium text-ink" : "pl-8 font-normal text-ink-muted md:pl-10"}`}>
                    {row.label}
                    {row.head && <span className="ml-1.5 text-[11px] font-normal text-ink-soft">ρ̄ = {row.rho.toFixed(2)}</span>}
                  </th>
                  <td className="num px-2 py-1.5 text-right text-ink">{pct0(row.stat.coverage)}</td>
                  <td className="px-2 py-1.5"><CoverageBar stat={row.stat} /></td>
                  <td className="num px-2 py-1.5 text-right text-ink-muted">{ci(row.stat)}</td>
                  <td className="num px-2 py-1.5 text-right text-ink-muted">{row.stat.n} ({row.stat.effectiveN})</td>
                  <td className={`px-2 py-1.5 md:pr-6 ${VERDICT[row.stat.verdict].cls}`}>{VERDICT[row.stat.verdict].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
          {regimeGap !== null && regimeGap > 0.03 && (
            <p>
              Reading the pattern: averaged across horizons, ranges covered {pct0(stressedCov)} in stressed markets and {pct0(calmCov)} in calm ones. Exponentially weighted volatility reacts to a shock after it happens, so the range is widest just as markets start calming down, and narrowest just before the next surprise. The overall figure can sit near 80% while each regime misses in opposite directions, which is why it is reported both ways.
            </p>
          )}
          <p>
            Effective sample sizes are small at long horizons: a 60-bar forecast every 5 bars shares eleven-twelfths of its path with the next one. Three years of history contain few stressed episodes, so the stressed-regime intervals are wide.
          </p>
        </div>
      </Panel>

      <Panel
        title="Is there any directional skill?"
        eyebrow={`${validated} of ${family.length} instrument–horizon tests pass`}
        source="Same walk-forward. The skill test compares the rule with the better of 'always up' and 'always down' on the same dates, then corrects for every test run together (Holm)."
      >
        <p className="text-[13px] leading-relaxed text-ink">
          Beating 50% is not skill: a stock that fell on 60% of days makes &ldquo;always down&rdquo; right 60% of the time. A direction is allowed only if the rule beats the better constant rule in a paired sign test on the effective sample, the result survives a Holm correction across all {family.length} tests, its Brier skill score against the hindsight base rate is above zero, and both halves of the sample agree.{" "}
          {validated === 0 ? "None does, so every new forecast abstains on direction and the range is the forecast." : `${validated} pass${validated === 1 ? "es" : ""}; every other forecast abstains on direction.`}
        </p>
        <p className="mb-1 mt-3 text-[11.5px] text-ink-soft md:hidden">Scroll sideways for more columns; the instrument stays pinned.</p>
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[1100px] text-[12.5px]" aria-label="Out-of-sample record by instrument and horizon">
            <thead className="border-b border-line text-[11.5px] text-ink-soft">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-panel px-5 py-2 text-left font-medium md:pl-6">Instrument · horizon</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Forecasts (effective)</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">80% coverage</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Range</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Calm / normal / stressed</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Hit rate vs best constant</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">p (Holm)</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Brier skill vs base rate</th>
                <th scope="col" className="px-2 py-2 text-left font-medium md:pr-6">Direction</th>
              </tr>
            </thead>
            <tbody>
              {symbols.flatMap((sym) =>
                HORIZONS.map((h) => {
                  const e = evaluation(sym, h);
                  if (!e || e.n === 0) return null;
                  const k = e.skill;
                  const reg = (g: (typeof REGIMES)[number]) => pct0(e.byRegime[g].coverage).replace("%", "");
                  return (
                    <tr key={`${sym}-${h}`} className={`border-b border-line last:border-0 ${h === 1 ? "border-t border-t-ink/15" : ""}`}>
                      <th scope="row" className="sticky left-0 z-10 bg-panel px-5 py-1.5 text-left font-normal md:pl-6">
                        <span className={h === 1 ? "font-medium text-ink" : "text-ink-soft"}>{sym}</span> <span className="num text-ink-muted">{h}</span>
                      </th>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{e.n} ({e.effectiveN})</td>
                      <td className="num px-2 py-1.5 text-right text-ink">{pct0(e.coverage)}</td>
                      <td className={`px-2 py-1.5 text-[11.5px] ${VERDICT[e.coverageStat.verdict].cls}`} title={`95% interval ${ci(e.coverageStat)}`}>{VERDICT[e.coverageStat.verdict].label}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{reg("calm")} / {reg("normal")} / {reg("stressed")}</td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted" title={k.sideChanges === 0 ? `Called ${k.onlySide?.toLowerCase()} every time` : `${k.discordantWins} wins in ${k.discordant} disagreements with the constant rule`}>
                        {pct0(k.hitRate)} vs {pct0(k.bestConstantHitRate)} <span className="text-ink-soft">{k.bestConstant === "UP" ? "↑" : "↓"}</span>
                      </td>
                      <td className="num px-2 py-1.5 text-right text-ink-muted">{k.adjustedP === null ? "—" : k.adjustedP >= 0.995 ? "1.00" : k.adjustedP.toFixed(2)}</td>
                      <td className={`num px-2 py-1.5 text-right ${tone(e.brierSkillVsBaseRate)}`}>{e.brierSkillVsBaseRate === null ? "—" : e.brierSkillVsBaseRate.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-ink-muted md:pr-6" title={e.validationNote}>{e.directionValidated ? <span className="font-medium text-ink">validated</span> : "abstain"}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          &ldquo;Best constant&rdquo; is chosen with hindsight, which makes the bar higher, not lower. Brier skill vs base rate is 1 − (the rule&apos;s Brier score ÷ the Brier score of always quoting the share of periods the instrument rose); below zero, the rule&apos;s probabilities scored worse than that constant. Previous rule ({Object.keys(MODEL_HISTORY).filter((v) => v !== MODEL_VERSION).join(", ")}): {Object.entries(MODEL_HISTORY).filter(([v]) => v !== MODEL_VERSION).map(([, d]) => d).join(" ")}
        </p>
      </Panel>
    </div>
  );
}
