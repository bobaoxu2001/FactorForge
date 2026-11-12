import { describe, expect, it } from "vitest";
import { classifyMemo, runQualityChecks, scenarioCoverage, type QualityInputs } from "./quality";
import type { HypothesisView, QualityCheck } from "./types";
import type { CompanyView } from "./companies";
import { FREIGHT_PROJECT } from "@/data/research/projects/freight";
import type { ScenarioProbability } from "./workspace";

const check = (id: string, state: QualityCheck["state"]): QualityCheck => ({ id, label: id, state, detail: "" });
const hyp = (overall: HypothesisView["overall"]): HypothesisView => ({
  id: "H",
  title: "",
  statement: "",
  stance: "neutral",
  marketNarrative: "",
  tests: [],
  overall,
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [],
  triggers: [],
  missingEvidence: [],
});

describe("classifyMemo", () => {
  it("does not promote a report to verified from a passed interview-count check", () => {
    expect(classifyMemo([check("primary-research", "pass")], [hyp("supports")])).toBe("public-source");
  });
  it("recognizes public-source evidence when fieldwork is missing but core checks pass", () => {
    expect(classifyMemo([check("primary-research", "fail"), check("source-quality", "pass")], [hyp("mixed")])).toBe("public-source");
  });
  it("is exploratory when core evidence is missing", () => {
    expect(classifyMemo([check("testability", "fail")], [hyp("insufficient-data")])).toBe("exploratory");
  });
});

const probabilitySet = (ticker: string, overrides: Partial<ScenarioProbability> = {}): ScenarioProbability => ({
  ticker,
  probabilities: { bull: 0.2, base: 0.5, bear: 0.3 },
  justification: "Research assumptions supported by the documented evidence.",
  updatedAt: "2026-11-12T00:00:00Z",
  ...overrides,
});

describe("scenarioCoverage", () => {
  it("does not count unrelated companies toward the focus-company requirement", () => {
    const coverage = scenarioCoverage(["KNX", "JBHT", "CHRW"], Object.fromEntries(["ODFL", "SNDR", "WERN"].map((ticker) => [ticker, probabilitySet(ticker)])));
    expect(coverage.complete).toEqual([]);
    expect(coverage.missing).toEqual(["KNX", "JBHT", "CHRW"]);
  });

  it("requires a full distribution, finite values, matching ticker and written justification", () => {
    for (const overrides of [
      { probabilities: { bull: 0.1, base: 0.1, bear: 0.1 } },
      { probabilities: { bull: 0.2, base: 0.8, bear: null } },
      { probabilities: { bull: Number.NaN, base: 0.5, bear: 0.5 } },
      { probabilities: { bull: -0.1, base: 0.6, bear: 0.5 } },
      { ticker: "ODFL" },
      { justification: "" },
    ]) {
      expect(scenarioCoverage(["KNX"], { KNX: probabilitySet("KNX", overrides) }).complete).toEqual([]);
    }
    expect(scenarioCoverage(["KNX", "KNX"], { KNX: probabilitySet("KNX") })).toMatchObject({ complete: ["KNX"], missing: [] });
  });
});

const completeCompany = (ticker: string) => ({
  ticker,
  latestTtm: { ttmRevenue: 100, ttmOperatingMargin: 0.1, ttmFreeCashFlow: 10, debt: { total: 0 } },
  valuation: {},
}) as CompanyView;

function financialCheck(companies: CompanyView[]) {
  const input: QualityInputs = { config: FREIGHT_PROJECT, evidence: [], hypotheses: [], kpis: [], companies, primaryResearchCount: 0, scenarioProbabilityCount: 0 };
  return runQualityChecks(input).find((item) => item.id === "financial-model")!;
}

describe("financial-model completeness", () => {
  const allCompanies = () => FREIGHT_PROJECT.companies.map((company) => completeCompany(company.ticker));

  it("warns when a configured company disappears from the assembled data", () => {
    const result = financialCheck(allCompanies().filter((company) => company.ticker !== "KNX"));
    expect(result.state).toBe("warn");
    expect(result.detail).toContain("Missing company data: KNX");
    expect(financialCheck([]).state).toBe("fail");
  });

  it("does not claim margins are complete when TTM operating margin is missing", () => {
    const companies = allCompanies();
    companies[0].latestTtm!.ttmOperatingMargin = null;
    expect(financialCheck(companies)).toMatchObject({ state: "warn", detail: expect.stringContaining("KNX (TTM operating margin)") });
  });

  it("accepts observed zero debt and zero cash flow", () => {
    const companies = allCompanies();
    companies[0].latestTtm!.ttmFreeCashFlow = 0;
    expect(financialCheck(companies).state).toBe("pass");
  });
});
