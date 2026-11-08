import { predict, scoreForecast, sliceToCutoff, INTERVAL_LEVEL, type ForecastScore, type Horizon, type Prediction } from "./forecast";
import type { PriceSeries } from "./market";

/**
 * Walk-forward evaluation of the baseline forecast.
 *
 * At each origin (every `step` bars) the model sees only bars up to that
 * origin, makes its forecast, and is scored `horizon` bars later. Nothing is
 * refitted on the test period.
 *
 * Two questions, kept apart:
 *
 * 1. Is the 80% range honest? Empirical coverage is reported against the
 *    nominal level with a Wilson interval computed on the effective sample
 *    size, overall and by volatility regime.
 *
 * 2. Is there directional skill worth acting on? The bar is not "better than
 *    a coin flip": an instrument that rose on 60% of days makes "always up"
 *    right 60% of the time. The model must beat the better of the two constant
 *    rules (always up, always down) in a paired test, beat the hindsight base
 *    rate on Brier score, do so in both halves of the sample, and survive a
 *    Holm correction across every instrument and horizon tested together.
 *
 * Overlapping horizons (a 20-bar forecast every 5 bars) make observations
 * dependent. Every test runs on an effective sample size: the smaller of the
 * overlap count (n × step / horizon) and an autocorrelation-adjusted count
 * (Bartlett-weighted), so dependence from volatility clustering is caught too.
 */

export type Regime = "calm" | "normal" | "stressed";
export const REGIMES: Regime[] = ["calm", "normal", "stressed"];
export const SIGNIFICANCE = 0.05;

export interface WalkForwardSample {
  origin: string;
  regime: Regime;
  prediction: Prediction;
  score: ForecastScore;
  /** Trailing-mean drift forecast, the "slightly smarter" rival to zero drift. */
  driftForecast: number;
}

export interface CoverageStat {
  n: number;
  effectiveN: number;
  hits: number;
  coverage: number | null;
  /** 95% Wilson interval on the effective sample size. */
  ci: [number, number] | null;
  verdict: "consistent" | "too-narrow" | "too-wide" | "too-few";
}

export interface SkillTest {
  /** Origins where the rule had a side (pUp ≠ 0.5). */
  calls: number;
  hitRate: number | null;
  alwaysUpHitRate: number | null;
  alwaysDownHitRate: number | null;
  bestConstant: "UP" | "DOWN" | null;
  bestConstantHitRate: number | null;
  /** How often the rule switched side across origins. 0 = it is a constant rule. */
  sideChanges: number;
  /** The one side a constant rule called, when it never switched. */
  onlySide: "UP" | "DOWN" | null;
  /** Origins where the rule and the best constant rule disagreed, and how many the rule won. */
  discordant: number;
  discordantWins: number;
  effectiveN: number;
  /** One-sided exact sign test of "beats the best constant rule", on the effective discordant count. */
  pValue: number | null;
  /** Holm-adjusted across the family (Bonferroni when only the family size is known). */
  adjustedP: number | null;
  familySize: number;
  halvesAgree: boolean;
}

