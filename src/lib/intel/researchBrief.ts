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
  const linehaul = view.kpis.find((item) => item.kpi.id === "cass-linehaul")?.latest;
  const peer = view.hypotheses.find((item) => item.id === "H5")?.tests.find((item) => item.sensitivity);
  const observations: BriefObservation[] = [];

  if (volume.length) {
    observations.push({
      label: "01 · Demand",
      finding: volume.map((item) => `${item.kpi.name} ${pct(item.latest!.yoy!)} YoY (${item.latest!.date.slice(0, 7)})`).join("; ") + ".",
      interpretation: "Read shipment activity separately from nominal spending. These series cover different periods and segments; they are not a single contemporaneous demand measure.",
      evidenceIds: cite(volume.map((item) => `EV-KPI-${item.kpi.id}`)),
    });
  }
  if (linehaul?.yoy != null && known.has("EV-KPI-cass-linehaul")) {
    observations.push({
      label: "02 · Pricing",
      finding: `Cass ex-fuel linehaul ${linehaul.value.toFixed(1)}, ${pct(linehaul.yoy)} YoY${linehaul.change != null ? ` and ${pct(linehaul.change)} MoM` : ""} (${linehaul.date.slice(0, 7)}).${fuel?.latest && known.has("EV-CALC-ppi-truckload-FUEL") ? ` Truckload PPI ${pct(fuel.latest.actual)} YoY; diesel-model residual ${pp(fuel.latest.residual)} (${fuel.latest.date.slice(0, 7)}).` : ""}`,
      interpretation: "Direct ex-fuel rate growth and a negative model residual can coexist: the residual is deviation from a historical fit, not observed rate growth. Cass blends spot/contract dry-van invoices by processing month; demand versus capacity effects remain unresolved.",
      evidenceIds: cite(["EV-KPI-cass-linehaul", "EV-CALC-ppi-truckload-FUEL"]),
    });
  }
  if (peer?.sensitivity && peer.evidenceIds.every((id) => known.has(id))) {
    const stats = peer.sensitivity;
    const withoutWerner = stats.leaveOneOut.find((item) => item.omitted === "WERN");
    observations.push({
      label: "03 · Company conversion",
      finding: `${peer.period} GAAP margin changes: ${stats.groupA.members.map((r) => `${r.ticker} ${pp(r.value)}`).join(", ")}. Mean ${pp(stats.groupA.mean)}, median ${pp(stats.groupA.median)}${withoutWerner ? `; mean excluding WERN ${pp(withoutWerner.meanA)}` : ""}.`,
      interpretation: `The negative mean is WERN-sensitive, so operating leverage is mixed.${known.has("EV-WERN-Q2-RECONCILIATION") ? " Werner's adjusted margin rose 0.8pp; its release identifies prior-year liability reversals. Retain all peers and GAAP inputs; review adjusted definitions and segment mix separately." : " Review company-specific adjustments and segment mix before attributing a mechanism."}`,
      evidenceIds: cite([...peer.evidenceIds, "EV-WERN-Q2-RECONCILIATION"]),
    });
  }

  return {
    conclusion: linehaul?.yoy != null && linehaul.yoy > 0 && known.has("EV-KPI-cass-linehaul")
      ? "Ex-fuel rates have improved; a broad, demand-led freight recovery remains unconfirmed."
      : observations.length ? "A demand-led freight recovery is not yet established." : "More public evidence is needed before forming a recovery view.",
    framing: "Working hypothesis: separate shipment demand, fuel-sensitive headline prices and company-level profit conversion before drawing an investment conclusion.",
    observations,
    nextChecks: [
      { question: "Will direct rate gains persist?", test: "Track Cass linehaul alongside matched spot/contract rates and shipment counts over further releases, separating demand growth from capacity contraction." },
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
