import type { ResearchProjectConfig } from "@/data/research/types";
import { pct } from "@/lib/utils/format";
import { ordinal, type CompanyView, type QuarterRow } from "./companies";
import { findCommonQuarter, isQuarterComparisonMetric, quarterEvidenceId } from "./comparability";
import type { FuelResidualAnalysis } from "./kpis";
import { trailingAverageYoy } from "./series";
import type { Evidence, EvidenceOrigin, KpiSeriesView, SourceRef, VerificationStatus } from "./types";

/**
 * The evidence registry. Every item is derived from a retrieved source:
 *   EV-KPI-<kpi>            latest reading of a FRED-hosted series
 *   EV-KPI-<kpi>-3M         3-month average YoY (trend)
 *   EV-CALC-<kpi>-FUEL      fuel-adjusted residual (statistical decomposition)
 *   EV-<TICKER>-<metric>    a reported XBRL fact for the latest quarter
 *   EV-<TICKER>-VAL / -RET  valuation percentile / relative return (calculations)
 *   EV-10K-<claim>          a sentence from the latest 10-K
 * Nothing here is typed in by hand except the wording of excerpt claims, and
 * those are verified only when their sentence is found in the filing.
 */

const monthLabel = (date: string) =>
  new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const fmtValue = (value: number, units: string) => {
  if (/dollars per gallon/i.test(units)) return `$${value.toFixed(3)}/gal`;
  if (Math.abs(value) >= 10_000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(3);
};

export const pp = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}pp`;

function kpiStatus(view: KpiSeriesView): VerificationStatus {
  return view.freshness === "stale" ? "stale" : "verified";
}

function kpiEvidence(projectId: string, view: KpiSeriesView): Evidence[] {
  const latest = view.latest;
  if (!latest || view.source.excluded) return [];
  const isCass = view.source.sourceAgency?.includes("Cass") ?? false;
  const derived = view.source.id.startsWith("DERIVED:");
  const base = {
    projectId,
    subject: view.kpi.name,
    source: view.source as SourceRef,
    origin: "public-secondary" as EvidenceOrigin,
    retrievedAt: view.source.retrievedAt,
    publishedAt: view.source.sourceUpdated ?? undefined,
    kpiIds: [view.kpi.id],
    tickers: [] as string[],
    hypothesisIds: [] as string[],
    stance: {},
  };
  const confidence = derived || isCass ? ("medium" as const) : ("high" as const);
  const confidenceRationale = derived
    ? "Derived ratio of two published indices; mix changes can move it without a price change."
    : isCass
      ? "Transaction data from one provider's client base (not the whole market), not seasonally adjusted."
      : `Official statistic (${view.source.sourceAgency}); ${view.kpi.seasonalAdjustment === "SA" ? "seasonally adjusted" : "not seasonally adjusted"}, subject to revision.`;
  const period = view.kpi.frequency === "weekly" ? `week ending ${latest.date}` : monthLabel(latest.date);
  const items: Evidence[] = [
    {
      ...base,
      id: `EV-KPI-${view.kpi.id}`,
      claim: `${view.kpi.name} was ${fmtValue(latest.value, view.kpi.units)} (${view.kpi.units}) for ${period}${latest.yoy !== null ? `, ${pct(latest.yoy)} year over year` : ""}.`,
      excerpt: latest.anomaly && latest.zScore !== null ? `YoY change is ${latest.zScore.toFixed(1)} standard deviations from its trailing 3-year history (flagged anomaly).` : undefined,
      location: `${view.source.seriesId}, observation ${latest.date}`,
      status: kpiStatus(view),
      confidence,
      confidenceRationale,
      observationPeriod: { end: latest.date },
    },
  ];
  const avg3 = trailingAverageYoy(view.readings, 3);
  if (avg3 !== null && view.kpi.frequency !== "weekly") {
    const first = view.readings[view.readings.length - 3];
    items.push({
      ...base,
      id: `EV-KPI-${view.kpi.id}-3M`,
      claim: `${view.kpi.name} averaged ${pct(avg3)} year over year over the three months to ${monthLabel(latest.date)}.`,
      location: `${view.source.seriesId}, observations ${first.date} – ${latest.date}`,
      status: kpiStatus(view),
      confidence,
      confidenceRationale,
      observationPeriod: { start: first.date, end: latest.date },
    });
  }
  return items;
}

function residualEvidence(projectId: string, view: KpiSeriesView, analysis: FuelResidualAnalysis): Evidence | null {
  const latest = analysis.latest;
  if (!latest) return null;
  return {
    id: `EV-CALC-${view.kpi.id}-FUEL`,
    projectId,
    subject: `${view.kpi.name}: fuel-adjusted`,
    claim: `${view.kpi.name} YoY was ${pct(latest.actual)} in ${monthLabel(latest.date)} versus ${pct(latest.fitted)} implied by its historical diesel sensitivity, a residual of ${pp(latest.residual)}.`,
    excerpt: `Fit: YoY = ${(analysis.fit.intercept * 100).toFixed(1)}% + ${analysis.fit.slope.toFixed(2)} × diesel YoY; R² ${analysis.fit.rSquared.toFixed(2)}, n=${analysis.fit.n}. ${analysis.extrapolation ? "Recent diesel YoY lies outside the training range, so this is an extrapolation." : ""}`.trim(),
    location: `Calculation on ${view.source.seriesId} and GASDESW (out-of-sample after ${analysis.trainingEnd.slice(0, 7)})`,
    source: { ...(view.source as SourceRef), id: `CALC:${view.kpi.id}-fuel`, title: `Fuel-adjusted residual: ${view.kpi.name}`, publisher: "FactorForge calculation on FRED-hosted data" },
    origin: "public-secondary",
    status: "partially-verified",
    confidence: analysis.extrapolation ? "low" : "medium",
    confidenceRationale: "Statistical decomposition; depends on model choice and a stable historical fuel sensitivity. Inputs are verified public series.",
    observationPeriod: { end: latest.date },
    retrievedAt: view.source.retrievedAt,
    kpiIds: [view.kpi.id, analysis.fuelKpiId],
    tickers: [],
    hypothesisIds: [],
    stance: {},
  };
}

function filingSource(company: CompanyView, accession: string, filed: string): SourceRef {
  const filing = company.filings.find((f) => f.accession === accession);
  return {
    id: `SEC:${accession}`,
    title: filing ? `${company.name} ${filing.form} (filed ${filing.filed})` : `${company.name} XBRL company facts`,
    publisher: "U.S. Securities and Exchange Commission (EDGAR)",
    url: filing?.url ?? company.sources.companyFacts,
    sourceType: "sec-xbrl",
    retrievedAt: company.retrievedAt,
    publishedAt: filed,
  };
}

function companyEvidence(projectId: string, company: CompanyView, row: QuarterRow | null = company.latest, dated = false): Evidence[] {
  if (!row) return [];
  const revenueQ = company.metrics.revenue.quarters.find((q) => q.end === row.end);
  if (!revenueQ) return [];
  const source = filingSource(company, revenueQ.accession, revenueQ.filed);
  const id = (metric: "REV" | "OM" | "FUEL") => dated ? quarterEvidenceId(company.ticker, metric, row.end) : `EV-${company.ticker}-${metric}`;
  const base = {
    projectId,
    source,
    origin: "public-secondary" as EvidenceOrigin,
    retrievedAt: company.retrievedAt,
    publishedAt: revenueQ.filed,
    kpiIds: [] as string[],
    tickers: [company.ticker],
    hypothesisIds: [] as string[],
    stance: {},
    observationPeriod: { start: revenueQ.start ?? undefined, end: row.end },
  };
  const derivationNote = (key: string) => {
    const d = row.derivations[key as keyof QuarterRow["derivations"]];
    return d && d !== "reported-3m" ? ` Quarter value derived (${d}).` : "";
  };
  const items: Evidence[] = [];
  if (row.revenueYoY !== null && row.revenue !== null) {
    items.push({
      ...base,
      id: id("REV"),
      subject: `${company.ticker} revenue`,
      claim: `${company.name} reported ${row.label} revenue of $${(row.revenue / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M, ${pct(row.revenueYoY)} year over year.`,
      location: `XBRL us-gaap:${company.metrics.revenue.concept}, accession ${revenueQ.accession}.${derivationNote("revenue")}`,
      status: row.revised ? "partially-verified" : "verified",
      confidence: "high",
      confidenceRationale: row.revised ? "Reported figure later revised in a subsequent filing." : "Company-reported, as first filed with the SEC.",
    });
  }
  if (row.operatingMargin !== null && row.operatingMarginYoYChange !== null) {
    items.push({
      ...base,
      id: id("OM"),
      subject: `${company.ticker} operating margin`,
      claim: `${company.name}'s ${row.label} operating margin was ${(row.operatingMargin * 100).toFixed(1)}% (operating ratio ${((row.operatingRatio ?? 0) * 100).toFixed(1)}%), ${pp(row.operatingMarginYoYChange)} versus a year earlier.`,
      location: `Calculation: us-gaap:OperatingIncomeLoss ÷ us-gaap:${company.metrics.revenue.concept}, accession ${revenueQ.accession}.${derivationNote("operatingIncome")}`,
      status: "verified",
      confidence: "high",
      confidenceRationale: "Arithmetic on company-reported GAAP figures.",
    });
  }
  if (row.fuelShare !== null && row.fuelShareYoYChange !== null) {
    items.push({
      ...base,
      id: id("FUEL"),
      subject: `${company.ticker} fuel cost share`,
      claim: `Fuel expense was ${(row.fuelShare * 100).toFixed(1)}% of ${company.name}'s ${row.label} revenue, ${pp(row.fuelShareYoYChange)} year over year.`,
      location: `Calculation: us-gaap:FuelCosts ÷ revenue, accession ${revenueQ.accession}.${derivationNote("fuelExpense")}`,
      status: "verified",
      confidence: "high",
      confidenceRationale: "Arithmetic on company-reported GAAP figures.",
    });
  }
  // A dated financial observation must never inherit today's valuation or return.
  if (dated) return items;
  const val = company.valuation;
  if (val && val.current.evToEbitda !== null && val.percentiles.evToEbitda !== null && val.stats.evToEbitda) {
    items.push({
      ...base,
      id: `EV-${company.ticker}-VAL`,
      subject: `${company.ticker} valuation`,
      claim: `${company.ticker} trades at ${val.current.evToEbitda.toFixed(1)}× TTM EV/EBITDA (fundamentals through ${val.fundamentalsThrough}), the ${ordinal(val.percentiles.evToEbitda * 100)} percentile of its ${val.stats.evToEbitda.n}-month point-in-time history (median ${val.stats.evToEbitda.median.toFixed(1)}×).`,
      location: `Calculation: price ${val.asOf} × ${val.sharesSource === "cover-page" ? "cover-page" : "weighted diluted"} shares (${val.sharesAsOf}) + debt − cash; TTM from XBRL.`,
      source: { ...source, id: `CALC:${company.ticker}-valuation`, title: `${company.ticker} point-in-time valuation`, publisher: "FactorForge calculation on SEC XBRL + Yahoo prices", sourceType: "market-data" },
      status: "partially-verified",
      confidence: "medium",
      confidenceRationale: "Debt is assembled from tagged components and may omit items (shown on the company page); prices are from Yahoo Finance.",
      observationPeriod: { end: val.asOf },
      publishedAt: val.asOf,
    });
  }
  const ps = company.priceStats;
  if (ps && ps.relativeReturn6m !== null && ps.return6m !== null) {
    items.push({
      ...base,
      id: `EV-${company.ticker}-RET`,
      subject: `${company.ticker} price performance`,
      claim: `${company.ticker} returned ${pct(ps.return6m)} over the six months to ${ps.lastDate} (total return), ${pp(ps.relativeReturn6m)} versus SPY.`,
      location: `Yahoo Finance adjusted close, 126 trading days to ${ps.lastDate}`,
      source: { id: `YAHOO:${company.ticker}`, title: `${company.ticker} daily prices`, publisher: "Yahoo Finance chart API", url: `https://finance.yahoo.com/quote/${company.ticker}/history`, sourceType: "market-data", retrievedAt: company.retrievedAt },
      status: "verified",
      confidence: "high",
      confidenceRationale: "Market prices; dividend-adjusted.",
      observationPeriod: { end: ps.lastDate },
      publishedAt: ps.lastDate,
    });
  }
  return items;
}