export interface WalkForwardSummary {
  instrument: string;
  horizon: Horizon;
  n: number;
  /** Effective n for the coverage series (see module note). */
  effectiveN: number;
  /** n × step / horizon: the overlap-only count, for reference. */
  overlapN: number;
  coverage: number | null;
  coverageStat: CoverageStat;
  relCoverage: number | null;
  maeZero: number | null;
  rmseZero: number | null;
  maeDrift: number | null;
  rmseDrift: number | null;
  brier: number | null;
  /** Against a coin flip (0.25). A low bar: any drifting asset clears it. */
  brierSkill: number | null;
  /** Against the hindsight base rate (constant forecast = realized up share). */
  brierSkillVsBaseRate: number | null;
  hitRate: number | null;
  /** Share of outcomes that were positive: what "always up" would have scored. */
  upShare: number | null;
  skill: SkillTest;
  /** Raw p-value of the skill test (kept for callers that only need the number). */
  pValue: number | null;
  directionValidated: boolean;
  validationNote: string;
  byRegime: Record<Regime, CoverageStat & { maeZero: number | null }>;
  calibration: Array<{ bin: string; n: number; meanP: number; observedUp: number }>;
  firstOrigin: string | null;
  lastOrigin: string | null;
  /** Origin → 1 if the realized return fell inside the 80% range. For pooling across instruments. */
  insideByOrigin: Record<string, 0 | 1>;
  regimeByOrigin: Record<string, Regime>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ── Distributions ───────────────────────────────────────────────────────────

export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

function logChoose(n: number, k: number): number {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
  return s;
}

/** Exact one-sided binomial tail P(X ≥ k) for X ~ Bin(n, p0). */
export function binomialTail(k: number, n: number, p0 = 0.5): number | null {
  if (n <= 0) return null;
  if (k <= 0) return 1;
  if (k > n) return 0;
  let total = 0;
  for (let i = k; i <= n; i++) total += Math.exp(logChoose(n, i) + i * Math.log(p0) + (n - i) * Math.log(1 - p0));
  return Math.min(1, total);
}

/** One-sided test of hit rate > 0.5 (exact). Kept for the coin-flip comparison. */
export function binomialPValue(hits: number, n: number): number | null {
  return binomialTail(hits, n, 0.5);
}

/** 95% Wilson score interval. */
export function wilson(successes: number, n: number, z = 1.959963984540054): [number, number] | null {
  if (n <= 0) return null;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// ── Dependence ──────────────────────────────────────────────────────────────

/**
 * Effective sample size of a series sampled every `step` bars at a `horizon`:
 * the smaller of the overlap count and n / (1 + 2 Σ w_k ρ_k), with Bartlett
 * weights over enough lags to span the overlap plus two. Negative
 * autocorrelation never inflates n.
 */
export function effectiveSampleSize(xs: number[], horizon: number, step: number): { effective: number; overlap: number; autocorr: number } {
  const n = xs.length;
  if (n === 0) return { effective: 0, overlap: 0, autocorr: 0 };
  const overlap = horizon > step ? Math.max(1, Math.floor((n * step) / horizon)) : n;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const c0 = xs.reduce((a, x) => a + (x - m) ** 2, 0) / n;
  let autocorr = n;
  if (c0 > 0) {
    const K = Math.min(n - 1, Math.ceil(horizon / step) + 2);
    let s = 0;
    for (let k = 1; k <= K; k++) {
      let ck = 0;
      for (let i = k; i < n; i++) ck += (xs[i] - m) * (xs[i - k] - m);
      s += (1 - k / (K + 1)) * (ck / n / c0);
    }
    autocorr = Math.max(1, Math.floor(n / Math.max(1, 1 + 2 * s)));
  }
  return { effective: Math.max(1, Math.min(overlap, autocorr)), overlap, autocorr };
}

export function coverageStat(inside: Array<0 | 1>, horizon: number, step: number, level = INTERVAL_LEVEL): CoverageStat {
  const n = inside.length;
  const hits = inside.reduce<number>((a, b) => a + b, 0);
  if (n === 0) return { n, effectiveN: 0, hits, coverage: null, ci: null, verdict: "too-few" };
  const { effective } = effectiveSampleSize(inside, horizon, step);
  const coverage = hits / n;
  const ci = wilson(coverage * effective, effective);
  const verdict: CoverageStat["verdict"] = effective < 10 || !ci ? "too-few" : ci[1] < level ? "too-narrow" : ci[0] > level ? "too-wide" : "consistent";
  return { n, effectiveN: effective, hits, coverage, ci, verdict };
}

// ── Regimes ─────────────────────────────────────────────────────────────────

/** Trailing 20-bar realized volatility percentile against the previous 250 bars → regime per date. */
export function regimeByDate(series: PriceSeries): Map<string, Regime> {
  const r = series.adj.slice(1).map((p, i) => Math.log(p / series.adj[i]));
  const vol: Array<number | null> = r.map((_, i) => {
    if (i < 19) return null;
    const w = r.slice(i - 19, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (w.length - 1));
  });
  const out = new Map<string, Regime>();
  vol.forEach((v, i) => {
    if (v === null || i < 270) return;
    const hist = vol.slice(i - 250, i).filter((x): x is number => x !== null);
    const pct = hist.filter((x) => x < v).length / hist.length;
    out.set(series.dates[i + 1], pct > 2 / 3 ? "stressed" : pct < 1 / 3 ? "calm" : "normal");
  });
  return out;
}

// ── Walk-forward ────────────────────────────────────────────────────────────

export function walkForward(
  asset: PriceSeries,
  bench: PriceSeries | null,
  regimeSource: PriceSeries,
  horizon: Horizon,
  step = 5,
  until?: string,
): WalkForwardSample[] {
  const regimes = regimeByDate(regimeSource);
  const samples: WalkForwardSample[] = [];
  const last = until ? asset.dates.filter((d) => d <= until).length - 1 : asset.dates.length - 1;
  // Score only against data inside the evaluation window.
  const visible = until ? sliceToCutoff(asset, until) : asset;
  const visibleBench = bench && until ? sliceToCutoff(bench, until) : bench;
  for (let i = 260; i + horizon <= last; i += step) {
    const origin = asset.dates[i];
    const { dataAsOf, prediction } = predict({ instrument: asset.symbol, benchmark: bench?.symbol ?? null, horizon, informationCutoff: origin }, asset, bench);
    if (prediction.status !== "OK") continue;
    const score = scoreForecast({ dataAsOf, horizon, prediction, costBps: 0 }, visible, visibleBench);
    if (score.status !== "scored") continue;
    const past = asset.adj.slice(Math.max(0, i - 250), i + 1);
    const drift = past.length > 1 ? Math.log(past.at(-1)! / past[0]) / (past.length - 1) : 0;
    samples.push({ origin, regime: regimes.get(origin) ?? "normal", prediction, score, driftForecast: Math.exp(drift * horizon) - 1 });
  }
  return samples;
}

function skillTest(calls: WalkForwardSample[], horizon: number, step: number, familySize: number): SkillTest {
  const empty: SkillTest = {
    calls: calls.length,
    hitRate: null,
    alwaysUpHitRate: null,
    alwaysDownHitRate: null,
    bestConstant: null,
    bestConstantHitRate: null,
    sideChanges: 0,
    onlySide: null,
    discordant: 0,
    discordantWins: 0,
    effectiveN: 0,
    pValue: null,
    adjustedP: null,
    familySize,
    halvesAgree: false,
  };
  if (calls.length === 0) return empty;
  const up = calls.map((s) => s.score.realized! > 0);
  const side = calls.map((s) => s.prediction.pUp! >= 0.5);
  const hit = side.map((x, i) => x === up[i]);
  const upShare = up.filter(Boolean).length / up.length;
  const bestConstant: "UP" | "DOWN" = upShare >= 0.5 ? "UP" : "DOWN";
  const bestSide = bestConstant === "UP";
  const constHit = up.map((u) => u === bestSide);
  const sideChanges = side.reduce((acc, x, i) => (i > 0 && x !== side[i - 1] ? acc + 1 : acc), 0);

  // Paired comparison with the best constant rule: only origins where they disagree carry information.
  const diff = hit.map((h, i) => Number(h) - Number(constHit[i]));
  const discordant = diff.filter((d) => d !== 0).length;
  const discordantWins = diff.filter((d) => d > 0).length;
  const { effective } = effectiveSampleSize(diff, horizon, step);
  const shrink = effective / calls.length;
  const mEff = Math.round(discordant * shrink);
  const kEff = Math.round(discordantWins * shrink);
  const pValue = discordant === 0 ? 1 : (binomialTail(kEff, mEff, 0.5) ?? 1);

  const half = Math.floor(calls.length / 2);
  const gain = (from: number, to: number) => diff.slice(from, to).reduce((a, b) => a + b, 0);
  const halvesAgree = calls.length >= 20 && gain(0, half) > 0 && gain(half, calls.length) > 0;

  return {
    calls: calls.length,
    hitRate: hit.filter(Boolean).length / calls.length,
    alwaysUpHitRate: upShare,
    alwaysDownHitRate: 1 - upShare,
    bestConstant,
    bestConstantHitRate: Math.max(upShare, 1 - upShare),
    sideChanges,
    onlySide: sideChanges === 0 ? (side[0] ? "UP" : "DOWN") : null,
    discordant,
    discordantWins,
    effectiveN: effective,
    pValue,
    adjustedP: Math.min(1, pValue * familySize),
    familySize,
    halvesAgree,
  };
}

function verdictFor(s: Pick<WalkForwardSummary, "n" | "skill" | "brierSkillVsBaseRate">): { validated: boolean; note: string } {
  const k = s.skill;
  if (s.n === 0 || k.calls === 0) return { validated: false, note: "No scored forecasts yet." };
  const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
  const validated = k.adjustedP !== null && k.adjustedP < SIGNIFICANCE && (s.brierSkillVsBaseRate ?? 0) > 0 && k.halvesAgree;
  const head = `Hit rate ${pct(k.hitRate)} vs ${pct(k.bestConstantHitRate)} for "always ${k.bestConstant?.toLowerCase()}"`;
  if (validated) {
    return { validated, note: `${head}; beats it on ${k.effectiveN} effective observations (Holm-adjusted p = ${k.adjustedP!.toFixed(3)} across ${k.familySize} tests), better Brier than the base rate, both halves agree.` };
  }
  const reasons: string[] = [];
  if (k.sideChanges === 0) reasons.push(`it called ${k.onlySide?.toLowerCase()} every time, so it is a constant rule and cannot beat one`);
  else if (k.adjustedP === null || k.adjustedP >= SIGNIFICANCE) reasons.push(`no edge over the constant rule after correcting for ${k.familySize} tests (raw p = ${k.pValue?.toFixed(2) ?? "n/a"}, adjusted ${k.adjustedP?.toFixed(2) ?? "n/a"})`);
  if ((s.brierSkillVsBaseRate ?? 0) <= 0) reasons.push("Brier no better than the base rate");
  if (!k.halvesAgree && k.sideChanges > 0) reasons.push("halves disagree");
  return { validated: false, note: `Not validated: ${head}; ${reasons.join("; ")}.` };
}

export function summarize(instrument: string, horizon: Horizon, samples: WalkForwardSample[], step = 5, familySize = 1): WalkForwardSummary {
  const scored = samples.filter((s) => s.score.realized !== null);
  const n = scored.length;
  const overlapN = horizon > step ? Math.max(1, Math.floor((n * step) / horizon)) : n;
  const realized = scored.map((s) => s.score.realized!);
  const inside = scored.map((s) => (s.score.inInterval ? 1 : 0) as 0 | 1);
  const cov = coverageStat(inside, horizon, step);
  const rel = scored.map((s) => s.score.inRelInterval).filter((x): x is boolean => x !== null);
  const errDrift = scored.map((s) => s.score.realized! - s.driftForecast);
  const briers = scored.map((s) => s.score.brier).filter((x): x is number => x !== null);
  const calls = scored.filter((s) => s.prediction.pUp !== null && s.prediction.pUp !== 0.5);
  const skill = skillTest(calls, horizon, step, familySize);
  const brier = mean(briers);
  const upShare = n ? realized.filter((x) => x > 0).length / n : null;
  const baseRateBrier = upShare === null ? null : upShare * (1 - upShare);

  const byRegime = Object.fromEntries(
    REGIMES.map((g) => {
      const xs = scored.filter((s) => s.regime === g);
      const stat = coverageStat(xs.map((s) => (s.score.inInterval ? 1 : 0) as 0 | 1), horizon, step);
      return [g, { ...stat, maeZero: mean(xs.map((s) => Math.abs(s.score.realized!))) }];
    }),
  ) as WalkForwardSummary["byRegime"];

  const bins = [
    [0, 0.45],
    [0.45, 0.5],
    [0.5, 0.55],
    [0.55, 0.6],
    [0.6, 1.01],
  ];
  const calibration = bins
    .map(([lo, hi]) => {
      const xs = calls.filter((s) => s.prediction.pUp! >= lo && s.prediction.pUp! < hi);
      return {
        bin: hi > 1 ? `≥ ${lo.toFixed(2)}` : `${lo.toFixed(2)}–${hi.toFixed(2)}`,
        n: xs.length,
        meanP: mean(xs.map((s) => s.prediction.pUp!)) ?? 0,
        observedUp: xs.length ? xs.filter((s) => s.score.realized! > 0).length / xs.length : 0,
      };
    })
    .filter((b) => b.n > 0);

  const partial = {
    n,
    skill,
    brierSkillVsBaseRate: brier === null || !baseRateBrier ? null : 1 - brier / baseRateBrier,
  };
  const { validated, note } = verdictFor(partial);

  return {
    instrument,
    horizon,
    n,
    effectiveN: cov.effectiveN,
    overlapN,
    coverage: cov.coverage,
    coverageStat: cov,
    relCoverage: rel.length ? rel.filter(Boolean).length / rel.length : null,
    maeZero: mean(realized.map(Math.abs)),
    rmseZero: n ? Math.sqrt(mean(realized.map((e) => e * e))!) : null,
    maeDrift: mean(errDrift.map(Math.abs)),
    rmseDrift: n ? Math.sqrt(mean(errDrift.map((e) => e * e))!) : null,
    brier,
    brierSkill: brier === null ? null : 1 - brier / 0.25,
    brierSkillVsBaseRate: partial.brierSkillVsBaseRate,
    hitRate: skill.hitRate,
    upShare,
    skill,
    pValue: skill.pValue,
    directionValidated: validated,
    validationNote: note,
    byRegime,
    calibration,
    firstOrigin: scored[0]?.origin ?? null,
    lastOrigin: scored.at(-1)?.origin ?? null,
    insideByOrigin: Object.fromEntries(scored.map((s, i) => [s.origin, inside[i]])),
    regimeByOrigin: Object.fromEntries(scored.map((s) => [s.origin, s.regime])),
  };
}

/**
 * Holm step-down correction across every instrument × horizon tested
 * together. A direction is validated only if it survives the family.
 */
export function applyFamily(summaries: WalkForwardSummary[]): WalkForwardSummary[] {
  const m = summaries.length;
  const order = summaries.map((s, i) => ({ i, p: s.skill.pValue ?? 1 })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(({ i, p }, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return summaries.map((s, i) => {
    const skill: SkillTest = { ...s.skill, adjustedP: s.skill.pValue === null ? null : adjusted[i], familySize: m };
    const { validated, note } = verdictFor({ n: s.n, skill, brierSkillVsBaseRate: s.brierSkillVsBaseRate });
    return { ...s, skill, directionValidated: validated, validationNote: note };
  });
}

// ── Pooling across instruments ──────────────────────────────────────────────

function correlation(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 20) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}

export interface PooledCoverage {
  horizon: Horizon;
  instruments: number;
  /** Mean pairwise correlation of the inside-the-range indicators on shared origins. */
  meanCorrelation: number;
  overall: CoverageStat;
  byRegime: Record<Regime, CoverageStat>;
}

/**
 * Coverage pooled across instruments for one horizon. Instruments miss
 * together (a market-wide shock breaks every range at once), so the effective
 * size is the sum of per-instrument effective sizes deflated by the design
 * effect 1 + (m − 1)·ρ̄.
 */
export function pooledCoverage(horizon: Horizon, summaries: WalkForwardSummary[], level = INTERVAL_LEVEL): PooledCoverage {
  const xs = summaries.filter((s) => s.horizon === horizon && s.n > 0);
  const corrs: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const shared = Object.keys(xs[i].insideByOrigin).filter((o) => o in xs[j].insideByOrigin);
      const r = correlation(shared.map((o) => xs[i].insideByOrigin[o]), shared.map((o) => xs[j].insideByOrigin[o]));
      if (r !== null) corrs.push(r);
    }
  }
  const rho = Math.min(1, Math.max(0, corrs.length ? corrs.reduce((a, b) => a + b, 0) / corrs.length : 0));
  const deff = 1 + (xs.length - 1) * rho;
  const pool = (pick: (s: WalkForwardSummary) => CoverageStat): CoverageStat => {
    const stats = xs.map(pick).filter((c) => c.n > 0);
    const n = stats.reduce((a, c) => a + c.n, 0);
    const hits = stats.reduce((a, c) => a + c.hits, 0);
    if (n === 0) return { n, effectiveN: 0, hits, coverage: null, ci: null, verdict: "too-few" };
    const effectiveN = Math.max(1, Math.floor(stats.reduce((a, c) => a + c.effectiveN, 0) / deff));
    const coverage = hits / n;
    const ci = wilson(coverage * effectiveN, effectiveN);
    const verdict: CoverageStat["verdict"] = effectiveN < 10 || !ci ? "too-few" : ci[1] < level ? "too-narrow" : ci[0] > level ? "too-wide" : "consistent";
    return { n, effectiveN, hits, coverage, ci, verdict };
  };
  return {
    horizon,
    instruments: xs.length,
    meanCorrelation: rho,
    overall: pool((s) => s.coverageStat),
    byRegime: Object.fromEntries(REGIMES.map((g) => [g, pool((s) => s.byRegime[g])])) as Record<Regime, CoverageStat>,
  };
}
