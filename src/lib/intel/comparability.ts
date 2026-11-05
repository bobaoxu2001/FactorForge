import type { CompanyView, QuarterRow } from "./companies";
import { quarterLabel } from "./financials";

export type QuarterComparisonMetric = "operatingMarginYoYChange" | "fuelShareYoYChange" | "revenueYoY";

export function isQuarterComparisonMetric(metric: string): metric is QuarterComparisonMetric {
  return metric === "operatingMarginYoYChange" || metric === "fuelShareYoYChange" || metric === "revenueYoY";
}

export function quarterEvidenceId(ticker: string, metric: "REV" | "OM" | "FUEL", end: string): string {
  return `EV-${ticker}-${metric}-${end}`;
}

export interface CommonQuarter {
  label: string;
  rows: Array<{ company: CompanyView; row: QuarterRow }>;
}

function periodNumber(end: string): number {
  const [, quarter, year] = quarterLabel(end).match(/^Q(\d) (\d{4})$/)!;
  return Number(year) * 4 + Number(quarter) - 1;
}

/**
 * All requested companies must have usable values in the same calendar quarter.
 * A 14-day end-date tolerance accommodates the covered 52/53-week filers without
 * allowing differently timed fiscal quarters to masquerade as matched periods.
 */
export function findCommonQuarter(
  companies: Array<CompanyView | undefined>,
  metrics: QuarterComparisonMetric[] = ["revenueYoY", "operatingMarginYoYChange"],
): CommonQuarter | null {
  if (!companies.length || companies.some((company) => !company)) return null;
  const available = (companies as CompanyView[]).map((company) => {
    const periods = new Map<number, QuarterRow>();
    for (const row of company.quarters) {
      if (metrics.every((metric) => row[metric] !== null && Number.isFinite(row[metric]))) {
        const period = periodNumber(row.end);
        const previous = periods.get(period);
        if (!previous || row.end > previous.end) periods.set(period, row);
      }
    }
    return { company, periods };
  });
  const common = [...available[0].periods.keys()]
    .filter((period) => available.every(({ periods }) => periods.has(period)))
    .sort((a, b) => b - a);
  for (const period of common) {
    const rows = available.map(({ company, periods }) => ({ company, row: periods.get(period)! }));
    const ends = rows.map(({ row }) => Date.parse(`${row.end}T00:00:00Z`));
    if (Math.max(...ends) - Math.min(...ends) <= 14 * 86_400_000) {
      return { label: `Q${period % 4 + 1} ${Math.floor(period / 4)}`, rows };
    }
  }
  return null;
}
