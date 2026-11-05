import type { CoverageCompany } from "@/data/research/types";
import { composeDebt, instantAsOf, knownAt, quarterLabel, toMetricSeries, ttm, type DebtComposition, type DebtInputs } from "./financials";
import type { CompanyFixture, ExcerptFixture, FilingFixture, PriceFixture } from "./snapshot";
import type { Derivation, FilingRef, MetricSeries, QuarterValue, ScenarioAssumption, ScenarioResult } from "./types";
import {
  computeMultiples,
  distribution,
  percentileOf,
  rawPrice,
  sharesOnDate,
  valueScenario,
  type DistributionStats,
  type Multiples,
  type ScenarioInputs,
} from "./valuation";

export const FLOW_METRICS = [
  "revenue",
  "operatingIncome",
  "netIncome",
  "pretaxIncome",
  "incomeTax",
  "depreciationAmortization",
  "fuelExpense",
  "interestExpense",
  "operatingCashFlow",
  "capex",
  "equipmentSaleProceeds",
  "dilutedShares",
] as const;
export const BALANCE_METRICS = [
  "cash",
  "totalAssets",
  "equity",
  "debtCombined",
  "longTermDebt",
  "longTermDebtNoncurrent",
  "longTermDebtCurrent",
  "convertibleDebt",
  "financeLease",
  "financeLeaseNoncurrent",
  "shortTermBorrowings",
  "sharesOutstandingCover",
] as const;

type FlowKey = (typeof FLOW_METRICS)[number];
type BalanceKey = (typeof BALANCE_METRICS)[number];
export type MetricKey = FlowKey | BalanceKey;

export interface QuarterRow {
  end: string;
  label: string;
  /** Latest filing date among the values in this row (point-in-time availability). */
  availableFrom: string;
  revenue: number | null;
  revenueYoY: number | null;
  operatingIncome: number | null;
  operatingMargin: number | null;
  operatingMarginYoYChange: number | null;
  operatingRatio: number | null;
  netIncome: number | null;
  ebitda: number | null;
  fuelShare: number | null;
  fuelShareYoYChange: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  derivations: Partial<Record<FlowKey, Derivation>>;
  revised: boolean;
  ttmRevenue: number | null;
  ttmRevenueYoY: number | null;
  ttmOperatingIncome: number | null;
  ttmOperatingMargin: number | null;
  ttmEbitda: number | null;
  ttmNetIncome: number | null;
  ttmFreeCashFlow: number | null;
  ttmOperatingCashFlow: number | null;
  ttmCapex: number | null;
  ttmInterest: number | null;
  ttmTax: number | null;
  ttmPretax: number | null;
  ttmDA: number | null;
  cash: number | null;
  equity: number | null;
  debt: DebtComposition | null;
  dilutedShares: number | null;
}

export interface ValuationPoint {
  date: string;
  fundamentalsThrough: string;
  pe: number | null;
  evToEbitda: number | null;
  evToSales: number | null;
  fcfYield: number | null;
}

export interface ValuationView {
  asOf: string;
  price: number;
  rawPrice: number;
  shares: number;
  sharesAsOf: string;
  /** Cover-page shares outstanding, or weighted diluted shares when the cover count is not tagged (e.g., dual-class filers). */
  sharesSource: "cover-page" | "weighted-diluted";
  fundamentalsThrough: string;
  current: Multiples;
  history: ValuationPoint[];
  stats: { pe: DistributionStats | null; evToEbitda: DistributionStats | null; evToSales: DistributionStats | null; fcfYield: DistributionStats | null };
  percentiles: { pe: number | null; evToEbitda: number | null; evToSales: number | null };
  netDebt: number | null;
}

export interface PriceStats {
  lastDate: string;
  lastClose: number;
  return6m: number | null;
  return1y: number | null;
  marketReturn6m: number | null;
  sectorReturn6m: number | null;
  relativeReturn6m: number | null;
  volatility1y: number | null;
  maxDrawdown1y: number | null;
  avgDollarVolume3m: number | null;
}

