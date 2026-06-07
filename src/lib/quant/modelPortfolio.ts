import type { BacktestResult } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import type { RadarCandidate } from "@/types/strategy";
import { pct } from "@/lib/utils/format";
import { dailyReturns, maxDrawdownFromSeries } from "./indicators";

/**
 * "Since May" Model Portfolio Performance.
 *
 * Builds a DETERMINISTIC, SIMULATED research portfolio from the platform's
 * existing strategy results — it is explicitly NOT a real-money trading account,
 * and nothing here claims realized or guaranteed returns. The construction is:
 *
 *   1. Pick the top-ranked strategies from the radar (falling back to the
 *      catalog's best-per-strategy runs when the radar shortlist is thin).
 *   2. Slice each strategy's backtested equity curve from the first trading day
 *      on/after May 1 of the latest data year.
 *   3. Normalize every strategy curve to 1.00 on that start date.
 *   4. Equal-weight average the normalized curves → the model portfolio curve
 *      (indexed to 100 at the start).
 *   5. Compare against SPY and/or QQQ, each normalized the same way.
 *
 * All figures are derived from available historical market data; the start year
 * is taken from the freshest data date so the module stays correct against both
 * live data and the committed fixture rather than the wall clock.
 */

const ANNUALIZATION = 252;
const VOL_EPSILON = 1e-12;
const BASE_INDEX = 100;
const DEFAULT_MAX_STRATEGIES = 5;
/** Below this many trading days, an annualized figure is too noisy to trust. */
const SHORT_WINDOW_DAYS = 30;

export interface ModelPortfolioBenchmark {
  symbol: string;
  totalReturn: number;
}

export interface ModelPortfolioCurvePoint {
  date: string;
  /** Model portfolio value, indexed to 100 on the start date. */
  value: number;
}

export interface ModelPortfolioBenchmarkPoint {
  date: string;
  /** SPY value indexed to 100, or null if SPY is unavailable. */
  spy: number | null;
  /** QQQ value indexed to 100, or null if QQQ is unavailable. */
  qqq: number | null;
}

export interface ModelPortfolioConstituent {
  strategyId: string;
  strategyName: string;
  symbol: string;
  returnSinceStart: number;
}

export interface ModelPortfolioDataQuality {
  isFallback: boolean;
  adjusted: boolean;
  sources: string[];
  label: string;
}

export interface ModelPortfolioPerformance {
  /** False when there isn't enough market data on/after May 1 to build the blend. */
  available: boolean;
  /** The requested calendar start, e.g. "2026-05-01". */
  requestedStartDate: string;
  /** First actual trading day on/after the requested start. */
  startDate: string;
  /** Latest available market date used as the end of the window. */
  endDate: string;
  /** True when May 1 itself was not a trading day and the start was rolled forward. */
  startAdjusted: boolean;
  /** Number of trading days in the window. */
  tradingDays: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpe: number;
  /** Share of trading days with a positive model-portfolio return, or null. */
  winRate: number | null;
  /** SPY first (preferred), then QQQ, when each is available. */
  benchmarks: ModelPortfolioBenchmark[];
  /** Symbol of the primary benchmark used for excess return (SPY preferred). */
  primaryBenchmarkSymbol: string | null;
  /** Total return of the primary benchmark over the same window. */
  benchmarkReturn: number;
  /** Model portfolio total return minus the primary benchmark return. */
  excessReturn: number;
  strategyCount: number;
  constituents: ModelPortfolioConstituent[];
  equityCurve: ModelPortfolioCurvePoint[];
  benchmarkCurve: ModelPortfolioBenchmarkPoint[];
  dataQuality: ModelPortfolioDataQuality;
  lastUpdated: string;
  notes: string[];
}

export interface ModelPortfolioInput {
  radarCandidates: RadarCandidate[];
  strategyResults: BacktestResult[];
  pricesBySymbol: Record<string, HistoricalPriceResult>;
  generatedAt?: string;
  maxStrategies?: number;
  /** Override the "current year" used for the May 1 start (defaults to latest data year). */
  year?: number;
}

