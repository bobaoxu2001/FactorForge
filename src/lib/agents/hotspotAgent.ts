/**
 * Hotspot research agent (deterministic orchestrator).
 *
 * Combines configured catalyst templates with the live market-data pipeline
 * (factor snapshots, market-stress regime, radar candidates) to produce ranked
 * market hotspots with proxy baskets, scenario forecasts, strategy relevance,
 * and an honest agent-workflow/data-source status.
 *
 * No live news/search calls are made. The agent is structured as discrete steps
 * so a production build can later swap the "scan news/catalysts" step for a real
 * adapter without changing the downstream shape.
 */

import type { FactorSnapshot } from "@/types/market";
import type { RadarCandidate } from "@/types/strategy";
import { THEME_TEMPLATES, resolveProxy, type ThemeTemplate } from "./catalystMapper";
import { buildScenario, type RegimeContext } from "./scenarioForecast";
import type {
  AgentStep,
  HotspotAgentReport,
  HotspotTheme,
  ProxyRef,
  SignalDirection,
  StrategyRelevance,
} from "./types";

export interface HotspotAgentInput {
  factors: FactorSnapshot[];
  regime: { regime: string; stressScore: number };
  radarCandidates: RadarCandidate[];
  generatedAt: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function regimeLabelOf(regime: string): string {
  if (regime === "risk-off") return "Risk-off tape";
  if (regime === "risk-on") return "Risk-on tape";
  return "Neutral / mixed tape";
}

function attachLive(proxies: Omit<ProxyRef, "live">[], factorMap: Map<string, FactorSnapshot>): ProxyRef[] {
  return proxies.map((p) => {
    const f = p.inUniverse ? factorMap.get(p.symbol.toUpperCase()) : undefined;
    return {
      ...p,
      live: f
        ? {
            momentum20d: f.momentum20d,
            momentum60d: f.momentum60d,
            volatility20d: f.volatility20d,
            aboveSma200: f.aboveSma200,
            rsi14: f.rsi14,
            isFallback: f.isFallback,
          }
        : null,
    };
  });
}

/**
 * Growth-style signal from live proxy factor reads (0–100).
 *
 * Coverage-weighted: a theme with fewer than three in-universe proxies is
 * blended toward the regime baseline so a single name (often only an *adjacent*
 * proxy, e.g. TSLA for Space Economy) can't dominate the whole theme read. This
 * keeps thin-coverage themes honest rather than over-confident in one ticker.
 */
function proxyGrowthSignal(live: ProxyRef[], regimeTilt: number): number {
  const baseline = 50 - regimeTilt * 22;
  const withData = live.filter((p) => p.live);
  if (withData.length === 0) return baseline;
  const avgMom = mean(withData.map((p) => p.live!.momentum20d ?? 0));
  const breadth = mean(withData.map((p) => (p.live!.aboveSma200 ? 1 : 0)));
  const avgVol = mean(withData.map((p) => p.live!.volatility20d ?? 0.3));
  const avgRsi = mean(withData.map((p) => p.live!.rsi14 ?? 50));
  const raw = 50 + avgMom * 220 + (breadth - 0.5) * 36 + (avgRsi - 50) * 0.25 - Math.max(0, avgVol - 0.35) * 45;
  const coverageWeight = clamp(withData.length / 3, 0, 1);
  return coverageWeight * raw + (1 - coverageWeight) * baseline;
}

function computeSignalStrength(template: ThemeTemplate, live: ProxyRef[], regimeTilt: number, stressScore: number): number {
  if (template.signalModel === "defensive") {
    return Math.round(clamp(28 + stressScore * 0.62, 5, 95));
  }
  const g = proxyGrowthSignal(live, regimeTilt);
  if (template.signalModel === "growth") return Math.round(clamp(g, 5, 97));
  // macro: blend the proxy read with a mild regime component
  return Math.round(clamp(0.72 * g + 0.28 * (50 - regimeTilt * 16), 5, 95));
}

function sentimentOf(
  template: ThemeTemplate,
  signal: number,
  stressScore: number,
): { sentiment: SignalDirection; label: string } {
  if (template.signalModel === "defensive") {
    if (stressScore >= 55) return { sentiment: "risk-off", label: "Defensive leadership building" };
    if (stressScore >= 38) return { sentiment: "rotational", label: "Watching for rotation" };
    return { sentiment: "neutral", label: "Dormant — risk-on tape" };
  }
  if (signal >= 64) return { sentiment: "risk-on", label: "Constructive — trend intact" };
  if (signal <= 42) return { sentiment: "risk-off", label: "Under pressure" };
  return { sentiment: "rotational", label: "Rotational — mixed signal" };
}

function strategyRelevanceFor(template: ThemeTemplate, proxies: ProxyRef[], radar: RadarCandidate[]): StrategyRelevance[] {
  const proxySet = new Set(proxies.map((p) => p.symbol.toUpperCase()));
  return radar
    .filter((c) => proxySet.has(c.result.symbol.toUpperCase()))
    .slice(0, 3)
    .map((c) => ({
      strategyId: c.result.strategyId,
      strategyName: c.result.strategyName,
      symbol: c.result.symbol,
      note: `Holds ${c.result.symbol}, a basket proxy — currently ${c.status}.`,
    }));
}

function buildTheme(template: ThemeTemplate, input: HotspotAgentInput, factorMap: Map<string, FactorSnapshot>): HotspotTheme {
  const proxies = attachLive(template.proxyTemplates.map(resolveProxy), factorMap);
  const inUniverseWithData = proxies.filter((p) => p.live).length;
  const coverageRatio = proxies.length ? inUniverseWithData / proxies.length : 0;
  const usesFallback = proxies.some((p) => p.live?.isFallback);

  const stressScore = input.regime.stressScore;
  const regimeTilt = clamp((stressScore - 45) / 55, -1, 1);
  const signalStrength = computeSignalStrength(template, proxies, regimeTilt, stressScore);
  const { sentiment, label } = sentimentOf(template, signalStrength, stressScore);

  const ctx: RegimeContext = { stressScore, regime: input.regime.regime };
  const scenario = buildScenario(template, ctx, coverageRatio);

  return {
    id: template.id,
    title: template.title,
    tagline: template.tagline,
    assetType: template.assetType,
    assetTypeNote: template.assetTypeNote,
    sectorTags: template.sectorTags,
    catalystSummary: template.catalystSummary,
    catalysts: template.catalysts,
    proxies,
    signalStrength,
    sentiment,
    sentimentLabel: label,
    regimeLabel: regimeLabelOf(input.regime.regime),
    scenario,
    riskFlags: template.riskFlags,
    strategyRelevance: strategyRelevanceFor(template, proxies, input.radarCandidates),
    researchNote: template.researchNote,
    suggestedResearchTest: template.suggestedResearchTest,
    dataCoverage: { inUniverse: inUniverseWithData, total: proxies.length, usesFallback },
    lastUpdated: input.generatedAt,
  };
}

export function buildHotspotReport(input: HotspotAgentInput): HotspotAgentReport {
  const factorMap = new Map(input.factors.map((f) => [f.symbol.toUpperCase(), f]));
  const themes = THEME_TEMPLATES.map((t) => buildTheme(t, input, factorMap)).sort(
    (a, b) => b.signalStrength - a.signalStrength,
  );
  const featured = themes.find((t) => t.id === "space-economy") ?? themes[0];

  const universeSymbols = input.factors.length;
  const agentSteps: AgentStep[] = [
    { id: "scan-market", label: "Scan market data", detail: `Loaded factor snapshots for ${universeSymbols} universe symbols (Yahoo daily OHLCV).`, status: "complete" },
    { id: "scan-news", label: "Scan news / catalysts", detail: "News/search API not connected — using configured catalyst templates.", status: "not-connected" },
    { id: "detect-themes", label: "Detect themes", detail: `Ranked ${themes.length} configured themes by live signal strength.`, status: "complete" },
    { id: "map-proxies", label: "Map public proxies", detail: "Resolved proxy baskets against the research universe; out-of-universe proxies flagged reference-only.", status: "complete" },
    { id: "estimate-scenarios", label: "Estimate scenario impact", detail: "Bull/base/bear ranges generated from configured templates modulated by the live market-stress regime.", status: "demo" },
    { id: "rank-strategy", label: "Rank strategy relevance", detail: "Cross-referenced radar candidates against each theme's proxy basket.", status: "complete" },
    { id: "generate-memo", label: "Generate research memo", detail: "Research notes assembled from deterministic templates; connect an LLM/news API for live prose.", status: "demo" },
  ];

  return {
    themes,
    featured,
    agentSteps,
    dataSource: {
      engine: "Demo catalyst engine",
      newsConnected: false,
      note: "Scenario output generated from configured catalyst templates and market data. Connect a live news/search API for production.",
      marketDataNote: "Market data: Yahoo Finance daily OHLCV via the existing research pipeline (fallback rows labeled).",
      generatedAt: input.generatedAt,
    },
    regime: {
      label: regimeLabelOf(input.regime.regime),
      stressScore: input.regime.stressScore,
      note: "Scenario ranges are interpreted under the current market-stress regime.",
    },
    disclaimer:
      "Research and simulated observation only. Not investment advice, not a price prediction, and no order instruction. Scenario impact ranges are estimates for a public-market proxy basket, not forecasts for any private company.",
  };
}