export interface CompanyView {
  ticker: string;
  /** Display name from the project config. */
  name: string;
  /** Registrant name as filed with the SEC. */
  legalName: string;
  cik: number;
  sicDescription: string | null;
  fiscalYearEnd: string | null;
  coverage: CoverageCompany;
  sources: CompanyFixture["sources"];
  retrievedAt: string;
  metrics: Record<MetricKey, MetricSeries>;
  quarters: QuarterRow[];
  latest: QuarterRow | null;
  latestTtm: QuarterRow | null;
  valuation: ValuationView | null;
  priceStats: PriceStats | null;
  scenarios: ScenarioAssumption[];
  roicApprox: { value: number; taxRate: number; taxRateSource: "effective" | "statutory" } | null;
  interestCoverage: number | null;
  cashConversion: number | null;
  capexIntensity: number | null;
  shareChangeYoY: number | null;
  filings: FilingRef[];
  earningsReleases: FilingRef[];
  nextEarningsEstimate: { date: string; basis: string } | null;
  annualReport: CompanyFixture["annualReport"];
  excerpts: ExcerptFixture[];
  dataGaps: string[];
}

const ratio = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);
const sub = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
const valueOf = (series: MetricSeries, end: string) => series.quarters.find((q) => q.end === end) ?? null;

function shiftYear(end: string, years: number): string {
  return `${Number(end.slice(0, 4)) + years}${end.slice(4)}`;
}

/** Find the quarter ~one year earlier (tolerates 52/53-week calendars). */
function priorYearEnd(ends: string[], end: string): string | null {
  const target = Date.parse(`${shiftYear(end, -1)}T00:00:00Z`);
  let best: string | null = null;
  for (const e of ends) {
    if (Math.abs(Date.parse(`${e}T00:00:00Z`) - target) <= 10 * 86_400_000) best = e;
  }
  return best;
}

function buildRows(metrics: Record<MetricKey, MetricSeries>): QuarterRow[] {
  const revenue = metrics.revenue;
  const ends = revenue.quarters.map((q) => q.end);
  const debtInputs: DebtInputs = {
    debtCombined: metrics.debtCombined,
    longTermDebt: metrics.longTermDebt,
    longTermDebtNoncurrent: metrics.longTermDebtNoncurrent,
    longTermDebtCurrent: metrics.longTermDebtCurrent,
    convertibleDebt: metrics.convertibleDebt,
    financeLease: metrics.financeLease,
    financeLeaseNoncurrent: metrics.financeLeaseNoncurrent,
    shortTermBorrowings: metrics.shortTermBorrowings,
  };
  const rows: QuarterRow[] = ends.map((end) => {
    const used: QuarterValue[] = [];
    const flow = (key: FlowKey) => {
      const q = valueOf(metrics[key], end);
      if (q) used.push(q);
      return q?.value ?? null;
    };
    const derivations: QuarterRow["derivations"] = {};
    for (const key of FLOW_METRICS) {
      const q = valueOf(metrics[key], end);
      if (q) derivations[key] = q.derivation;
    }
    const rev = flow("revenue");
    const oi = flow("operatingIncome");
    const da = flow("depreciationAmortization");
    const ocf = flow("operatingCashFlow");
    const capex = flow("capex");
    const fuel = flow("fuelExpense");
    const netIncome = flow("netIncome");
    const t = (key: FlowKey) => {
      const quarters = metrics[key].quarters;
      const value = ttm(quarters, end);
      // A TTM value depends on all four filings, not just its final quarter.
      // Derived quarters already carry the latest date of their YTD inputs.
      if (value !== null) {
        const index = quarters.findIndex((q) => q.end === end);
        used.push(...quarters.slice(index - 3, index + 1));
      }
      return value;
    };
    const ttmRevenue = t("revenue");
    const ttmOI = t("operatingIncome");
    const ttmDA = t("depreciationAmortization");
    const ttmOcf = t("operatingCashFlow");
    const ttmCapex = t("capex");
    const ttmNetIncome = t("netIncome");
    const ttmInterest = t("interestExpense");
    const ttmTax = t("incomeTax");
    const ttmPretax = t("pretaxIncome");
    const cashQ = instantAsOf(metrics.cash.quarters, end, 10);
    const equityQ = instantAsOf(metrics.equity.quarters, end, 10);
    if (cashQ) used.push(cashQ);
    if (equityQ) used.push(equityQ);
    const sharesQ = valueOf(metrics.dilutedShares, end);
    if (sharesQ) used.push(sharesQ);
    const debt = composeDebt(debtInputs, end);
    for (const component of debt?.components ?? []) {
      for (const series of Object.values(debtInputs)) {
        if (series.concept !== component.concept) continue;
        const q = valueOf(series, component.asOf);
        if (q) used.push(q);
      }
    }
    return {
      end,
      label: quarterLabel(end),
      availableFrom: used.reduce((max, q) => (q.filed > max ? q.filed : max), "0000-00-00"),
      revenue: rev,
      revenueYoY: null,
      operatingIncome: oi,
      operatingMargin: ratio(oi, rev),
      operatingMarginYoYChange: null,
      operatingRatio: oi !== null && rev ? 1 - oi / rev : null,
      netIncome,
      ebitda: oi !== null && da !== null ? oi + da : null,
      fuelShare: ratio(fuel, rev),
      fuelShareYoYChange: null,
      operatingCashFlow: ocf,
      capex,
      freeCashFlow: sub(ocf, capex),
      derivations,
      revised: used.some((q) => q.revised),
      ttmRevenue,
      ttmRevenueYoY: null,
      ttmOperatingIncome: ttmOI,
      ttmOperatingMargin: ratio(ttmOI, ttmRevenue),
      ttmEbitda: ttmOI !== null && ttmDA !== null ? ttmOI + ttmDA : null,
      ttmNetIncome,
      ttmFreeCashFlow: sub(ttmOcf, ttmCapex),
      ttmOperatingCashFlow: ttmOcf,
      ttmCapex,
      ttmInterest,
      ttmTax,
      ttmPretax,
      ttmDA,
      cash: cashQ?.value ?? null,
      equity: equityQ?.value ?? null,
      debt,
      dilutedShares: sharesQ?.value ?? null,
    };
  });
  const byEnd = new Map(rows.map((r) => [r.end, r]));
  for (const row of rows) {
    const prior = priorYearEnd(ends, row.end);
    const p = prior ? byEnd.get(prior) : undefined;
    if (!p) continue;
    row.revenueYoY = row.revenue !== null && p.revenue ? row.revenue / p.revenue - 1 : null;
    row.ttmRevenueYoY = row.ttmRevenue !== null && p.ttmRevenue ? row.ttmRevenue / p.ttmRevenue - 1 : null;
    row.operatingMarginYoYChange = sub(row.operatingMargin, p.operatingMargin);
    row.fuelShareYoYChange = sub(row.fuelShare, p.fuelShare);
    const priorInputs = ["revenue", "operatingIncome", "fuelExpense"].flatMap((key) => {
      const q = valueOf(metrics[key as FlowKey], p.end);
      return q ? [q] : [];
    });
    if (row.ttmRevenueYoY !== null) {
      const quarters = metrics.revenue.quarters;
      const index = quarters.findIndex((q) => q.end === p.end);
      priorInputs.push(...quarters.slice(index - 3, index + 1));
    }
    row.availableFrom = priorInputs.reduce((max, q) => q.filed > max ? q.filed : max, row.availableFrom);
    row.revised ||= priorInputs.some((q) => q.revised);
  }
  return rows;
}