export function buildModelPortfolioPerformance(input: ModelPortfolioInput): ModelPortfolioPerformance {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const maxStrategies = Math.max(1, Math.floor(input.maxStrategies ?? DEFAULT_MAX_STRATEGIES));

  const chosen = selectStrategies(input.radarCandidates, input.strategyResults, maxStrategies);
  const spy = usableSeries(input.pricesBySymbol.SPY);
  const qqq = usableSeries(input.pricesBySymbol.QQQ);

  // Anchor "May 1" to the year of the freshest available market date so the
  // window tracks the data, not the server clock.
  const latestDate = latestAvailableDate(chosen, [spy, qqq]);
  const year = input.year ?? (latestDate ? Number(latestDate.slice(0, 4)) : new Date().getUTCFullYear());
  const requestedStartDate = `${year}-05-01`;

  if (chosen.length === 0) {
    return emptyPerformance(requestedStartDate, generatedAt, [
      "No strategy results were available to build a simulated model portfolio.",
    ]);
  }

  const strategySeries = chosen.map((result) => ({
    result,
    map: toValueMap(result.equityCurve.map((point) => ({ date: point.date, value: point.equity }))),
    dates: result.equityCurve.map((point) => point.date),
  }));

  const masterCalendar = buildMasterCalendar(
    strategySeries.map((series) => series.dates),
    requestedStartDate,
  );
  if (masterCalendar.length < 2) {
    return emptyPerformance(requestedStartDate, generatedAt, [
      `Not enough overlapping trading data on or after ${requestedStartDate} to build a simulated model portfolio.`,
    ]);
  }

  const startDate = masterCalendar[0];
  const endDate = masterCalendar[masterCalendar.length - 1];
  const startAdjusted = startDate !== requestedStartDate;

  // Normalize each strategy to 1.00 at startDate, equal-weight, index to 100.
  const equityCurve: ModelPortfolioCurvePoint[] = masterCalendar.map((date) => {
    let sum = 0;
    let count = 0;
    for (const series of strategySeries) {
      const anchor = series.map.get(startDate);
      const value = series.map.get(date);
      if (anchor !== undefined && anchor !== 0 && value !== undefined) {
        sum += value / anchor;
        count += 1;
      }
    }
    return { date, value: (count > 0 ? sum / count : 1) * BASE_INDEX };
  });

  const values = equityCurve.map((point) => point.value);
  const totalReturn = values[values.length - 1] / values[0] - 1;
  const maxDrawdown = maxDrawdownFromSeries(values);
  const currentDrawdown = currentDrawdownFromSeries(values);
  const returns = dailyReturns(values);
  const sharpe = sharpeFromReturns(returns);
  const tradingDays = masterCalendar.length;
  const years = Math.max(tradingDays / ANNUALIZATION, 1 / ANNUALIZATION);
  const annualizedReturn = (1 + totalReturn) ** (1 / years) - 1;
  const winRate = returns.length > 0 ? returns.filter((value) => value > 0).length / returns.length : null;

  const spyIndexer = benchmarkIndexer(spy, startDate);
  const qqqIndexer = benchmarkIndexer(qqq, startDate);

  const benchmarkCurve: ModelPortfolioBenchmarkPoint[] = masterCalendar.map((date) => ({
    date,
    spy: indexedValue(spyIndexer, date),
    qqq: indexedValue(qqqIndexer, date),
  }));

  const benchmarks: ModelPortfolioBenchmark[] = [];
  const spyReturn = benchmarkReturnOver(spyIndexer, endDate);
  const qqqReturn = benchmarkReturnOver(qqqIndexer, endDate);
  if (spyReturn !== null) benchmarks.push({ symbol: "SPY", totalReturn: spyReturn });
  if (qqqReturn !== null) benchmarks.push({ symbol: "QQQ", totalReturn: qqqReturn });

  const primary = benchmarks[0] ?? null;
  const benchmarkReturn = primary?.totalReturn ?? 0;
  const excessReturn = primary ? totalReturn - primary.totalReturn : 0;

  const constituents: ModelPortfolioConstituent[] = strategySeries.map((series) => {
    const anchor = series.map.get(startDate);
    const last = series.map.get(endDate);
    const returnSinceStart =
      anchor !== undefined && anchor !== 0 && last !== undefined ? last / anchor - 1 : 0;
    return {
      strategyId: series.result.strategyId,
      strategyName: series.result.strategyName,
      symbol: series.result.symbol,
      returnSinceStart,
    };
  });

  const benchResults = [spy, qqq].filter((series): series is HistoricalPriceResult => series !== null);
  const isFallback =
    chosen.some((result) => result.dataStatus.isFallback) || benchResults.some((series) => series.isFallback);
  const adjusted =
    chosen.every((result) => result.dataStatus.adjusted) && benchResults.every((series) => series.quality.adjusted);
  const sources = Array.from(
    new Set([
      ...chosen.map((result) => result.dataStatus.provider),
      ...benchResults.map((series) => series.provider),
    ]),
  );
  const dataQuality: ModelPortfolioDataQuality = {
    isFallback,
    adjusted,
    sources,
    label: isFallback ? "Includes clearly labeled fallback/demo data" : "Based on available historical market data",
  };

  const notes = buildNotes({
    strategyCount: chosen.length,
    startDate,
    requestedStartDate,
    startAdjusted,
    tradingDays,
    isFallback,
  });

  return {
    available: true,
    requestedStartDate,
    startDate,
    endDate,
    startAdjusted,
    tradingDays,
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    currentDrawdown,
    sharpe,
    winRate,
    benchmarks,
    primaryBenchmarkSymbol: primary?.symbol ?? null,
    benchmarkReturn,
    excessReturn,
    strategyCount: chosen.length,
    constituents,
    equityCurve,
    benchmarkCurve,
    dataQuality,
    lastUpdated: generatedAt,
    notes,
  };
}