export interface ResolvedClaim {
  claimId: string;
  evidenceId: string;
  found: boolean;
}

function excerptEvidence(config: ResearchProjectConfig, companies: CompanyView[]): { items: Evidence[]; resolved: Map<string, ResolvedClaim> } {
  const byTicker = new Map(companies.map((c) => [c.ticker, c]));
  const items: Evidence[] = [];
  const resolved = new Map<string, ResolvedClaim>();
  for (const claim of config.excerptClaims) {
    const company = byTicker.get(claim.ticker);
    const report = company?.annualReport;
    const match = report?.excerpts.find((e) => e.text.includes(claim.contains));
    const id = `EV-10K-${claim.id}`;
    resolved.set(claim.id, { claimId: claim.id, evidenceId: id, found: Boolean(match) });
    items.push({
      id,
      projectId: config.id,
      subject: claim.subject,
      claim: claim.claim,
      excerpt: match?.text,
      location: report ? `${report.form} filed ${report.filed}, ${match?.section ?? "excerpt not found"} (section location approximate)` : "No annual report in snapshot",
      source: {
        id: report ? `SEC:${report.accession}` : `SEC:${claim.ticker}`,
        title: report ? `${company?.name} ${report.form} for fiscal ${report.reportDate?.slice(0, 4) ?? ""}`.trim() : `${claim.ticker} annual report`,
        publisher: "U.S. Securities and Exchange Commission (EDGAR)",
        url: report?.url ?? company?.sources.browse,
        sourceType: "sec-filing",
        retrievedAt: company?.retrievedAt ?? "",
        publishedAt: report?.filed,
      },
      origin: "public-secondary",
      status: match ? "verified" : "unverified",
      confidence: match ? "high" : "low",
      confidenceRationale: match
        ? "Verbatim sentence from the company's own annual report. It states the company's description, which is not independently audited."
        : "The supporting sentence was not found in the latest retrieved 10-K; re-verify before relying on this claim.",
      observationPeriod: report?.reportDate ? { end: report.reportDate } : undefined,
      publishedAt: report?.filed,
      retrievedAt: company?.retrievedAt ?? "",
      kpiIds: [],
      tickers: [claim.ticker],
      hypothesisIds: [],
      stance: {},
    });
  }
  return { items, resolved };
}