// ── Prices ──────────────────────────────────────────────────────────────────

export interface ClosePoint {
  date: string;
  close: number;
}

export const adjCloses = (prices: PriceFixture): ClosePoint[] => prices.rows.map((r) => ({ date: r[0], close: r[5] }));

function returnOver(points: ClosePoint[], tradingDays: number): number | null {
  if (points.length <= tradingDays) return null;
  const last = points[points.length - 1].close;
  const first = points[points.length - 1 - tradingDays].close;
  return first > 0 ? last / first - 1 : null;
}

export function buildPriceStats(prices: PriceFixture, market?: PriceFixture, sector?: PriceFixture): PriceStats | null {
  const adj = adjCloses(prices);
  if (adj.length < 30) return null;
  const last = prices.rows[prices.rows.length - 1];
  const window = adj.slice(-253);
  const rets = window.slice(1).map((p, i) => p.close / window[i].close - 1);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of window) {
    peak = Math.max(peak, p.close);
    maxDd = Math.min(maxDd, p.close / peak - 1);
  }
  const recent = prices.rows.slice(-63);
  const r6 = returnOver(adj, 126);
  const m6 = market ? returnOver(adjCloses(market), 126) : null;
  return {
    lastDate: last[0],
    lastClose: last[4],
    return6m: r6,
    return1y: returnOver(adj, 252),
    marketReturn6m: m6,
    sectorReturn6m: sector ? returnOver(adjCloses(sector), 126) : null,
    relativeReturn6m: r6 !== null && m6 !== null ? r6 - m6 : null,
    volatility1y: sd * Math.sqrt(252),
    maxDrawdown1y: maxDd,
    avgDollarVolume3m: recent.reduce((s, r) => s + r[4] * r[6], 0) / recent.length,
  };
}

