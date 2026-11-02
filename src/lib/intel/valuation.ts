/**
 * Valuation math. Pure functions over prices + point-in-time fundamentals.
 *
 * Multiples are computed from market capitalisation (raw price × shares
 * outstanding as of the latest filing known on that date), never from a
 * vendor's precomputed ratio, so every input is inspectable. A historical
 * multiple at date D uses only fundamentals filed on or before D.
 */

export interface SplitEvent {
  date: string;
  numerator: number;
  denominator: number;
}

/**
 * Yahoo OHLC is split-adjusted. Reconstruct the price that actually traded on
 * `date` by undoing every split that happened after it.
 */
export function splitFactorAfter(date: string, splits: SplitEvent[]): number {
  return splits
    .filter((s) => s.date > date && s.denominator > 0)
    .reduce((factor, s) => factor * (s.numerator / s.denominator), 1);
}

export function rawPrice(splitAdjustedClose: number, date: string, splits: SplitEvent[]): number {
  return splitAdjustedClose * splitFactorAfter(date, splits);
}

/** Shares reported as of `sharesDate`, restated to the share basis on `date` (splits in between). */
export function sharesOnDate(shares: number, sharesDate: string, date: string, splits: SplitEvent[]): number {
  const factor = splits
    .filter((s) => s.date > sharesDate && s.date <= date && s.denominator > 0)
    .reduce((f, s) => f * (s.numerator / s.denominator), 1);
  return shares * factor;
}

export interface MultipleInputs {
  marketCap: number;
  debt: number | null;
  cash: number | null;
  ttmRevenue: number | null;
  ttmEbitda: number | null;
  ttmNetIncome: number | null;
  ttmFcf: number | null;
  equity: number | null;
}

export interface Multiples {
  marketCap: number;
  enterpriseValue: number | null;
  pe: number | null;
  evToEbitda: number | null;
  evToSales: number | null;
  fcfYield: number | null;
  priceToBook: number | null;
}

/** Positive-denominator multiples only. A negative-earnings P/E is "not meaningful", not cheap. */
export function computeMultiples(input: MultipleInputs): Multiples {
  const ev = input.debt !== null && input.cash !== null ? input.marketCap + input.debt - input.cash : null;
  const ratio = (num: number | null, den: number | null) => (num === null || den === null || den <= 0 ? null : num / den);
  return {
    marketCap: input.marketCap,
    enterpriseValue: ev,
    pe: ratio(input.marketCap, input.ttmNetIncome),
    evToEbitda: ratio(ev, input.ttmEbitda),
    evToSales: ratio(ev, input.ttmRevenue),
    fcfYield: input.ttmFcf === null || input.marketCap <= 0 ? null : input.ttmFcf / input.marketCap,
    priceToBook: ratio(input.marketCap, input.equity),
  };
}

export interface DistributionStats {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function distribution(values: Array<number | null>): DistributionStats | null {
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length < 4) return null;
  return {
    n: clean.length,
    min: clean[0],
    p25: quantile(clean, 0.25),
    median: quantile(clean, 0.5),
    p75: quantile(clean, 0.75),
    max: clean[clean.length - 1],
  };
}

/** Share of historical observations at or below `value` (0–1). */
export function percentileOf(values: Array<number | null>, value: number): number | null {
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (clean.length === 0) return null;
  return clean.filter((v) => v <= value).length / clean.length;
}

// ── Scenario valuation ─────────────────────────────────────────────────────

export interface ScenarioInputs {
  ttmRevenue: number;
  /** D&A as a share of revenue (held at the TTM ratio). */
  daToRevenue: number;
  netDebt: number;
  shares: number;
  price: number;
  revenueGrowth: number;
  operatingMargin: number;
  evToEbitda: number;
}

export interface ScenarioValue {
  revenue: number;
  ebitda: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number | null;
  impliedReturn: number | null;
}

/** Next-twelve-month EBITDA × multiple, bridged to equity with the latest net debt. */
export function valueScenario(input: ScenarioInputs): ScenarioValue {
  const revenue = input.ttmRevenue * (1 + input.revenueGrowth);
  const ebitda = revenue * (input.operatingMargin + input.daToRevenue);
  const enterpriseValue = ebitda * input.evToEbitda;
  const equityValue = enterpriseValue - input.netDebt;
  const perShare = input.shares > 0 && equityValue > 0 ? equityValue / input.shares : null;
  return {
    revenue,
    ebitda,
    enterpriseValue,
    equityValue,
    perShare,
    impliedReturn: perShare === null || input.price <= 0 ? null : perShare / input.price - 1,
  };
}

