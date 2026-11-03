/**
 * Research-platform domain types.
 *
 * The rule that shapes all of them: a value or claim always carries where it
 * came from and what kind of thing it is. "Evidence" from a filing, a number a
 * user typed in from an interview, a question the copilot drafted, and an
 * analyst's assumption are different objects. They are never interchangeable,
 * and only the first kind can be marked verified against a source.
 */

// ── Provenance ──────────────────────────────────────────────────────────────

export type SourceType =
  | "sec-xbrl"
  | "sec-filing"
  | "company-release"
  | "government-dataset"
  | "industry-dataset"
  | "market-data"
  | "user-primary-research"
  | "user-upload"
  | "ai-generated"
  | "analyst-hypothesis";

/** What kind of thing an evidence item is. Drives what it may be used for. */
export type EvidenceOrigin = "public-secondary" | "user-primary" | "ai-generated" | "template-generated" | "hypothesis";

export type VerificationStatus = "verified" | "partially-verified" | "unverified" | "contradicted" | "stale";

export type Confidence = "high" | "medium" | "low";

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  /** Canonical URL. Absent only for user-provided material (then `documentRef`). */
  url?: string;
  documentRef?: string;
  sourceType: SourceType;
  licence?: string;
  retrievedAt: string;
  publishedAt?: string;
}

export type Stance = "supports" | "contradicts" | "context";

export interface Evidence {
  id: string;
  projectId: string;
  /** Research subject, e.g. "Truckload pricing". */
  subject: string;
  /** The extracted claim, stated as narrowly as the source supports. */
  claim: string;
  /** Supporting excerpt or the data point(s) behind the claim. */
  excerpt?: string;
  /** Where in the source: XBRL concept + accession, FRED series + observation, 10-K Item. */
  location?: string;
  source: SourceRef;
  origin: EvidenceOrigin;
  status: VerificationStatus;
  confidence: Confidence;
  confidenceRationale: string;
  observationPeriod?: { start?: string; end: string };
  publishedAt?: string;
  retrievedAt: string;
  kpiIds: string[];
  tickers: string[];
  hypothesisIds: string[];
  stance: Record<string, Stance>;
  stanceReasons?: Record<string, string>;
}

// ── Time series & KPIs ──────────────────────────────────────────────────────

export type SeriesFrequency = "weekly" | "monthly" | "quarterly";

export type IndicatorTiming = "leading" | "coincident" | "lagging";

export type KpiCategory = "volume" | "pricing" | "cost" | "capacity" | "demand-driver" | "margin" | "spend";

export interface KpiDefinition {
  id: string;
  name: string;
  definition: string;
  category: KpiCategory;
  units: string;
  frequency: SeriesFrequency;
  seasonalAdjustment: "SA" | "NSA" | "n/a";
  timing: IndicatorTiming;
  /** Why we believe this timing; it is a hypothesis the lead-lag panel tests. */
  timingRationale: string;
  collectionMethod: string;
  comparabilityNotes: string[];
  /** Connected source (FRED id). Absent = defined but not connected. */
  sourceSeriesId?: string;
  /** Typical publication lag in days after the period ends. */
  publicationLagDays: number;
  /** Which way is "good" for the freight-recovery thesis, for display only. */
  recoveryDirection?: "up" | "down";
}

export type Freshness = "fresh" | "lagging" | "stale";

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface KpiReading {
  date: string;
  value: number;
  yoy: number | null;
  /** Month-over-month for monthly series, week-over-week for weekly. */
  change: number | null;
  /** Z-score of the YoY change against its own trailing 36-observation history. */
  zScore: number | null;
  anomaly: boolean;
}

export interface KpiSeriesView {
  kpi: KpiDefinition;
  source: SourceRef & {
    seriesId: string;
    sourceAgency: string | null;
    release: string | null;
    sourceUpdated: string | null;
    nextRelease: string | null;
    notes: string | null;
    excluded: string | null;
  };
  readings: KpiReading[];
  latest: KpiReading | null;
  freshness: Freshness;
  freshnessNote: string;
  missingValues: number;
}

// ── Companies & financials ──────────────────────────────────────────────────

