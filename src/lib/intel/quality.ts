import type { ResearchProjectConfig } from "@/data/research/types";
import type { CompanyView } from "./companies";
import type { CheckState, Evidence, HypothesisView, KpiSeriesView, MemoStatus, QualityCheck } from "./types";
import type { ScenarioProbability } from "./workspace";

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

/** Count only required companies with a complete, justified probability distribution. */
export function scenarioCoverage(focusTickers: readonly string[], sets: Record<string, ScenarioProbability>) {
  const required = [...new Set(focusTickers)];
  const complete = required.filter((ticker) => {
    const saved = sets[ticker];
    if (!saved || saved.ticker !== ticker || typeof saved.justification !== "string" || saved.justification.trim().length < 20) return false;
    const probabilities = [saved.probabilities?.bull, saved.probabilities?.base, saved.probabilities?.bear];
    if (!probabilities.every((p): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1)) return false;
    // Same rounding tolerance as the scenario valuation engine.
    return Math.abs(probabilities.reduce((sum, p) => sum + p, 0) - 1) <= 0.005;
  });
  return { required, complete, missing: required.filter((ticker) => !complete.includes(ticker)) };
}

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

  const thin = hypotheses.filter((h) => new Set(h.tests.flatMap((test) => test.evidenceIds)).size < 2);
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

  const companyByTicker = new Map(companies.map((company) => [company.ticker, company]));
  const missingCompanies = config.companies.filter((company) => !companyByTicker.has(company.ticker));
  const incomplete = config.companies.flatMap((coverage) => {
    const company = companyByTicker.get(coverage.ticker);
    if (!company) return [];
    const row = company.latestTtm;
    const missing = [
      !row || !Number.isFinite(row.ttmRevenue) ? "TTM revenue" : null,
      !row || !Number.isFinite(row.ttmOperatingMargin) ? "TTM operating margin" : null,
      !row || !Number.isFinite(row.ttmFreeCashFlow) ? "TTM free cash flow" : null,
      !row?.debt || !Number.isFinite(row.debt.total) ? "debt" : null,
      !company.valuation ? "valuation" : null,
    ].filter(Boolean);
    return missing.length ? [{ ticker: company.ticker, missing }] : [];
  });
  const incompleteCount = missingCompanies.length + incomplete.length;
  checks.push({
    id: "financial-model",
    label: "Financial model completeness",
    state: config.companies.length === 0 ? "warn" : state(incompleteCount === 0, incompleteCount <= 2),
    detail:
      config.companies.length === 0 ? "No company coverage is configured; financial-model completeness has not been assessed." : incompleteCount === 0
        ? "TTM revenue, margins, FCF, debt and valuation are available for every covered company."
        : [missingCompanies.length ? `Missing company data: ${missingCompanies.map((company) => company.ticker).join(", ")}.` : "", incomplete.length ? `Incomplete inputs: ${incomplete.map((company) => `${company.ticker} (${company.missing.join(", ")})`).join("; ")}.` : ""].filter(Boolean).join(" "),
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
    state: "warn",
    detail:
      input.primaryResearchCount === 0
        ? "Primary fieldwork proposed; 0 completed interviews. Public statistics, company disclosures and transparent calculations support this public-source sample; interview validation remains open."
        : `${input.primaryResearchCount} user-provided primary research record(s). Counts do not establish corroboration or verification; review source documentation, coverage and conflicting accounts.`,
  });

  const unverifiedClaims = evidence.filter((e) => e.source.sourceType === "sec-filing" && e.status !== "verified");
  checks.push({
    id: "filing-claims",
    label: "Business-description claims verified",
    state: unverifiedClaims.length === 0 ? "pass" : "warn",
    detail:
      unverifiedClaims.length === 0
        ? "Configured business-description excerpts matched the retrieved filings; the additional Werner reconciliation was checked against its dated company release. Matching does not establish causality."
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
    detail: licences.length === 0 ? "Every series records its source/licence label; copyrighted observations are attributed where shown." : `Missing licence label: ${licences.map((k) => k.kpi.id).join(", ")}.`,
  });

  return checks;
}

/**
 * Public-source evidence has value without fieldwork. Passing screens or an
 * interview count cannot promote a document to a generally verified report.
 */
export function classifyMemo(checks: QualityCheck[], hypotheses: HypothesisView[]): MemoStatus {
  const failed = checks.filter((c) => c.state === "fail").map((c) => c.id);
  const coreOk = !failed.includes("evidence-coverage") && !failed.includes("testability") && !failed.includes("source-quality");
  return coreOk && hypotheses.some((h) => h.overall !== "insufficient-data") ? "public-source" : "exploratory";
}

export const MEMO_STATUS_LABEL: Record<MemoStatus, string> = {
  exploratory: "Exploratory research note",
  "public-source": "Public-source research sample · Primary fieldwork proposed",
  "draft-incomplete-verification": "Research draft — incomplete verification",
  "evidence-backed": "Evidence-backed research report",
};
