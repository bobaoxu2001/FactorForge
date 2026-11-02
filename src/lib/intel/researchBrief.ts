import type { CompanyView } from "./companies";
import type { ResearchProjectView } from "./project";

export interface BriefObservation {
  label: string;
  finding: string;
  interpretation: string;
  evidenceIds: string[];
}

const pct = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const pp = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}pp`;

/** A short reading path, grounded in the same evidence used by the full memo. */
export function buildResearchBrief(view: ResearchProjectView) {
  const known = new Set(view.evidence.map((item) => item.id));
  const cite = (ids: string[]) => ids.filter((id) => known.has(id));
  const volume = ["truck-tonnage", "cass-shipments", "freight-tsi"]
    .map((id) => view.kpis.find((item) => item.kpi.id === id))
    .filter((item): item is NonNullable<typeof item> => item?.latest?.yoy != null && known.has(`EV-KPI-${item.kpi.id}`));
  const fuel = view.residuals.find((item) => item.kpiId === "ppi-truckload");
  const focus = view.companies.filter((company) => company.coverage.focus && company.latest?.operatingMarginYoYChange != null && known.has(`EV-${company.ticker}-OM`));
  const h1 = view.hypotheses.find((item) => item.id === "H1");
  const h2 = view.hypotheses.find((item) => item.id === "H2");
  const observations: BriefObservation[] = [];

  if (volume.length) {
    observations.push({
      label: "01 · Demand",
      finding: volume.map((item) => `${item.kpi.name} ${pct(item.latest!.yoy!)} YoY (${item.latest!.date.slice(0, 7)})`).join("; ") + ".",
      interpretation: "Read shipment activity separately from nominal spending. These series cover different periods and segments; they are not a single contemporaneous demand measure.",
      evidenceIds: cite(volume.map((item) => `EV-KPI-${item.kpi.id}`)),
    });
  }
  if (fuel?.latest && known.has("EV-CALC-ppi-truckload-FUEL")) {
    observations.push({
      label: "02 · Pricing",
      finding: `Truckload PPI ${pct(fuel.latest.actual)} YoY; residual ${pp(fuel.latest.residual)} relative to its historical diesel relationship (${fuel.latest.date.slice(0, 7)}).`,
      interpretation: `The residual is a statistical comparison, not a direct measure of ex-fuel rates or a causal fuel decomposition.${fuel.extrapolation ? " Diesel is outside the training range, making this estimate especially uncertain." : " Direct ex-fuel rate evidence is still needed."}`,
      evidenceIds: ["EV-CALC-ppi-truckload-FUEL"],
    });
  }
  if (focus.length) {
    observations.push({
      label: "03 · Company conversion",
      finding: focus.map((company) => `${company.ticker} operating-margin change ${pp(company.latest!.operatingMarginYoYChange!)} YoY (${company.latest!.label})`).join("; ") + ".",
      interpretation: "Check whether revenue growth converts into profit. Mix, acquisitions and cost timing are rival explanations; consolidated results alone do not identify pricing power.",
      evidenceIds: cite(focus.map((company) => `EV-${company.ticker}-OM`)),
    });
  }

  return {
    conclusion: h1?.overall === "supports" && h2?.overall === "supports"
      ? "Volume and pricing indicators are improving; the mechanism still needs testing."
      : observations.length ? "A demand-led freight recovery is not yet established." : "More public evidence is needed before forming a recovery view.",
    framing: "Working hypothesis: separate shipment demand, fuel-sensitive headline prices and company-level profit conversion before drawing an investment conclusion.",
    observations,
    nextChecks: [
      { question: "Is pricing improving beyond fuel?", test: "Compare ex-fuel contract and spot rates with shipment counts over the same period. A sustained rise in both would strengthen the recovery case." },
      { question: "Is the margin change operational?", test: "Reconcile segment volumes, yield, mix and fuel-surcharge timing from earnings releases. Recheck peers on a common quarter before attributing differences to business models." },
      { question: "What does the price already assume?", test: "Compare current valuation with explicit margin and growth scenarios. Relative stock returns and historical multiples alone cannot reveal market expectations." },
    ],
  };
}

export function buildCompanyBrief(company: CompanyView, view: ResearchProjectView): BriefObservation[] {
  const known = new Set(view.evidence.map((item) => item.id));
  const row = company.latest;
  const observations: BriefObservation[] = [];
  if (row?.revenueYoY != null && row.operatingMargin != null && row.operatingMarginYoYChange != null && known.has(`EV-${company.ticker}-REV`) && known.has(`EV-${company.ticker}-OM`)) {
    observations.push({
      label: "Observed · reported results",
      finding: `${row.label}: revenue ${pct(row.revenueYoY)} YoY; operating margin ${(row.operatingMargin * 100).toFixed(1)}%, a ${pp(row.operatingMarginYoYChange)} YoY change.`,
      interpretation: "These are consolidated outcomes. They do not isolate volume, ex-fuel price, acquisitions or business mix.",
      evidenceIds: [`EV-${company.ticker}-REV`, `EV-${company.ticker}-OM`],
    });
  }
  if (company.valuation && known.has(`EV-${company.ticker}-VAL`)) {
    const multiple = company.valuation.current.evToEbitda;
    if (multiple != null) observations.push({
      label: "Interpretation · valuation context",
      finding: `${multiple.toFixed(1)}× trailing EV/EBITDA at ${company.valuation.asOf}; fundamentals through ${company.valuation.fundamentalsThrough}.`,
      interpretation: "Use this as a scenario anchor. A trailing multiple does not establish fair value or tell us which recovery is already priced in.",
      evidenceIds: [`EV-${company.ticker}-VAL`],
    });
  }
  return observations;
}
