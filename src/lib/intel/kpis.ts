import type { ResearchProjectConfig } from "@/data/research/types";
import type { MacroSeriesFixture } from "./snapshot";
import {
  buildReadings,
  leadLag,
  seriesFreshness,
  simpleRegression,
  toPoints,
  trailingAverageYoy,
  weeklyToMonthlyAverage,
  yoyChanges,
  type LeadLagResult,
  type SimpleFit,
} from "./series";
import type { KpiDefinition, KpiSeriesView, SeriesPoint } from "./types";

/** FRED-hosted source → display publisher. Comes from the scraped FRED page, not typed by hand. */
function sourceRefFor(series: MacroSeriesFixture | undefined, kpi: KpiDefinition): KpiSeriesView["source"] {
  return {
    id: `FRED:${series?.id ?? kpi.id}`,
    seriesId: series?.id ?? kpi.id,
    title: series?.title ?? kpi.name,
    publisher: series ? `${series.source ?? "Source agency"} via FRED (Federal Reserve Bank of St. Louis)` : "Derived in FactorForge",
    url: series?.url,
    sourceType: series?.source?.includes("Cass") ? "industry-dataset" : "government-dataset",
    licence: series?.licenseLabel ?? undefined,
    retrievedAt: series?.retrievedAt ?? "",
    publishedAt: series?.dateModified ?? undefined,
    sourceAgency: series?.source ?? null,
    release: series?.release ?? null,
    sourceUpdated: series?.updated ?? null,
    nextRelease: series?.nextRelease ?? null,
    notes: series?.notes ?? null,
    excluded: series?.excluded ?? null,
  };
}

function countMissingMonths(points: SeriesPoint[]): number {
  if (points.length < 2) return 0;
  let missing = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [y0, m0] = points[i - 1].date.split("-").map(Number);
    const [y1, m1] = points[i].date.split("-").map(Number);
    const gap = (y1 - y0) * 12 + (m1 - m0);
    if (gap > 1) missing += gap - 1;
  }
  return missing;
}

function viewFor(kpi: KpiDefinition, points: SeriesPoint[], source: KpiSeriesView["source"], asOf: Date): KpiSeriesView {
  const readings = buildReadings(points, kpi.frequency);
  const latest = readings.at(-1) ?? null;
  const fresh = seriesFreshness(latest?.date ?? null, kpi.frequency, kpi.publicationLagDays, asOf);
  return {
    kpi,
    source,
    readings,
    latest,
    freshness: fresh.freshness,
    freshnessNote: fresh.note,
    missingValues: kpi.frequency === "monthly" ? countMissingMonths(points) : 0,
  };
}

export function buildKpiViews(config: ResearchProjectConfig, macro: MacroSeriesFixture[], asOf: Date): KpiSeriesView[] {
  const byId = new Map(macro.map((s) => [s.id, s]));
  const views: KpiSeriesView[] = config.kpis.map((kpi) => {
    const series = kpi.sourceSeriesId ? byId.get(kpi.sourceSeriesId) : undefined;
    const points = series && !series.excluded ? toPoints(series.observations) : [];
    return viewFor(kpi, points, sourceRefFor(series, kpi), asOf);
  });
  const viewById = new Map(views.map((v) => [v.kpi.id, v]));
  for (const derived of config.derivedKpis) {
    const num = viewById.get(derived.numerator);
    const den = viewById.get(derived.denominator);
    if (!num || !den) continue;
    const denByDate = new Map(den.readings.map((r) => [r.date, r.value]));
    const points = num.readings
      .filter((r) => denByDate.has(r.date) && (denByDate.get(r.date) as number) > 0)
      .map((r) => ({ date: r.date, value: r.value / (denByDate.get(r.date) as number) }));
    const source: KpiSeriesView["source"] = {
      ...num.source,
      id: `DERIVED:${derived.id}`,
      seriesId: `${num.source.seriesId} ÷ ${den.source.seriesId}`,
      title: derived.name,
      publisher: `Derived in FactorForge from ${num.source.seriesId} and ${den.source.seriesId} (${num.source.sourceAgency ?? "source"} via FRED)`,
    };
    views.push(viewFor(derived, points, source, asOf));
  }
  return views;
}

// ── Fuel-adjusted pricing residual ──────────────────────────────────────────

export interface FuelResidualPoint {
  date: string;
  actual: number;
  fitted: number;
  residual: number;
  outOfSample: boolean;
}