// ── Valuation (point-in-time) ──────────────────────────────────────────────

function sharesKnownAt(cover: MetricSeries, date: string): QuarterValue | undefined {
  const known = knownAt(cover.quarters, date);
  return known[known.length - 1];
}

function monthEndIndices(rows: PriceFixture["rows"]): number[] {
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const next = rows[i + 1];
    if (!next || next[0].slice(0, 7) !== rows[i][0].slice(0, 7)) out.push(i);
  }
  return out;
}

function metricsKnownAt(raw: CompanyFixture["metrics"], asOf: string): Record<MetricKey, MetricSeries> {
  return Object.fromEntries([...FLOW_METRICS, ...BALANCE_METRICS].map((key) => {
    const metric = raw[key];
    // Filter BEFORE quarterisation: a later direct 3-month tag must not
    // displace the YTD-derived value that was available at the historical date.
    return [key, toMetricSeries(key, metric ? { ...metric, points: metric.points.filter((p) => p.filed <= asOf) } : undefined)];
  })) as Record<MetricKey, MetricSeries>;
}

function valuationAt(rawMetrics: CompanyFixture["metrics"], prices: PriceFixture, index: number) {
  const [date, , , , close] = prices.rows[index];
  const metrics = metricsKnownAt(rawMetrics, date);
  const rowsKnown = buildRows(metrics);
  // Every input in these rows is known by `date`. A missing earnings/cash-flow
  // input leaves only its dependent multiple unavailable, rather than hiding
  // the entire quarter behind one aggregate release date.
  const row = [...rowsKnown].reverse().find((r) => r.ttmRevenue !== null);
  const hasCoverShares = metrics.sharesOutstandingCover.quarters.length > 0;
  const cover = hasCoverShares
    ? metrics.sharesOutstandingCover
    : { ...metrics.dilutedShares, quarters: metrics.dilutedShares.quarters.filter((q) => q.derivation === "reported-3m") };
  const sharesQ = sharesKnownAt(cover, date);
  if (!row || !sharesQ) return null;
  const shares = sharesOnDate(sharesQ.value, sharesQ.end, date, prices.splits);
  const raw = rawPrice(close, date, prices.splits);
  const multiples = computeMultiples({
    marketCap: raw * shares,
    debt: row.debt?.total ?? null,
    cash: row.cash,
    ttmRevenue: row.ttmRevenue,
    ttmEbitda: row.ttmEbitda,
    ttmNetIncome: row.ttmNetIncome,
    ttmFcf: row.ttmFreeCashFlow,
    equity: row.equity,
  });
  return { date, close, raw, shares, sharesAsOf: sharesQ.end, sharesSource: hasCoverShares ? "cover-page" as const : "weighted-diluted" as const, row, multiples };
}

export function buildValuation(
  raw: CompanyFixture["metrics"],
  prices: PriceFixture,
): ValuationView | null {
  if (prices.rows.length === 0) return null;
  const history: ValuationPoint[] = [];
  for (const index of monthEndIndices(prices.rows)) {
    const v = valuationAt(raw, prices, index);
    if (!v) continue;
    history.push({
      date: v.date,
      fundamentalsThrough: v.row.end,
      pe: v.multiples.pe,
      evToEbitda: v.multiples.evToEbitda,
      evToSales: v.multiples.evToSales,
      fcfYield: v.multiples.fcfYield,
    });
  }
  const current = valuationAt(raw, prices, prices.rows.length - 1);
  if (!current) return null;
  const pick = (k: keyof Omit<ValuationPoint, "date" | "fundamentalsThrough">) => history.map((h) => h[k]);
  const pct = (k: "pe" | "evToEbitda" | "evToSales", v: number | null) => (v === null ? null : percentileOf(pick(k), v));
  return {
    asOf: current.date,
    price: current.close,
    rawPrice: current.raw,
    shares: current.shares,
    sharesAsOf: current.sharesAsOf,
    sharesSource: current.sharesSource,
    fundamentalsThrough: current.row.end,
    current: current.multiples,
    history,
    stats: { pe: distribution(pick("pe")), evToEbitda: distribution(pick("evToEbitda")), evToSales: distribution(pick("evToSales")), fcfYield: distribution(pick("fcfYield")) },
    percentiles: { pe: pct("pe", current.multiples.pe), evToEbitda: pct("evToEbitda", current.multiples.evToEbitda), evToSales: pct("evToSales", current.multiples.evToSales) },
    netDebt: current.row.debt && current.row.cash !== null ? current.row.debt.total - current.row.cash : null,
  };
}

