import type { IndicatorTiming } from "@/lib/intel/types";

/**
 * Industry KPI frameworks — definitions only. Only the freight framework is
 * connected to data (see projects/freight.ts). The others are shown as
 * research templates with "no connected source" so an analyst can see what a
 * project in that industry would need before any number is displayed.
 */

export interface FrameworkKpi {
  name: string;
  definition: string;
  units: string;
  frequency: string;
  timing: IndicatorTiming;
  typicalSources: string[];
  comparability: string;
}

export interface KpiFramework {
  id: string;
  industry: string;
  connectedProjectId: string | null;
  valueDrivers: string[];
  kpis: FrameworkKpi[];
}

export const KPI_FRAMEWORKS: KpiFramework[] = [
  {
    id: "freight",
    industry: "Freight & transportation",
    connectedProjectId: "freight",
    valueDrivers: ["Volume × price per load", "Fuel cost and surcharge lag", "Driver and equipment cost", "Contract vs spot mix", "Network density"],
    kpis: [
      { name: "Freight volumes (tonnage, shipments)", definition: "Physical freight moved per period.", units: "Index / count", frequency: "Monthly", timing: "coincident", typicalSources: ["BTS/ATA tonnage", "Cass Freight Index", "Carrier load counts"], comparability: "Tonnage vs shipment counts weight freight differently." },
      { name: "Spot vs contract rates", definition: "Price per mile or load on spot and contract freight, ex-fuel.", units: "$/mile", frequency: "Weekly", timing: "leading", typicalSources: ["Licensed rate feeds"], comparability: "Ex-fuel vs all-in rates are not comparable." },
      { name: "Operating ratio", definition: "Operating expenses ÷ revenue (1 − operating margin).", units: "%", frequency: "Quarterly", timing: "lagging", typicalSources: ["10-Q/10-K"], comparability: "Some carriers report ex-fuel-surcharge ratios." },
      { name: "Truck utilization", definition: "Miles or revenue per tractor per week.", units: "$ / tractor / week", frequency: "Quarterly", timing: "coincident", typicalSources: ["Earnings releases"], comparability: "Fleet mix (dedicated vs one-way) distorts comparisons." },
    ],
  },
  {
    id: "software",
    industry: "Software (SaaS)",
    connectedProjectId: null,
    valueDrivers: ["New logo acquisition", "Expansion within accounts", "Retention", "Sales efficiency", "Gross margin at scale"],
    kpis: [
      { name: "ARR growth", definition: "Year-over-year growth in annualised recurring revenue.", units: "%", frequency: "Quarterly", timing: "coincident", typicalSources: ["Company disclosures (non-GAAP)"], comparability: "ARR definitions differ across companies." },
      { name: "Net revenue retention", definition: "Revenue from a cohort this year ÷ the same cohort last year, including expansion and churn.", units: "%", frequency: "Quarterly/annual", timing: "leading", typicalSources: ["Company disclosures"], comparability: "Cohort and threshold definitions vary; some disclose only bands." },
      { name: "Gross retention", definition: "Revenue retained excluding expansion.", units: "%", frequency: "Annual", timing: "leading", typicalSources: ["Company disclosures"], comparability: "Rarely disclosed consistently." },
      { name: "Remaining performance obligations", definition: "Contracted revenue not yet recognised (ASC 606).", units: "$", frequency: "Quarterly", timing: "leading", typicalSources: ["10-Q/10-K (XBRL: RevenueRemainingPerformanceObligation)"], comparability: "Contract duration mix changes RPO without demand changes." },
      { name: "Sales efficiency (magic number)", definition: "Δ quarterly revenue × 4 ÷ prior-quarter S&M expense.", units: "×", frequency: "Quarterly", timing: "lagging", typicalSources: ["Derived from filings"], comparability: "Sensitive to S&M classification." },
      { name: "Customer acquisition cost / payback", definition: "S&M per new customer, or months of gross profit to recover it.", units: "$ / months", frequency: "Quarterly", timing: "lagging", typicalSources: ["Company disclosures"], comparability: "Rarely disclosed." },
    ],
  },
  {
    id: "retail",
    industry: "Retail & consumer",
    connectedProjectId: null,
    valueDrivers: ["Traffic × ticket", "Mix and promotions", "Inventory turns", "Store productivity"],
    kpis: [
      { name: "Same-store sales", definition: "Sales growth at stores open over a comparable period.", units: "%", frequency: "Quarterly", timing: "coincident", typicalSources: ["Earnings releases"], comparability: "Comp definitions (e-commerce inclusion, closures) vary." },
      { name: "Transactions & average ticket", definition: "Decomposition of comps into traffic and spend per visit.", units: "% / $", frequency: "Quarterly", timing: "coincident", typicalSources: ["Earnings releases"], comparability: "Not all retailers disclose." },
      { name: "Inventory turnover", definition: "COGS ÷ average inventory.", units: "×", frequency: "Quarterly", timing: "leading", typicalSources: ["10-Q/10-K"], comparability: "LIFO/FIFO differences." },
      { name: "Promotional intensity", definition: "Markdown activity or gross-margin pressure from discounts.", units: "bp", frequency: "Quarterly", timing: "leading", typicalSources: ["Management commentary", "Channel checks"], comparability: "Mostly qualitative." },
      { name: "Gross margin", definition: "Gross profit ÷ revenue.", units: "%", frequency: "Quarterly", timing: "lagging", typicalSources: ["10-Q/10-K"], comparability: "Occupancy/distribution cost classification varies." },
    ],
  },
  {
    id: "healthcare",
    industry: "Healthcare providers & medtech",
    connectedProjectId: null,
    valueDrivers: ["Patient volumes", "Payer mix and reimbursement", "Labor cost", "Procedure mix"],
    kpis: [
      { name: "Patient volumes / admissions", definition: "Admissions, adjusted admissions or visits per period.", units: "count", frequency: "Quarterly", timing: "coincident", typicalSources: ["Earnings releases", "CMS data"], comparability: "Adjusted-admission definitions vary." },
      { name: "Utilization / procedure growth", definition: "Procedures per period, by category.", units: "%", frequency: "Quarterly", timing: "leading", typicalSources: ["Company disclosures", "Claims data (licensed)"], comparability: "Category definitions vary." },
      { name: "Reimbursement rates", definition: "Payment per unit of service by payer.", units: "$", frequency: "Annual (CMS rules)", timing: "leading", typicalSources: ["CMS final rules"], comparability: "Commercial rates are rarely public." },
      { name: "Provider margins", definition: "Operating or EBITDA margin of provider systems.", units: "%", frequency: "Quarterly", timing: "lagging", typicalSources: ["10-Q/10-K"], comparability: "Non-profit systems report differently." },
      { name: "Capital equipment purchasing", definition: "Hospital capex or orders for capital equipment.", units: "$", frequency: "Quarterly", timing: "leading", typicalSources: ["Medtech order disclosures", "Channel checks"], comparability: "Order vs revenue recognition timing." },
    ],
  },
];