export interface FuelResidualAnalysis {
  kpiId: string;
  fuelKpiId: string;
  fit: SimpleFit;
  trainingEnd: string;
  points: FuelResidualPoint[];
  latest: FuelResidualPoint | null;
  /** Mean residual over the out-of-sample window. */
  meanOutOfSample: number | null;
  method: string;
  /** Fuel YoY range seen in training; out-of-sample values outside it are extrapolations. */
  trainingFuelRange: [number, number];
  extrapolation: boolean;
}

/** Monthly YoY series for any KPI (weekly KPIs are averaged to calendar months first). */
export function monthlyYoy(view: KpiSeriesView): Array<{ date: string; value: number | null }> {
  if (view.kpi.frequency !== "weekly") return view.readings.map((r) => ({ date: r.date, value: r.yoy }));
  const monthly = weeklyToMonthlyAverage(view.readings.map((r) => ({ date: r.date, value: r.value })));
  const yoy = yoyChanges(monthly, "monthly");
  return monthly.map((p, i) => ({ date: p.date, value: yoy[i] }));
}

/**
 * Regress a price KPI's YoY change on diesel's YoY change, fitting only on
 * months before the final `holdout` months, then report residuals for the
 * holdout. A positive out-of-sample residual = pricing rose by more than its
 * historical fuel sensitivity explains. It is a statistical decomposition, not
 * a measured ex-fuel rate.
 */
export function fuelAdjustedResidual(
  target: KpiSeriesView,
  fuel: KpiSeriesView,
  holdout = 12,
): FuelResidualAnalysis | null {
  const fuelByMonth = new Map(
    monthlyYoy(fuel)
      .filter((p) => p.value !== null)
      .map((p) => [p.date.slice(0, 7), p.value as number]),
  );
  const rows = monthlyYoy(target)
    .filter((p) => p.value !== null && fuelByMonth.has(p.date.slice(0, 7)))
    .map((p) => ({ date: p.date, y: p.value as number, x: fuelByMonth.get(p.date.slice(0, 7)) as number }));
  if (rows.length < holdout + 24) return null;
  const training = rows.slice(0, rows.length - holdout);
  const fit = simpleRegression(training.map((r) => [r.x, r.y]));
  if (!fit) return null;
  const points = rows.map((r, i) => {
    const fitted = fit.intercept + fit.slope * r.x;
    return { date: r.date, actual: r.y, fitted, residual: r.y - fitted, outOfSample: i >= training.length };
  });
  const oos = points.filter((p) => p.outOfSample);
  const xs = training.map((r) => r.x);
  const trainingFuelRange: [number, number] = [Math.min(...xs), Math.max(...xs)];
  const oosRows = rows.slice(training.length);
  const extrapolation = oosRows.some((r) => r.x > trainingFuelRange[1] || r.x < trainingFuelRange[0]);
  return {
    kpiId: target.kpi.id,
    fuelKpiId: fuel.kpi.id,
    fit,
    trainingEnd: training[training.length - 1].date,
    points,
    latest: points.at(-1) ?? null,
    meanOutOfSample: oos.length ? oos.reduce((s, p) => s + p.residual, 0) / oos.length : null,
    method: `OLS of ${target.kpi.name} YoY on diesel YoY (monthly average), fit on ${training.length} months through ${training[training.length - 1].date.slice(0, 7)}; the last ${holdout} months are out-of-sample.`,
    trainingFuelRange,
    extrapolation,
  };
}

export interface LeadLagView {
  leader: string;
  follower: string;
  rationale: string;
  result: LeadLagResult;
}

export function buildLeadLagViews(config: ResearchProjectConfig, views: KpiSeriesView[]): LeadLagView[] {
  const byId = new Map(views.map((v) => [v.kpi.id, v]));
  return config.leadLagPairs
    .map((pair) => {
      const leader = byId.get(pair.leader);
      const follower = byId.get(pair.follower);
      if (!leader || !follower) return null;
      return { ...pair, result: leadLag(monthlyYoy(leader), monthlyYoy(follower), 12) };
    })
    .filter((v): v is LeadLagView => v !== null);
}

/** Metric lookup used by hypothesis tests. */
export function kpiMetric(view: KpiSeriesView | undefined, metric: "yoy" | "yoy3m"): number | null {
  if (!view || view.readings.length === 0) return null;
  if (metric === "yoy") return view.latest?.yoy ?? null;
  return trailingAverageYoy(view.readings, 3);
}