export function buildEvidence(
  config: ResearchProjectConfig,
  kpis: KpiSeriesView[],
  residuals: FuelResidualAnalysis[],
  companies: CompanyView[],
): { evidence: Evidence[]; resolvedClaims: Map<string, ResolvedClaim> } {
  const evidence: Evidence[] = [];
  for (const view of kpis) evidence.push(...kpiEvidence(config.id, view));
  for (const analysis of residuals) {
    const view = kpis.find((k) => k.kpi.id === analysis.kpiId);
    const item = view ? residualEvidence(config.id, view, analysis) : null;
    if (item) evidence.push(item);
  }
  for (const company of companies) evidence.push(...companyEvidence(config.id, company));
  // Register the actual periods used in the common-quarter table and peer tests.
  // Latest-period aliases remain available for individual-company research.
  const byTicker = new Map(companies.map((company) => [company.ticker, company]));
  const selections = [findCommonQuarter(companies)];
  for (const hypothesis of config.hypotheses) {
    for (const test of hypothesis.tests) {
      if (test.kind === "company-group-spread") {
        selections.push(findCommonQuarter([...new Set([...test.groupA, ...test.groupB])].map((ticker) => byTicker.get(ticker)), [test.metric]));
      } else if (test.kind === "company-metric" && isQuarterComparisonMetric(test.metric)) {
        selections.push(findCommonQuarter(test.tickers.map((ticker) => byTicker.get(ticker)), [test.metric]));
      }
    }
  }
  const registered = new Set<string>();
  for (const selection of selections) {
    for (const { company, row } of selection?.rows ?? []) {
      const key = `${company.ticker}:${row.end}`;
      if (registered.has(key)) continue;
      registered.add(key);
      evidence.push(...companyEvidence(config.id, company, row, true));
    }
  }
  const { items, resolved } = excerptEvidence(config, companies);
  evidence.push(...items);
  return { evidence, resolvedClaims: resolved };
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Integrity rules for any evidence list, including user-added items:
 *  - IDs are unique
 *  - public-secondary items carry a source URL (no invented or missing citations)
 *  - AI-generated items and hypotheses can never be "verified"
 *  - user-primary items cannot claim "verified" without a document reference
 */
export function validateEvidence(items: Evidence[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) issues.push(`Duplicate evidence id ${item.id}`);
    seen.add(item.id);
    if (item.origin === "public-secondary" && !item.source.url) issues.push(`${item.id}: public evidence without a source URL`);
    if ((item.origin === "ai-generated" || item.origin === "template-generated" || item.origin === "hypothesis") && (item.status === "verified" || item.status === "partially-verified")) {
      issues.push(`${item.id}: ${item.origin} content cannot be marked ${item.status}`);
    }
    if (item.origin === "user-primary" && item.status === "verified" && !item.source.documentRef) {
      issues.push(`${item.id}: user primary research marked verified without a document reference`);
    }
    if (!item.claim.trim()) issues.push(`${item.id}: empty claim`);
  }
  return issues;
}

/** Downgrade an item to "stale" when its observation is older than `maxAgeDays` at `asOf`. */
export function applyStaleness(item: Evidence, asOf: Date, maxAgeDays: number): Evidence {
  const end = item.observationPeriod?.end;
  if (!end || item.status === "contradicted") return item;
  const age = (asOf.getTime() - Date.parse(`${end}T00:00:00Z`)) / 86_400_000;
  return age > maxAgeDays ? { ...item, status: "stale" } : item;
}