// ── Scenarios (anchored to the company's own history) ───────────────────────

export function buildScenarios(rows: QuarterRow[], valuation: ValuationView | null): ScenarioAssumption[] {
  const latest = [...rows].reverse().find((r) => r.ttmOperatingMargin !== null && r.ttmRevenueYoY !== null);
  const multipleStats = valuation?.stats.evToEbitda;
  if (!latest || !multipleStats) return [];
  const recent = rows.filter((r) => r.end >= shiftYear(latest.end, -5));
  const margins = distribution(recent.map((r) => r.ttmOperatingMargin));
  const growth = distribution(recent.map((r) => r.ttmRevenueYoY));
  if (!margins || !growth) return [];
  const baseGrowth = latest.ttmRevenueYoY as number;
  const baseMargin = latest.ttmOperatingMargin as number;
  const window = `${recent[0].label}–${latest.label}`;
  return [
    {
      case: "bull",
      label: "Upper-quartile recovery",
      revenueGrowth: Math.max(baseGrowth, growth.p75),
      operatingMargin: Math.max(baseMargin, margins.p75),
      evToEbitda: Math.max(multipleStats.median, multipleStats.p75),
      rationale: `75th percentile of the company's own TTM revenue growth, TTM operating margin and month-end EV/EBITDA over ${window} (floored at the current value).`,
    },
    {
      case: "base",
      label: "Current run-rate",
      revenueGrowth: baseGrowth,
      operatingMargin: baseMargin,
      evToEbitda: multipleStats.median,
      rationale: `Latest TTM revenue growth and operating margin (through ${latest.label}) at the median historical EV/EBITDA.`,
    },
    {
      case: "bear",
      label: "Lower-quartile downcycle",
      revenueGrowth: Math.min(baseGrowth, growth.p25),
      operatingMargin: Math.min(baseMargin, margins.p25),
      evToEbitda: Math.min(multipleStats.median, multipleStats.p25),
      rationale: `25th percentile of the same history (capped at the current value). Not a forecast; a stress anchored to observed outcomes.`,
    },
  ];
}

// ── Filings & catalysts ─────────────────────────────────────────────────────

const toFilingRef = (f: FilingFixture): FilingRef => ({ form: f.form, filed: f.filed, reportDate: f.reportDate, accession: f.accession, kind: f.kind, url: f.url });

export function estimateNextEarnings(releases: FilingRef[], asOf: string): { date: string; basis: string } | null {
  const candidates = releases
    .map((r) => ({ r, next: shiftYear(r.filed, 1) }))
    .filter((c) => c.next > asOf)
    .sort((a, b) => a.next.localeCompare(b.next));
  const pick = candidates[0];
  if (!pick) return null;
  return {
    date: pick.next,
    basis: `Same-quarter earnings release last year (8-K Item 2.02 filed ${pick.r.filed}) + 1 year. Estimate from cadence, not a confirmed date.`,
  };
}

// ── Assembly ────────────────────────────────────────────────────────────────

