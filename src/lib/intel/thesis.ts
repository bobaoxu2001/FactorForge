import type { Comparator, HypothesisConfig, HypothesisTest, TriggerConfig } from "@/data/research/types";
import { pct } from "@/lib/utils/format";
import { ordinal, type CompanyView, type QuarterRow } from "./companies";
import { findCommonQuarter, isQuarterComparisonMetric, quarterEvidenceId } from "./comparability";
import { pp } from "./evidence";
import { kpiMetric, type FuelResidualAnalysis } from "./kpis";
import type { Evidence, HypothesisView, KpiSeriesView, KpiTestResult, Stance, TestOutcome, TriggerResult } from "./types";

/**
 * Hypothesis tests and invalidation triggers, evaluated against the snapshot.
 * A test only ever reports what the data says. The supporting/contradicting
 * evidence lists come from these outcomes, not from configuration, so a
 * hypothesis cannot be "supported" by evidence that points the other way.
 */

export interface ThesisContext {
  kpis: Map<string, KpiSeriesView>;
  residuals: Map<string, FuelResidualAnalysis>;
  companies: Map<string, CompanyView>;
  evidenceIds: Set<string>;
}

const compare = (value: number, op: Comparator, threshold: number) => (op === ">" ? value > threshold : value < threshold);

const fmtMetric = (metric: string, value: number) =>
  metric === "evEbitdaPercentile" ? `${ordinal(value * 100)} pct` : metric.endsWith("Change") || metric === "fuelResidual" || metric.startsWith("relative") ? pp(value) : pct(value);

const existing = (ctx: ThesisContext, ids: string[]) => ids.filter((id) => ctx.evidenceIds.has(id));

/**
 * Attach only the evidence item that states the value the test decided on, so
 * a reading pointing the other way is never listed as "supporting".
 */
function kpiValue(ctx: ThesisContext, kpiId: string, metric: "yoy" | "yoy3m" | "fuelResidual"): { value: number | null; evidenceIds: string[] } {
  if (metric === "fuelResidual") {
    const r = ctx.residuals.get(kpiId);
    return { value: r?.latest?.residual ?? null, evidenceIds: existing(ctx, [`EV-CALC-${kpiId}-FUEL`]) };
  }
  const primary = existing(ctx, [metric === "yoy3m" ? `EV-KPI-${kpiId}-3M` : `EV-KPI-${kpiId}`]);
  return {
    value: kpiMetric(ctx.kpis.get(kpiId), metric),
    evidenceIds: primary.length ? primary : existing(ctx, [`EV-KPI-${kpiId}`]),
  };
}

function companyMetric(company: CompanyView | undefined, metric: string, periodRow?: QuarterRow): { value: number | null; evidenceId: string | null } {
  if (!company) return { value: null, evidenceId: null };
  const row = periodRow ?? company.latest;
  const id = (key: "OM" | "FUEL" | "REV") => periodRow ? quarterEvidenceId(company.ticker, key, periodRow.end) : `EV-${company.ticker}-${key}`;
  switch (metric) {
    case "operatingMarginYoYChange":
      return { value: row?.operatingMarginYoYChange ?? null, evidenceId: id("OM") };
    case "fuelShareYoYChange":
      return { value: row?.fuelShareYoYChange ?? null, evidenceId: id("FUEL") };
    case "revenueYoY":
      return { value: row?.revenueYoY ?? null, evidenceId: id("REV") };
    case "evEbitdaPercentile":
      return { value: company.valuation?.percentiles.evToEbitda ?? null, evidenceId: `EV-${company.ticker}-VAL` };
    case "relativeReturn6m":
      return { value: company.priceStats?.relativeReturn6m ?? null, evidenceId: `EV-${company.ticker}-RET` };
    default:
      return { value: null, evidenceId: null };
  }
}