export type BusinessModel =
  | "asset-based truckload"
  | "asset-based LTL"
  | "intermodal + dedicated"
  | "non-asset broker"
  | "asset-light agent network";

export interface FilingRef {
  form: string;
  filed: string;
  reportDate: string | null;
  accession: string;
  kind: "annual-report" | "quarterly-report" | "earnings-release";
  url: string;
}

export type Derivation = "reported-3m" | "ytd-difference" | "fy-minus-9m" | "instant";

export interface QuarterValue {
  /** Fiscal period end date (YYYY-MM-DD). */
  end: string;
  start: string | null;
  value: number;
  derivation: Derivation;
  /** First filing date among the facts used (point-in-time availability). */
  filed: string;
  accession: string;
  form: string;
  /** True when a later filing reported a different value for any fact used. */
  revised: boolean;
  /** Value as of the latest filing, when it differs from the first-reported value. */
  latestValue: number | null;
}

export interface MetricSeries {
  key: string;
  concept: string | null;
  label: string | null;
  unit: string;
  quarters: QuarterValue[];
}

// ── Industry map ────────────────────────────────────────────────────────────

export type RelationshipStatus = "verified" | "inferred" | "hypothetical";

export interface ValueChainNode {
  id: string;
  label: string;
  layer: "input" | "capacity" | "intermediary" | "demand";
  description: string;
  tickers: string[];
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: "supplies" | "competes" | "contracts-capacity" | "serves" | "partners" | "cost-driver";
  label: string;
  status: RelationshipStatus;
  /** Evidence IDs that support the relationship (empty for inferred/hypothetical). */
  evidenceIds: string[];
  rationale: string;
}

// ── Hypotheses, triggers, scenarios ─────────────────────────────────────────

export type TestOutcome = "supports" | "contradicts" | "mixed" | "insufficient-data";

export interface KpiTestResult {
  id: string;
  description: string;
  outcome: TestOutcome;
  detail: string;
  evidenceIds: string[];
  /** Common reporting quarter for a financial peer comparison. */
  period?: string;
  diagnosticOnly?: boolean;
  /** A descriptive screen can fail while the broader hypothesis remains mixed. */
  interpretationOutcome?: TestOutcome;
  evidenceRelations?: Array<{ evidenceId: string; stance: Stance; reason: string }>;
  sensitivity?: {
    groupA: { members: Array<{ ticker: string; value: number }>; mean: number; median: number };
    groupB: { members: Array<{ ticker: string; value: number }>; mean: number; median: number };
    spread: number;
    threshold: number;
    leaveOneOut: Array<{ omitted: string; group: "A" | "B"; meanA: number; meanB: number; spread: number; passes: boolean }>;
    unstable: boolean;
  };
}

export type TriggerState = "holding" | "triggered" | "insufficient-data";

export interface TriggerResult {
  id: string;
  hypothesisId: string;
  description: string;
  state: TriggerState;
  detail: string;
  lastChecked: string | null;
  evidenceIds: string[];
}

export interface HypothesisView {
  id: string;
  title: string;
  statement: string;
  stance: "bullish" | "bearish" | "neutral";
  marketNarrative: string;
  tests: KpiTestResult[];
  overall: TestOutcome;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  triggers: TriggerResult[];
  missingEvidence: string[];
}

export type ScenarioCase = "bull" | "base" | "bear";

export interface ScenarioAssumption {
  case: ScenarioCase;
  label: string;
  revenueGrowth: number;
  operatingMargin: number;
  evToEbitda: number;
  rationale: string;
}

export interface ScenarioResult extends ScenarioAssumption {
  revenue: number;
  ebitda: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number | null;
  impliedReturn: number | null;
}

// ── Quality & memo ──────────────────────────────────────────────────────────

export type CheckState = "pass" | "warn" | "fail";

export interface QualityCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

export type MemoStatus = "exploratory" | "public-source" | "draft-incomplete-verification" | "evidence-backed";

export interface MemoSection {
  id: string;
  number: number;
  title: string;
  /** Paragraphs; each may cite evidence IDs inline as [EV-…]. */
  body: string[];
  evidenceIds: string[];
  /** Section-level caveat, e.g. "no consensus data source connected". */
  limitation?: string;
}
