/**
 * Shared types for the deterministic market-research agent layer.
 *
 * The agent does NOT call live news/search APIs. Every field below is computed
 * from (a) configured catalyst templates (see {@link ./catalystMapper}) and
 * (b) the existing market-data pipeline (factor snapshots, market-stress regime,
 * radar candidates). Where a configured proxy symbol is outside the research
 * universe, its `live` block is null and `inUniverse` is false — the UI must
 * label those as reference-only rather than implying computed data.
 */

export type SignalDirection = "risk-on" | "risk-off" | "neutral" | "rotational";

/** How a theme's signal strength is derived from market data. */
export type SignalModel = "growth" | "defensive" | "macro";

export type ThemeAssetType = "public-proxy" | "private-market-catalyst" | "macro-rotation";

/** Live factor read for an in-universe proxy. Null for reference-only proxies. */
export interface ProxyLive {
  momentum20d: number | null;
  momentum60d: number | null;
  volatility20d: number | null;
  aboveSma200: boolean;
  rsi14: number | null;
  isFallback: boolean;
}

export interface ProxyRef {
  symbol: string;
  name: string;
  /** "core" = direct thematic exposure, "adjacent" = indirect read-through. */
  role: "core" | "adjacent";
  /** True only when the symbol is in the research universe with real price data. */
  inUniverse: boolean;
  /** Configured beta-like sensitivity to the theme catalyst (0.5 calm … 2.0 high-beta). */
  catalystBeta: number;
  /** Live factor read — populated only for in-universe proxies, else null. */
  live: ProxyLive | null;
}

export interface CatalystItem {
  label: string;
  detail: string;
  /** Configured 0–1 weight for how much this catalyst can move the proxy basket. */
  sensitivity: number;
}

export interface ScenarioLeg {
  case: "bull" | "base" | "bear";
  label: string;
  /** Estimated proxy-basket impact range bounds, e.g. low 0.08, high 0.18 (=+8%..+18%). */
  impactLow: number;
  impactHigh: number;
  /** Configured subjective probability weight; legs sum to ~1. */
  probability: number;
  narrative: string;
}

export interface HotspotScenario {
  legs: ScenarioLeg[];
  /** Probability-weighted midpoint across legs — an estimate, not a prediction. */
  expectedImpact: number;
  /** 0–100, lowered by regime uncertainty and thin data coverage. */
  confidence: number;
  /** 0–100 aggregate of configured catalyst sensitivities. */
  catalystSensitivity: number;
}

export interface StrategyRelevance {
  strategyId: string;
  strategyName: string;
  symbol: string;
  note: string;
}

export interface DataCoverage {
  inUniverse: number;
  total: number;
  usesFallback: boolean;
}

export interface HotspotTheme {
  id: string;
  title: string;
  tagline: string;
  assetType: ThemeAssetType;
  /** Honest note when the underlying driver is not a directly tradable public stock. */
  assetTypeNote?: string;
  sectorTags: string[];
  catalystSummary: string;
  catalysts: CatalystItem[];
  proxies: ProxyRef[];
  /** 0–100 thematic activity, derived from live proxies and/or the market regime. */
  signalStrength: number;
  sentiment: SignalDirection;
  sentimentLabel: string;
  regimeLabel: string;
  scenario: HotspotScenario;
  riskFlags: string[];
  strategyRelevance: StrategyRelevance[];
  researchNote: string;
  suggestedResearchTest: string;
  dataCoverage: DataCoverage;
  lastUpdated: string;
}

export interface AgentStep {
  id: string;
  label: string;
  detail: string;
  /** complete = ran on real data; demo = template logic; not-connected = needs live API. */
  status: "complete" | "demo" | "not-connected";
}

export interface HotspotAgentReport {
  themes: HotspotTheme[];
  /** Featured theme surfaced on previews — the Space Economy / SpaceX catalyst. */
  featured: HotspotTheme;
  agentSteps: AgentStep[];
  dataSource: {
    engine: string;
    newsConnected: boolean;
    note: string;
    marketDataNote: string;
    generatedAt: string;
  };
  regime: {
    label: string;
    stressScore: number;
    note: string;
  };
  disclaimer: string;
}