export function evaluateTest(test: HypothesisTest, ctx: ThesisContext): KpiTestResult {
  if (test.kind === "kpi-threshold") {
    const { value, evidenceIds } = kpiValue(ctx, test.kpiId, test.metric);
    if (value === null) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "Series or calculation unavailable.", evidenceIds };
    const holds = compare(value, test.op, test.threshold);
    const outcome = holds === test.supportsWhenTrue ? "supports" : "contradicts";
    return {
      id: test.id,
      description: test.description,
      outcome,
      diagnosticOnly: test.diagnosticOnly,
      detail: `Observed ${fmtMetric(test.metric, value)} (threshold ${test.op} ${fmtMetric(test.metric, test.threshold)}).`,
      evidenceIds,
      evidenceRelations: evidenceIds.map((evidenceId) => ({ evidenceId, stance: test.diagnosticOnly ? "context" : outcome, reason: test.diagnosticOnly ? "Model/headline context. A diesel residual measures deviation from a historical fit, not the level or growth of observed ex-fuel rates." : `${outcome === "supports" ? "Directionally consistent with" : "Directionally against"} the stated screen; this observation alone does not identify a causal mechanism.` })),
    };
  }
  if (test.kind === "company-metric") {
    const matched = isQuarterComparisonMetric(test.metric)
      ? findCommonQuarter(test.tickers.map((ticker) => ctx.companies.get(ticker)), [test.metric])
      : undefined;
    if (matched === null) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "No common reporting quarter with this metric for every requested company.", evidenceIds: [] };
    const periodRows = new Map(matched?.rows.map(({ company, row }) => [company.ticker, row]));
    const reads = test.tickers.map((t) => ({ ticker: t, ...companyMetric(ctx.companies.get(t), test.metric, periodRows.get(t)) }));
    const usable = reads.filter((r) => r.value !== null);
    const evidenceIds = existing(ctx, usable.map((r) => r.evidenceId as string));
    if (usable.length === 0) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "No company data for this metric.", evidenceIds };
    const passing = usable.filter((r) => compare(r.value as number, test.op, test.threshold) === test.supportsWhenTrue);
    const outcome: TestOutcome = passing.length === usable.length ? "supports" : passing.length === 0 ? "contradicts" : "mixed";
    const detail = (matched ? `Common ${matched.label}: ` : "") + usable.map((r) => `${r.ticker} ${fmtMetric(test.metric, r.value as number)}`).join(" · ") + (usable.length < reads.length ? ` (no data: ${reads.filter((r) => r.value === null).map((r) => r.ticker).join(", ")})` : "");
    if (matched && evidenceIds.length !== usable.length) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "The common-quarter calculation is missing its dated source evidence.", evidenceIds: [], period: matched.label };
    return { id: test.id, description: test.description, outcome, detail, evidenceIds, period: matched?.label,
      evidenceRelations: usable.filter((r) => r.evidenceId && evidenceIds.includes(r.evidenceId)).map((r) => ({ evidenceId: r.evidenceId!, stance: compare(r.value!, test.op, test.threshold) === test.supportsWhenTrue ? "supports" : "contradicts", reason: `${r.ticker} ${fmtMetric(test.metric, r.value!)}: ${compare(r.value!, test.op, test.threshold) === test.supportsWhenTrue ? "directionally consistent with" : "directionally against"} this screen. Cause unassigned; reconcile fuel recovery, business mix and other costs before attribution.` })) };
  }
  const matched = findCommonQuarter([...new Set([...test.groupA, ...test.groupB])].map((ticker) => ctx.companies.get(ticker)), [test.metric]);
  if (!matched) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "No common reporting quarter with this metric for every company in both peer groups.", evidenceIds: [] };
  const periodRows = new Map(matched.rows.map(({ company, row }) => [company.ticker, row]));
  const groupMean = (tickers: string[]) => {
    const values = tickers.map((t) => companyMetric(ctx.companies.get(t), test.metric, periodRows.get(t))).filter((r) => r.value !== null);
    return { mean: values.length ? values.reduce((s, r) => s + (r.value as number), 0) / values.length : null, ids: values.map((r) => r.evidenceId as string), n: values.length };
  };
  const a = groupMean(test.groupA);
  const b = groupMean(test.groupB);
  const evidenceIds = existing(ctx, [...a.ids, ...b.ids]);
  if (evidenceIds.length !== new Set([...a.ids, ...b.ids]).size) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "The common-quarter calculation is missing its dated source evidence.", evidenceIds: [], period: matched.label };
  if (a.mean === null || b.mean === null) return { id: test.id, description: test.description, outcome: "insufficient-data", detail: "One of the peer groups has no data.", evidenceIds };
  const spread = a.mean - b.mean;
  const members = (tickers: string[]) => tickers.map((ticker) => ({ ticker, value: companyMetric(ctx.companies.get(ticker), test.metric, periodRows.get(ticker)).value! }));
  const mean = (rows: Array<{ value: number }>) => rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  const stats = (rows: ReturnType<typeof members>) => {
    const sorted = rows.map((r) => r.value).sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    return { members: rows, mean: mean(rows), median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 };
  };
  const groupA = stats(members(test.groupA));
  const groupB = stats(members(test.groupB));
  const passes = spread > test.threshold;
  const leaveOneOut = (["A", "B"] as const).flatMap((group) => {
    const rows = group === "A" ? groupA.members : groupB.members;
    if (rows.length < 2) return [];
    return rows.map((row) => {
      const reduced = mean(rows.filter((r) => r.ticker !== row.ticker));
      const meanA = group === "A" ? reduced : groupA.mean;
      const meanB = group === "B" ? reduced : groupB.mean;
      return { omitted: row.ticker, group, meanA, meanB, spread: meanA - meanB, passes: meanA - meanB > test.threshold };
    });
  });
  const unstable = leaveOneOut.some((r) => r.passes !== passes) || (groupA.median - groupB.median > test.threshold) !== passes;
  return {
    id: test.id,
    description: test.description,
    outcome: passes ? "supports" : "contradicts",
    interpretationOutcome: unstable ? "mixed" : passes ? "supports" : "contradicts",
    sensitivity: { groupA, groupB, spread, threshold: test.threshold, leaveOneOut, unstable },
    detail: `Common ${matched.label}. Group A mean ${fmtMetric(test.metric, a.mean)} (n=${a.n}), median ${fmtMetric(test.metric, groupA.median)}; group B mean ${fmtMetric(test.metric, b.mean)} (n=${b.n}), median ${fmtMetric(test.metric, groupB.median)}; spread ${pp(spread)}. ${passes ? "Mean rule met." : "Mean rule not met."} ${unstable ? "The sign changes under median or leave-one-out checks: sample-sensitive, not a broad falsification of operating leverage." : "This is a small descriptive peer screen, not a causal test."}`,
    evidenceIds,
    period: matched.label,
    evidenceRelations: evidenceIds.map((evidenceId) => ({ evidenceId, stance: "context", reason: "Input to a peer-group comparison. The group mean's outcome is not the direction of this individual company's evidence." })),
  };
}