/**
 * One-line, carefully-worded headline for the module. Frames everything as a
 * simulated research portfolio and never claims realized or future returns.
 */
export function buildModelPortfolioHeadline(data: ModelPortfolioPerformance): string {
  if (!data.available) {
    return "A simulated model portfolio could not be built from the available historical data for this period.";
  }
  const spy = data.benchmarks.find((benchmark) => benchmark.symbol === "SPY");
  const qqq = data.benchmarks.find((benchmark) => benchmark.symbol === "QQQ");
  const benchmarkParts: string[] = [];
  if (spy) benchmarkParts.push(`${pct(spy.totalReturn)} for SPY`);
  if (qqq) benchmarkParts.push(`${pct(qqq.totalReturn)} for QQQ`);
  const versus = benchmarkParts.length > 0 ? ` versus ${joinWithAnd(benchmarkParts)}` : "";
  return (
    `Since ${formatLongDate(data.startDate)}, the simulated model portfolio returned ${pct(data.totalReturn)}` +
    `${versus}, with a max drawdown of ${pct(data.maxDrawdown)}. Results are based on research backtests and ` +
    `paper-observation logic, not a live trading account.`
  );
}

export function formatLongDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function selectStrategies(
  radarCandidates: RadarCandidate[],
  strategyResults: BacktestResult[],
  maxStrategies: number,
): BacktestResult[] {
  const ranked = [...radarCandidates]
    .filter((candidate) => candidate.status !== "rejected" && !candidate.redundancy?.demoted)
    .sort((a, b) => a.rank - b.rank)
    .map((candidate) => candidate.result);
  const fromRadar = dedupeResults(ranked);
  if (fromRadar.length >= 2) return fromRadar.slice(0, maxStrategies);
  // Thin radar shortlist — top up with the catalog's best-per-strategy runs so the
  // blend is still diversified across at least a couple of independent rules.
  return dedupeResults([...fromRadar, ...strategyResults]).slice(0, maxStrategies);
}

