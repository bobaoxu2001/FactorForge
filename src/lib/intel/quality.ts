import type { ResearchProjectConfig } from "@/data/research/types";
import type { CompanyView } from "./companies";
import type { CheckState, Evidence, HypothesisView, KpiSeriesView, MemoStatus, QualityCheck } from "./types";

/**
 * Research-completeness checks. Each one is a pass/warn/fail with the reason
 * in plain words. Deliberately no composite score: a single number would
 * imply a precision these judgements do not have.
 */

export interface QualityInputs {
  config: ResearchProjectConfig;
  evidence: Evidence[];
  hypotheses: HypothesisView[];
  kpis: KpiSeriesView[];
  companies: CompanyView[];
  /** User-provided primary research items (client-side workspace). */
  primaryResearchCount: number;
  /** Companies whose scenarios have user-entered, justified probabilities. */
  scenarioProbabilityCount: number;
}

const state = (ok: boolean, warn: boolean): CheckState => (ok ? "pass" : warn ? "warn" : "fail");

export function runQualityChecks(input: QualityInputs): QualityCheck[] {
  const { config, evidence, hypotheses, kpis, companies } = input;
  const checks: QualityCheck[] = [];

  const official = evidence.filter((e) => e.source.sourceType === "government-dataset" || e.source.sourceType === "sec-xbrl" || e.source.sourceType === "sec-filing").length;
  const share = evidence.length ? official / evidence.length : 0;
  checks.push({
    id: "source-quality",
    label: "Source quality",
    state: state(share >= 0.7, share >= 0.4),
    detail: `${official} of ${evidence.length} evidence items come from official statistics or SEC filings (${Math.round(share * 100)}%). The rest are industry data, market data or calculations.`,
  });

  const thin = hypotheses.filter((h) => h.supportingEvidenceIds.length + h.contradictingEvidenceIds.length < 2);
  checks.push({
    id: "evidence-coverage",
    label: "Evidence coverage per hypothesis",
    state: state(thin.length === 0, thin.length <= 2),
    detail: thin.length === 0 ? "Every hypothesis is tested against at least two evidence items." : `Thin coverage: ${thin.map((h) => `${h.id} ${h.title}`).join("; ")}.`,
  });

  const withContra = hypotheses.filter((h) => h.contradictingEvidenceIds.length > 0).length;
  checks.push({
    id: "contradictions",
    label: "Contradictory evidence surfaced",
    state: withContra > 0 ? "pass" : "warn",
    detail: `${withContra} of ${hypotheses.length} hypotheses have evidence pointing against them, shown next to the supporting evidence. A thesis with no contradicting evidence usually has not been tested hard enough.`,
  });

  const undecided = hypotheses.filter((h) => h.overall === "insufficient-data");
  checks.push({
    id: "testability",
    label: "Hypotheses testable with connected data",
    state: state(undecided.length === 0, undecided.length < hypotheses.length / 2),
    detail: undecided.length === 0 ? "Every hypothesis has at least one decided test." : `No decided test yet: ${undecided.map((h) => h.id).join(", ")}.`,
  });

  const stale = kpis.filter((k) => k.freshness === "stale");
  const lagging = kpis.filter((k) => k.freshness === "lagging");
  checks.push({
    id: "freshness",
    label: "Data freshness",
    state: state(stale.length === 0 && lagging.length === 0, stale.length === 0),
    detail:
      stale.length + lagging.length === 0
        ? "All KPI series are current relative to their release cadence."
        : `Stale: ${stale.map((k) => k.kpi.name).join(", ") || "none"}. Lagging: ${lagging.map((k) => k.kpi.name).join(", ") || "none"}.`,
  });

  const incomplete = companies.filter((c) => !c.latestTtm || c.latestTtm.ttmFreeCashFlow === null || !c.latestTtm.debt || !c.valuation);
  checks.push({
    id: "financial-model",
    label: "Financial model completeness",
    state: state(incomplete.length === 0, incomplete.length <= 2),
    detail:
      incomplete.length === 0
        ? "TTM revenue, margins, FCF, debt and valuation are available for every covered company."
        : `Incomplete inputs for ${incomplete.map((c) => c.ticker).join(", ")}. See each company's data gaps.`,
  });

  const focus = config.companies.filter((c) => c.focus).length;
  checks.push({
    id: "valuation-assumptions",
    label: "Valuation assumptions documented",
    state: input.scenarioProbabilityCount >= focus ? "pass" : "warn",
    detail:
      input.scenarioProbabilityCount >= focus
        ? "Scenario probabilities are set with written justifications for every focus company."
        : "Scenario assumptions are anchored to each company's history, but no justified probabilities are set, so no expected return is computed.",
  });

  checks.push({
    id: "primary-research",
    label: "Primary research",
    state: input.primaryResearchCount >= 3 ? "pass" : input.primaryResearchCount > 0 ? "warn" : "fail",
    detail:
      input.primaryResearchCount === 0
        ? "No user-provided interviews or channel checks are recorded. Only a channel-check plan exists, and conclusions rest on public data alone."
        : `${input.primaryResearchCount} user-provided primary research record(s). These are unverified unless you attach a document reference.`,
  });

  const unverifiedClaims = evidence.filter((e) => e.source.sourceType === "sec-filing" && e.status !== "verified");
  checks.push({
    id: "filing-claims",
    label: "Business-description claims verified",
    state: unverifiedClaims.length === 0 ? "pass" : "warn",
    detail:
      unverifiedClaims.length === 0
        ? "Every value-chain and business-model claim matched a sentence in the latest 10-K."
        : `${unverifiedClaims.length} claim(s) could not be matched to the latest 10-K text.`,
  });

  checks.push({
    id: "open-questions",
    label: "Unanswered research questions",
    state: config.openQuestions.length === 0 ? "pass" : "warn",
    detail: `${config.openQuestions.length} open questions and ${config.missingData.length} unconnected data sources are listed. Each one limits how far the conclusions reach.`,
  });

  const licences = kpis.filter((k) => !k.source.licence && !k.source.id.startsWith("DERIVED"));
  checks.push({
    id: "licensing",
    label: "Data licensing recorded",
    state: licences.length === 0 ? "pass" : "warn",
    detail: licences.length === 0 ? "Every series records its FRED licence label; copyrighted series are cited where they are shown." : `Missing licence label: ${licences.map((k) => k.kpi.id).join(", ")}.`,
  });

  return checks;
}

/**
 * Memo status from the checks:
 *   evidence-backed               no failed checks, primary research present, every hypothesis decided
 *   draft-incomplete-verification public evidence tests every hypothesis but something fails (e.g. no primary research)
 *   exploratory                   anything less
 */
export function classifyMemo(checks: QualityCheck[], hypotheses: HypothesisView[]): MemoStatus {
  const failed = checks.filter((c) => c.state === "fail").map((c) => c.id);
  const allDecided = hypotheses.every((h) => h.overall !== "insufficient-data");
  if (failed.length === 0 && allDecided) return "evidence-backed";
  const coreOk = !failed.includes("evidence-coverage") && !failed.includes("testability") && !failed.includes("source-quality");
  return coreOk && hypotheses.some((h) => h.overall !== "insufficient-data") ? "draft-incomplete-verification" : "exploratory";
}

export const MEMO_STATUS_LABEL: Record<MemoStatus, string> = {
  exploratory: "Exploratory research note",
  "draft-incomplete-verification": "Research draft — incomplete verification",
  "evidence-backed": "Evidence-backed research report",
};
