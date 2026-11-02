import type { BusinessModel, KpiDefinition, Relationship, ValueChainNode } from "@/lib/intel/types";

/**
 * Configuration contract for a research project. A new industry is a new
 * config file plus a snapshot; the engine code does not change.
 *
 * Everything here is either (a) a definition, (b) a test to run against data,
 * or (c) a claim that must be resolved against a retrieved source excerpt.
 * No number in a config file is ever displayed as data.
 */

export interface CoverageCompany {
  ticker: string;
  /** Display name; the SEC legal name is kept separately on the company page. */
  displayName: string;
  focus: boolean;
  businessModel: BusinessModel;
  /** What to watch, phrased as a question rather than a view. */
  researchAngle: string;
  /** Peer-group key used by competitive comparisons. */
  group: "asset-based" | "non-asset";
}

/** A claim resolved against the latest 10-K excerpt that contains `contains`. */
export interface ExcerptClaim {
  id: string;
  ticker: string;
  topic: string;
  contains: string;
  claim: string;
  subject: string;
}

export interface RelationshipConfig extends Omit<Relationship, "status" | "evidenceIds"> {
  /** Excerpt claims that verify the relationship. Empty → inferred or hypothetical. */
  excerptClaimIds: string[];
  /** Used when no excerpt verifies it. */
  fallbackStatus: "inferred" | "hypothetical";
}

export type TestMetric = "yoy" | "yoy3m" | "fuelResidual";

export type Comparator = ">" | "<";

export type HypothesisTest =
  | {
      kind: "kpi-threshold";
      id: string;
      description: string;
      kpiId: string;
      metric: TestMetric;
      op: Comparator;
      threshold: number;
      /** When the comparison holds, does that support the hypothesis? */
      supportsWhenTrue: boolean;
    }
  | {
      kind: "company-group-spread";
      id: string;
      description: string;
      metric: "operatingMarginYoYChange" | "fuelShareYoYChange" | "revenueYoY";
      groupA: string[];
      groupB: string[];
      /** Supports when mean(groupA) − mean(groupB) > threshold. */
      threshold: number;
    }
  | {
      kind: "company-metric";
      id: string;
      description: string;
      metric: "fuelShareYoYChange" | "operatingMarginYoYChange" | "evEbitdaPercentile" | "relativeReturn6m";
      tickers: string[];
      op: Comparator;
      threshold: number;
      supportsWhenTrue: boolean;
    };

export type TriggerConfig =
  | {
      kind: "kpi-consecutive";
      id: string;
      description: string;
      kpiId: string;
      metric: "yoy";
      op: Comparator;
      threshold: number;
      count: number;
    }
  | {
      kind: "kpi-latest";
      id: string;
      description: string;
      kpiId: string;
      metric: "fuelResidual" | "yoy";
      op: Comparator;
      threshold: number;
    }
  | {
      kind: "company-consecutive";
      id: string;
      description: string;
      ticker: string;
      metric: "ttmOperatingMarginChange";
      op: Comparator;
      threshold: number;
      count: number;
    };

export interface HypothesisConfig {
  id: string;
  title: string;
  statement: string;
  stance: "bullish" | "bearish" | "neutral";
  /** The narrative being tested, described without claiming consensus data we do not have. */
  marketNarrative: string;
  tests: HypothesisTest[];
  triggers: TriggerConfig[];
  missingEvidence: string[];
}

export interface StakeholderCategory {
  id: string;
  label: string;
  why: string;
  hypothesisIds: string[];
  questions: string[];
  cautions: string[];
}

export interface FieldworkPlan {
  purpose: string;
  cohorts: Array<{
    stakeholderId: string;
    targetInterviews: number;
    role: string;
    recruitment: string;
    coverage: string;
    question: string;
    crossCheck: string;
  }>;
  protocol: string[];
}

export interface MissingDataSource {
  id: string;
  name: string;
  why: string;
  access: "licensed" | "public-not-connected" | "user-provided";
  requirement: string;
}

export interface ResearchProjectConfig {
  id: string;
  title: string;
  subtitle: string;
  industry: string;
  researchQuestion: string;
  objectives: string[];
  createdAt: string;
  kpis: KpiDefinition[];
  /** Derived KPIs computed from two connected series (numerator ÷ denominator). */
  derivedKpis: Array<KpiDefinition & { numerator: string; denominator: string }>;
  fuelKpiId: string;
  leadLagPairs: Array<{ leader: string; follower: string; rationale: string }>;
  companies: CoverageCompany[];
  sectorBenchmark: { symbol: string; name: string };
  marketBenchmark: { symbol: string; name: string };
  valueChain: { nodes: ValueChainNode[]; relationships: RelationshipConfig[] };
  excerptClaims: ExcerptClaim[];
  marketStructure: Array<{ heading: string; points: string[]; excerptClaimIds: string[] }>;
  hypotheses: HypothesisConfig[];
  openQuestions: string[];
  stakeholders: StakeholderCategory[];
  /** Proposed fieldwork only; these targets are never counted as interviews. */
  fieldworkPlan?: FieldworkPlan;
  missingData: MissingDataSource[];
  complianceNotes: string[];
}