export function buildCompanyView(
  fixture: CompanyFixture,
  coverage: CoverageCompany,
  prices: PriceFixture | undefined,
  market: PriceFixture | undefined,
  sector: PriceFixture | undefined,
  asOf: string,
): CompanyView {
  const metrics = metricsKnownAt(fixture.metrics, asOf);
  const rows = buildRows(metrics);
  const latest = rows.at(-1) ?? null;
  const latestTtm = [...rows].reverse().find((r) => r.ttmRevenue !== null) ?? null;
  // Dual-class filers may not tag a single cover-page share count; fall back to
  // weighted diluted shares (as instants at each quarter end) and say so.
  const coverShares = metrics.sharesOutstandingCover.quarters.length > 0;
  const valuation = prices ? buildValuation(fixture.metrics, prices) : null;

  const dataGaps: string[] = [];
  for (const key of ["fuelExpense", "interestExpense", "capex", "depreciationAmortization", "pretaxIncome"] as const) {
    if (!metrics[key].concept) dataGaps.push(`No matching XBRL concept for ${key}; dependent ratios are unavailable.`);
  }
  if (!latestTtm?.debt) dataGaps.push("Debt components not tagged at the latest balance-sheet date; EV-based multiples unavailable.");
  if (!prices) dataGaps.push("No price history in the snapshot; valuation unavailable.");
  if (!coverShares) dataGaps.push("Cover-page shares outstanding not tagged (dual-class filer); market cap uses weighted diluted shares for the latest reported quarter.");
  if (latestTtm && latestTtm.ttmDA === null) dataGaps.push("Quarterly D&A not tagged in a standard XBRL concept; EBITDA and EV/EBITDA are unavailable rather than estimated.");

  let roicApprox: CompanyView["roicApprox"] = null;
  if (latestTtm?.ttmOperatingIncome != null && latestTtm.debt && latestTtm.equity !== null && latestTtm.cash !== null) {
    const effective = latestTtm.ttmTax !== null && latestTtm.ttmPretax ? latestTtm.ttmTax / latestTtm.ttmPretax : null;
    const useEffective = effective !== null && effective > 0 && effective < 0.4;
    const taxRate = useEffective ? (effective as number) : 0.21;
    const invested = latestTtm.debt.total + latestTtm.equity - latestTtm.cash;
    if (invested > 0) roicApprox = { value: (latestTtm.ttmOperatingIncome * (1 - taxRate)) / invested, taxRate, taxRateSource: useEffective ? "effective" : "statutory" };
  }
  const priorShares = latest ? rows.find((r) => r.end === priorYearEnd(rows.map((x) => x.end), latest.end))?.dilutedShares ?? null : null;
  const filings = fixture.filings.map(toFilingRef);
  const earningsReleases = filings.filter((f) => f.kind === "earnings-release");

  return {
    ticker: fixture.ticker,
    name: coverage.displayName,
    legalName: fixture.name,
    cik: fixture.cik,
    sicDescription: fixture.sicDescription,
    fiscalYearEnd: fixture.fiscalYearEnd,
    coverage,
    sources: fixture.sources,
    retrievedAt: fixture.retrievedAt,
    metrics,
    quarters: rows,
    latest,
    latestTtm,
    valuation,
    priceStats: prices ? buildPriceStats(prices, market, sector) : null,
    scenarios: buildScenarios(rows, valuation),
    roicApprox,
    interestCoverage: latestTtm && latestTtm.ttmInterest && latestTtm.ttmInterest > 0 ? (latestTtm.ttmOperatingIncome ?? 0) / latestTtm.ttmInterest : null,
    cashConversion: latestTtm ? ratio(latestTtm.ttmOperatingCashFlow, latestTtm.ttmNetIncome) : null,
    capexIntensity: latestTtm ? ratio(latestTtm.ttmCapex, latestTtm.ttmRevenue) : null,
    shareChangeYoY: latest?.dilutedShares && priorShares ? latest.dilutedShares / priorShares - 1 : null,
    filings,
    earningsReleases,
    nextEarningsEstimate: estimateNextEarnings(earningsReleases, asOf),
    annualReport: fixture.annualReport,
    excerpts: fixture.annualReport?.excerpts ?? [],
    dataGaps,
  };
}

// ── Scenario valuation inputs ───────────────────────────────────────────────

/** The fixed inputs a scenario needs, from the latest TTM row + valuation. Null if anything is missing. */
export function scenarioBase(company: CompanyView): Omit<ScenarioInputs, "revenueGrowth" | "operatingMargin" | "evToEbitda"> | null {
  const row = company.latestTtm;
  const val = company.valuation;
  if (!row || !val || row.ttmRevenue === null || row.ttmDA === null || val.netDebt === null) return null;
  return { ttmRevenue: row.ttmRevenue, daToRevenue: row.ttmDA / row.ttmRevenue, netDebt: val.netDebt, shares: val.shares, price: val.rawPrice };
}

export function scenarioResults(company: CompanyView): ScenarioResult[] {
  const base = scenarioBase(company);
  if (!base) return [];
  return company.scenarios.map((s) => ({ ...s, ...valueScenario({ ...base, revenueGrowth: s.revenueGrowth, operatingMargin: s.operatingMargin, evToEbitda: s.evToEbitda }) }));
}

export const ordinal = (n: number) => {
  const r = Math.round(n);
  const mod100 = r % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : r % 10 === 1 ? "st" : r % 10 === 2 ? "nd" : r % 10 === 3 ? "rd" : "th";
  return `${r}${suffix}`;
};