/** Grid of implied per-share value across operating margins (rows) × EV/EBITDA multiples (cols). */
export function sensitivityGrid(
  base: Omit<ScenarioInputs, "operatingMargin" | "evToEbitda">,
  margins: number[],
  multiples: number[],
): Array<Array<number | null>> {
  return margins.map((operatingMargin) =>
    multiples.map((evToEbitda) => valueScenario({ ...base, operatingMargin, evToEbitda }).perShare),
  );
}

export interface ProbabilityWeighting {
  /** Null unless probabilities are complete (sum to 1 within 0.5%) and every case has a value. */
  expectedReturn: number | null;
  probabilitySum: number;
  complete: boolean;
}

/** Probability-weighted return — only when the user has supplied a full, justified distribution. */
export function weightScenarios(
  cases: Array<{ impliedReturn: number | null; probability: number | null | undefined }>,
): ProbabilityWeighting {
  const probabilitySum = cases.reduce((s, c) => s + (c.probability ?? 0), 0);
  const complete =
    cases.every((c) => typeof c.probability === "number" && c.probability >= 0 && c.impliedReturn !== null) &&
    Math.abs(probabilitySum - 1) <= 0.005;
  const expectedReturn = complete
    ? cases.reduce((s, c) => s + (c.probability as number) * (c.impliedReturn as number), 0)
    : null;
  return { expectedReturn, probabilitySum, complete };
}

// ── Discounted cash flow (FCFF) ─────────────────────────────────────────────

export interface DcfInputs {
  baseRevenue: number;
  /** Year-1 revenue growth; fades linearly to terminal growth by the final explicit year. */
  initialGrowth: number;
  terminalGrowth: number;
  years: number;
  ebitMargin: number;
  taxRate: number;
  /** Net reinvestment (capex − D&A + Δworking capital) as a share of revenue. */
  reinvestmentRate: number;
  wacc: number;
  netDebt: number;
  shares: number;
}

export interface DcfResult {
  projections: Array<{ year: number; revenue: number; ebit: number; nopat: number; reinvestment: number; fcff: number; discountFactor: number; pv: number }>;
  pvExplicit: number;
  terminalValue: number;
  pvTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number | null;
  terminalShare: number;
  warnings: string[];
}

export function discountedCashFlow(input: DcfInputs): DcfResult {
  const warnings: string[] = [];
  if (input.wacc <= input.terminalGrowth) {
    warnings.push("WACC must exceed terminal growth; terminal value is undefined.");
  }
  const years = Math.max(1, Math.min(15, Math.round(input.years)));
  const projections: DcfResult["projections"] = [];
  let revenue = input.baseRevenue;
  for (let year = 1; year <= years; year += 1) {
    const growth = years === 1 ? input.initialGrowth : input.initialGrowth + ((input.terminalGrowth - input.initialGrowth) * (year - 1)) / (years - 1);
    revenue *= 1 + growth;
    const ebit = revenue * input.ebitMargin;
    const nopat = ebit * (1 - input.taxRate);
    const reinvestment = revenue * input.reinvestmentRate;
    const fcff = nopat - reinvestment;
    const discountFactor = 1 / (1 + input.wacc) ** year;
    projections.push({ year, revenue, ebit, nopat, reinvestment, fcff, discountFactor, pv: fcff * discountFactor });
  }
  const pvExplicit = projections.reduce((s, p) => s + p.pv, 0);
  const last = projections[projections.length - 1];
  const terminalValue =
    input.wacc > input.terminalGrowth ? (last.fcff * (1 + input.terminalGrowth)) / (input.wacc - input.terminalGrowth) : Number.NaN;
  const pvTerminal = terminalValue * last.discountFactor;
  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = enterpriseValue - input.netDebt;
  const terminalShare = enterpriseValue > 0 ? pvTerminal / enterpriseValue : Number.NaN;
  if (terminalShare > 0.75) warnings.push("Terminal value is more than 75% of enterprise value; the result is dominated by long-run assumptions.");
  if (last.fcff <= 0) warnings.push("Final-year free cash flow is non-positive; a perpetuity on it is not meaningful.");
  return {
    projections,
    pvExplicit,
    terminalValue,
    pvTerminal,
    enterpriseValue,
    equityValue,
    perShare: input.shares > 0 && Number.isFinite(equityValue) && equityValue > 0 ? equityValue / input.shares : null,
    terminalShare,
    warnings,
  };
}