export function evaluateTrigger(trigger: TriggerConfig, hypothesisId: string, ctx: ThesisContext): TriggerResult {
  const base = { id: trigger.id, hypothesisId, description: trigger.description };
  if (trigger.kind === "kpi-consecutive") {
    const view = ctx.kpis.get(trigger.kpiId);
    const recent = view?.readings.slice(-trigger.count) ?? [];
    const values = recent.map((r) => r.yoy);
    if (recent.length < trigger.count || values.some((v) => v === null)) {
      return { ...base, state: "insufficient-data", detail: "Not enough recent readings.", lastChecked: view?.latest?.date ?? null, evidenceIds: existing(ctx, [`EV-KPI-${trigger.kpiId}`]) };
    }
    const fired = values.every((v) => compare(v as number, trigger.op, trigger.threshold));
    return {
      ...base,
      state: fired ? "triggered" : "holding",
      detail: `Last ${trigger.count} YoY readings: ${values.map((v) => pct(v as number)).join(", ")}.`,
      lastChecked: view?.latest?.date ?? null,
      evidenceIds: existing(ctx, [`EV-KPI-${trigger.kpiId}`]),
    };
  }
  if (trigger.kind === "kpi-latest") {
    const { value, evidenceIds } = kpiValue(ctx, trigger.kpiId, trigger.metric);
    const date = trigger.metric === "fuelResidual" ? ctx.residuals.get(trigger.kpiId)?.latest?.date ?? null : ctx.kpis.get(trigger.kpiId)?.latest?.date ?? null;
    if (value === null) return { ...base, state: "insufficient-data", detail: "Value unavailable.", lastChecked: date, evidenceIds };
    return { ...base, state: compare(value, trigger.op, trigger.threshold) ? "triggered" : "holding", detail: `Latest ${fmtMetric(trigger.metric, value)}.`, lastChecked: date, evidenceIds };
  }
  const company = ctx.companies.get(trigger.ticker);
  const rows = (company?.quarters ?? []).filter((r) => r.ttmOperatingMargin !== null);
  const changes = rows.slice(-(trigger.count + 1)).map((r, i, arr) => (i === 0 ? null : (r.ttmOperatingMargin as number) - (arr[i - 1].ttmOperatingMargin as number))).slice(1);
  if (changes.length < trigger.count) {
    return { ...base, state: "insufficient-data", detail: "Not enough quarters.", lastChecked: rows.at(-1)?.end ?? null, evidenceIds: existing(ctx, [`EV-${trigger.ticker}-OM`]) };
  }
  const fired = changes.every((c) => compare(c as number, trigger.op, trigger.threshold));
  return {
    ...base,
    state: fired ? "triggered" : "holding",
    detail: `Quarter-on-quarter change in TTM operating margin: ${changes.map((c) => pp(c as number)).join(", ")}.`,
    lastChecked: rows.at(-1)?.end ?? null,
    evidenceIds: existing(ctx, [`EV-${trigger.ticker}-OM`]),
  };
}