function dedupeResults(results: BacktestResult[]): BacktestResult[] {
  const seen = new Set<string>();
  const out: BacktestResult[] = [];
  for (const result of results) {
    const key = `${result.strategyId}-${result.symbol}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(result);
    }
  }
  return out;
}

function usableSeries(result?: HistoricalPriceResult): HistoricalPriceResult | null {
  return result && result.prices.length > 0 ? result : null;
}

function toValueMap(points: Array<{ date: string; value: number }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) map.set(point.date, point.value);
  return map;
}

function latestAvailableDate(
  strategies: BacktestResult[],
  benches: Array<HistoricalPriceResult | null>,
): string | null {
  let latest: string | null = null;
  const consider = (date: string | undefined) => {
    if (date && (latest === null || date > latest)) latest = date;
  };
  for (const strategy of strategies) consider(strategy.equityCurve.at(-1)?.date);
  for (const bench of benches) consider(bench?.prices.at(-1)?.date);
  return latest;
}

/** Intersection of all strategy calendars, restricted to on/after `start`, sorted ascending. */
function buildMasterCalendar(dateLists: string[][], start: string): string[] {
  if (dateLists.length === 0) return [];
  const [first, ...rest] = dateLists;
  const restSets = rest.map((list) => new Set(list));
  const inAll = first.filter((date) => restSets.every((set) => set.has(date)));
  return Array.from(new Set(inAll))
    .filter((date) => date >= start)
    .sort();
}

interface BenchmarkIndexer {
  map: Map<string, number>;
  anchor: number;
  prices: HistoricalPriceResult["prices"];
}

function benchmarkIndexer(series: HistoricalPriceResult | null, startDate: string): BenchmarkIndexer | null {
  if (!series) return null;
  const map = new Map<string, number>();
  for (const price of series.prices) map.set(price.date, price.close);
  let anchor = map.get(startDate);
  if (anchor === undefined) {
    const onOrAfter = series.prices.find((price) => price.date >= startDate);
    anchor = onOrAfter?.close;
  }
  if (anchor === undefined || anchor === 0) return null;
  return { map, anchor, prices: series.prices };
}

function indexedValue(indexer: BenchmarkIndexer | null, date: string): number | null {
  if (!indexer) return null;
  const close = indexer.map.get(date);
  if (close === undefined) return null;
  return (close / indexer.anchor) * BASE_INDEX;
}

function benchmarkReturnOver(indexer: BenchmarkIndexer | null, endDate: string): number | null {
  if (!indexer) return null;
  const endClose = closeOnOrBefore(indexer.prices, endDate);
  if (endClose === null) return null;
  return endClose / indexer.anchor - 1;
}

/** Last close at or before `date`. Assumes `prices` is sorted ascending by date. */
function closeOnOrBefore(prices: HistoricalPriceResult["prices"], date: string): number | null {
  let close: number | null = null;
  for (const price of prices) {
    if (price.date <= date) close = price.close;
    else break;
  }
  return close;
}

function sharpeFromReturns(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(variance);
  if (dailyVol < VOL_EPSILON) return 0;
  return (mean / dailyVol) * Math.sqrt(ANNUALIZATION);
}

function currentDrawdownFromSeries(values: number[]): number {
  if (values.length === 0) return 0;
  const peak = Math.max(...values);
  const last = values[values.length - 1];
  return peak > 0 ? last / peak - 1 : 0;
}

function buildNotes(input: {
  strategyCount: number;
  startDate: string;
  requestedStartDate: string;
  startAdjusted: boolean;
  tradingDays: number;
  isFallback: boolean;
}): string[] {
  const notes = [
    "Simulated research portfolio — not a real-money account and not investment advice.",
    `Equal-weighted blend of ${input.strategyCount} top-ranked research ${input.strategyCount === 1 ? "strategy" : "strategies"}, each normalized to 1.00 on ${input.startDate}.`,
    "Based on available historical market data and research backtests, not live execution.",
    "Historical performance does not indicate future results.",
  ];
  if (input.startAdjusted) {
    notes.push(
      `May 1 (${input.requestedStartDate}) was not a trading day; the start was rolled forward to the first available session, ${input.startDate}.`,
    );
  }
  if (input.tradingDays < SHORT_WINDOW_DAYS) {
    notes.push(
      `Annualized return extrapolates a short ${input.tradingDays}-trading-day window and is statistically unstable; treat it as illustrative only.`,
    );
  }
  if (input.isFallback) {
    notes.push("Some inputs use clearly labeled fallback/demo data and are not presented as broker-confirmed performance.");
  }
  return notes;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function emptyPerformance(
  requestedStartDate: string,
  generatedAt: string,
  notes: string[],
): ModelPortfolioPerformance {
  return {
    available: false,
    requestedStartDate,
    startDate: requestedStartDate,
    endDate: requestedStartDate,
    startAdjusted: false,
    tradingDays: 0,
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    currentDrawdown: 0,
    sharpe: 0,
    winRate: null,
    benchmarks: [],
    primaryBenchmarkSymbol: null,
    benchmarkReturn: 0,
    excessReturn: 0,
    strategyCount: 0,
    constituents: [],
    equityCurve: [],
    benchmarkCurve: [],
    dataQuality: {
      isFallback: false,
      adjusted: false,
      sources: [],
      label: "No usable historical market data for this period",
    },
    lastUpdated: generatedAt,
    notes,
  };
}
