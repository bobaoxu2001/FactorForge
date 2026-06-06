/**
 * Deterministic scenario-forecast engine.
 *
 * Takes a configured theme template ({@link ./catalystMapper}) and the live
 * market-stress regime, and produces bull/base/bear legs with estimated
 * proxy-basket impact ranges, an expected-impact midpoint, a confidence score,
 * and a catalyst-sensitivity score.
 *
 * These are ESTIMATES derived from templates + market regime — never price
 * predictions and never live news. The language is intentionally framed as
 * "estimated proxy impact range" rather than "the basket will move X%".
 */

import type { HotspotScenario, ScenarioLeg, SignalModel } from "./types";
import type { ThemeTemplate } from "./catalystMapper";

export interface RegimeContext {
  /** 0–100 market-stress score from the live market-stress report. */
  stressScore: number;
  regime: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Build the regime-adjusted scenario for a theme.
 *
 * @param template      configured theme template
 * @param ctx           live market regime context
 * @param coverageRatio share of proxies that are in the research universe (0–1)
 */
export function buildScenario(
  template: ThemeTemplate,
  ctx: RegimeContext,
  coverageRatio: number,
): HotspotScenario {
  // regimeTilt: positive when the tape is stressed (risk-off), negative when calm.
  const regimeTilt = clamp((ctx.stressScore - 45) / 55, -1, 1);
  const model: SignalModel = template.signalModel;

  // Defensive themes brighten in stress; growth/macro dim in stress.
  const directional = model === "defensive" ? -1 : 1;
  // Max ±2.5% shift on the range bounds from the regime.
  const boundShift = directional * regimeTilt * 0.025;

  const legs: ScenarioLeg[] = template.scenarioTemplate.map((leg) => {
    const low = round1(leg.impactLow - boundShift);
    const high = round1(leg.impactHigh - boundShift);
    return { ...leg, impactLow: Math.min(low, high), impactHigh: Math.max(low, high) };
  });

  // Re-weight probabilities toward the bear leg in stress (growth/macro) or the
  // bull (defensive-leadership) leg in stress, then renormalize.
  const probShift = regimeTilt * 0.12;
  const reweighted = legs.map((leg) => {
    let p = leg.probability;
    if (leg.case === "bear") p += directional === 1 ? probShift : -probShift;
    if (leg.case === "bull") p -= directional === 1 ? probShift : -probShift;
    return { leg, p: clamp(p, 0.05, 0.9) };
  });
  const totalP = reweighted.reduce((s, r) => s + r.p, 0);
  const normalizedLegs = reweighted.map(({ leg, p }) => ({ ...leg, probability: round1(p / totalP) }));

  const expectedImpact = round1(
    normalizedLegs.reduce((s, leg) => s + leg.probability * ((leg.impactLow + leg.impactHigh) / 2), 0),
  );

  // Confidence: configured base, lifted by universe coverage and regime clarity,
  // penalized when no proxy is in the universe (fully template-based).
  const regimeClarity = Math.abs(regimeTilt); // clearer regime → more confident
  const templateOnlyPenalty = coverageRatio === 0 ? 12 : 0;
  const confidence = Math.round(
    clamp(
      template.baseConfidence + (coverageRatio - 0.5) * 28 + regimeClarity * 10 - templateOnlyPenalty,
      8,
      92,
    ),
  );

  // Catalyst sensitivity: mean configured catalyst weight, nudged by the
  // highest-beta proxy in the basket (high-beta baskets are more catalyst-reactive).
  const meanSens =
    template.catalysts.reduce((s, c) => s + c.sensitivity, 0) / Math.max(template.catalysts.length, 1);
  const maxBeta = template.proxyTemplates.reduce((m, p) => Math.max(m, p.catalystBeta), 0);
  const catalystSensitivity = Math.round(clamp(meanSens * 82 + (maxBeta - 1) * 16, 5, 99));

  return { legs: normalizedLegs, expectedImpact, confidence, catalystSensitivity };
}

/** Format a single impact point as a signed percentage, e.g. "+8%". */
export function formatImpact(value: number, digits = 0): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

/** Format an impact range as a research-safe string, e.g. "+8% to +18%". */
export function formatImpactRange(low: number, high: number, digits = 0): string {
  return `${formatImpact(low, digits)} to ${formatImpact(high, digits)}`;
}