export function overallOutcome(tests: KpiTestResult[]): TestOutcome {
  const decided = tests.filter((t) => !t.diagnosticOnly && t.outcome !== "insufficient-data").map((t) => ({ ...t, outcome: t.interpretationOutcome ?? t.outcome }));
  if (decided.length === 0) return "insufficient-data";
  if (decided.every((t) => t.outcome === "supports")) return "supports";
  if (decided.every((t) => t.outcome === "contradicts")) return "contradicts";
  return "mixed";
}

export function evaluateHypotheses(hypotheses: HypothesisConfig[], ctx: ThesisContext): HypothesisView[] {
  return hypotheses.map((h) => {
    const tests = h.tests.map((t) => evaluateTest(t, ctx));
    const supporting = new Set<string>();
    const contradicting = new Set<string>();
    for (const t of tests) {
      for (const relation of t.evidenceRelations ?? []) {
        if (relation.stance === "supports") supporting.add(relation.evidenceId);
        if (relation.stance === "contradicts") contradicting.add(relation.evidenceId);
      }
    }
    return {
      id: h.id,
      title: h.title,
      statement: h.statement,
      stance: h.stance,
      marketNarrative: h.marketNarrative,
      tests,
      overall: overallOutcome(tests),
      supportingEvidenceIds: [...supporting],
      contradictingEvidenceIds: [...contradicting],
      triggers: h.triggers.map((tr) => evaluateTrigger(tr, h.id, ctx)),
      missingEvidence: h.missingEvidence,
    };
  });
}

/** Write each hypothesis outcome back onto the evidence it used. */
export function applyStances(evidence: Evidence[], hypotheses: HypothesisView[]): Evidence[] {
  const byId = new Map(evidence.map((e) => [e.id, { ...e, stance: { ...e.stance }, hypothesisIds: [...e.hypothesisIds] }]));
  for (const h of hypotheses) {
    for (const t of h.tests) {
      for (const relation of t.evidenceRelations ?? t.evidenceIds.map((evidenceId) => ({ evidenceId, stance: "context" as Stance, reason: "Context only; no individual direction established." }))) {
        const item = byId.get(relation.evidenceId);
        if (!item) continue;
        if (!item.hypothesisIds.includes(h.id)) item.hypothesisIds.push(h.id);
        // Never overwrite a decided stance with "context".
        if (!item.stance[h.id] || item.stance[h.id] === "context") {
          item.stance[h.id] = relation.stance;
          item.stanceReasons = { ...item.stanceReasons, [h.id]: relation.reason };
        }
      }
    }
  }
  return [...byId.values()];
}
