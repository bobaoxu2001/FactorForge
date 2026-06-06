/**
 * Configured catalyst templates — the deterministic "demo catalyst engine".
 *
 * This is NOT live news. It is a curated map of market themes → public-market
 * proxy baskets → catalyst drivers → scenario shape. The {@link ./hotspotAgent}
 * resolves each proxy against the live research universe and modulates the
 * scenario ranges with the current market regime, so the output is "generated
 * from configured catalyst templates and market data" — never fabricated news.
 *
 * To connect production data, a live news/search adapter would replace the
 * static `catalystSummary` / `catalysts` here while keeping the same shape.
 */

import { constituentOf, DEFAULT_SYMBOLS } from "@/data/watchlist";
import type {
  CatalystItem,
  ProxyRef,
  ScenarioLeg,
  SignalModel,
  ThemeAssetType,
} from "./types";

const UNIVERSE = new Set(DEFAULT_SYMBOLS.map((s) => s.toUpperCase()));

interface ProxyTemplate {
  symbol: string;
  /** Fallback name for symbols outside the research universe. */
  name: string;
  role: "core" | "adjacent";
  catalystBeta: number;
}

interface ScenarioTemplate {
  case: ScenarioLeg["case"];
  label: string;
  impactLow: number;
  impactHigh: number;
  probability: number;
  narrative: string;
}

export interface ThemeTemplate {
  id: string;
  title: string;
  tagline: string;
  assetType: ThemeAssetType;
  assetTypeNote?: string;
  sectorTags: string[];
  signalModel: SignalModel;
  /** Base confidence before regime/coverage adjustments (0–100). */
  baseConfidence: number;
  catalystSummary: string;
  catalysts: CatalystItem[];
  proxyTemplates: ProxyTemplate[];
  scenarioTemplate: ScenarioTemplate[];
  riskFlags: string[];
  researchNote: string;
  suggestedResearchTest: string;
}

/** Resolve a proxy template against the live universe (sets inUniverse, name). */
export function resolveProxy(t: ProxyTemplate): Omit<ProxyRef, "live"> {
  const inUniverse = UNIVERSE.has(t.symbol.toUpperCase());
  const name = constituentOf(t.symbol)?.name ?? t.name;
  return { symbol: t.symbol, name, role: t.role, inUniverse, catalystBeta: t.catalystBeta };
}

/**
 * The configured theme catalog. Order is the default display order; the agent
 * re-ranks by live signal strength.
 */
export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    id: "space-economy",
    title: "Space Economy / SpaceX Catalyst",
    tagline: "Launch cadence, Starlink scale, and defense-space demand",
    assetType: "private-market-catalyst",
    assetTypeNote:
      "SpaceX is a private company and is not directly tradable. It is analyzed here as a private-market catalyst and theme driver; exposure is expressed only through a public-market proxy basket.",
    sectorTags: ["Aerospace", "Defense", "Satellite", "Industrials"],
    signalModel: "growth",
    baseConfidence: 52,
    catalystSummary:
      "Starship test progress, Starlink subscriber growth, and government/NASA contract flow set the tape for listed space and defense-space proxies. SpaceX itself stays private, so the read-through is indirect.",
    catalysts: [
      { label: "Starship test progress", detail: "Flight-test milestones reset reusable-launch expectations across the sector.", sensitivity: 0.85 },
      { label: "Starlink growth", detail: "Subscriber and ARPU trajectory anchors satellite-internet comps.", sensitivity: 0.7 },
      { label: "NASA / government contracts", detail: "Award flow and budget lines drive defense-space backlog.", sensitivity: 0.75 },
      { label: "Private valuation changes", detail: "Secondary-market and tender valuations re-rate the private anchor.", sensitivity: 0.6 },
      { label: "Launch cadence", detail: "Launches per quarter is the throughput signal for the whole basket.", sensitivity: 0.65 },
      { label: "Satellite internet expansion", detail: "Coverage and direct-to-cell rollout widen the addressable market.", sensitivity: 0.6 },
    ],
    proxyTemplates: [
      { symbol: "RKLB", name: "Rocket Lab", role: "core", catalystBeta: 1.9 },
      { symbol: "ASTS", name: "AST SpaceMobile", role: "core", catalystBeta: 2.0 },
      { symbol: "LMT", name: "Lockheed Martin", role: "core", catalystBeta: 0.8 },
      { symbol: "NOC", name: "Northrop Grumman", role: "core", catalystBeta: 0.8 },
      { symbol: "BA", name: "Boeing", role: "adjacent", catalystBeta: 1.0 },
      { symbol: "TSLA", name: "Tesla", role: "adjacent", catalystBeta: 1.3 },
      { symbol: "ARKX", name: "ARK Space Exploration ETF", role: "core", catalystBeta: 1.4 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Cadence + contracts accelerate", impactLow: 0.08, impactHigh: 0.18, probability: 0.3, narrative: "Successful Starship milestones and fresh government awards lift high-beta space proxies; ETF and launch names lead." },
      { case: "base", label: "Steady execution", impactLow: -0.03, impactHigh: 0.06, probability: 0.45, narrative: "Incremental launch progress and stable Starlink growth keep the basket range-bound with a modest upward drift." },
      { case: "bear", label: "Setback or risk-off", impactLow: -0.12, impactHigh: -0.05, probability: 0.25, narrative: "A test failure, contract delay, or broad risk-off rotation pressures the highest-beta proxies most." },
    ],
    riskFlags: [
      "SpaceX is private — proxy basket only approximates the theme, not the company.",
      "High-beta names (RKLB, ASTS) can gap on single headlines; ranges are wide.",
      "Several proxies are outside the research universe — those carry no live factor read.",
    ],
    researchNote:
      "Treat the Space Economy as a catalyst theme, not a single position. The proxy basket spans pure-play launch (high beta) to diversified defense primes (low beta); a scenario that helps launch names may barely move the primes.",
    suggestedResearchTest:
      "Backtest a low-volatility filter on the defense-space primes (LMT, NOC) versus the high-beta launch proxies to size the beta spread before any paper observation.",
  },
  {
    id: "ai-infrastructure",
    title: "AI Infrastructure",
    tagline: "Accelerators, data-center capex, and power demand",
    assetType: "public-proxy",
    sectorTags: ["Technology", "Semiconductors", "Data Center"],
    signalModel: "growth",
    baseConfidence: 64,
    catalystSummary:
      "Hyperscaler capex guidance, accelerator supply, and data-center power constraints drive the AI-infrastructure complex. Coverage here is strong: several proxies are in the live research universe.",
    catalysts: [
      { label: "Hyperscaler capex", detail: "Cloud capex guidance sets the demand ceiling for accelerators.", sensitivity: 0.85 },
      { label: "Accelerator supply", detail: "GPU/ASIC lead times and allocation gate revenue recognition.", sensitivity: 0.8 },
      { label: "Data-center power", detail: "Grid and power-purchase constraints become the new bottleneck.", sensitivity: 0.65 },
      { label: "Model release cadence", detail: "Frontier-model launches pull forward inference demand.", sensitivity: 0.6 },
    ],
    proxyTemplates: [
      { symbol: "NVDA", name: "NVIDIA", role: "core", catalystBeta: 1.6 },
      { symbol: "MSFT", name: "Microsoft", role: "core", catalystBeta: 1.0 },
      { symbol: "GOOGL", name: "Alphabet", role: "core", catalystBeta: 1.0 },
      { symbol: "AMZN", name: "Amazon", role: "adjacent", catalystBeta: 1.0 },
      { symbol: "META", name: "Meta Platforms", role: "adjacent", catalystBeta: 1.1 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Capex re-acceleration", impactLow: 0.05, impactHigh: 0.12, probability: 0.35, narrative: "Raised capex guidance and tight accelerator supply extend the up-trend across the complex." },
      { case: "base", label: "Digestion", impactLow: -0.04, impactHigh: 0.05, probability: 0.45, narrative: "Demand stays strong but valuations consolidate as the market waits for ROI evidence." },
      { case: "bear", label: "Capex pause", impactLow: -0.14, impactHigh: -0.05, probability: 0.2, narrative: "Any hint of capex digestion or supply glut compresses multiples on the highest-beta names." },
    ],
    riskFlags: [
      "Crowded positioning — sentiment reversals can be sharp.",
      "Concentration: a few mega-caps dominate the basket's variance.",
    ],
    researchNote:
      "AI-infrastructure proxies are well-covered by the live universe, so signal strength here is largely data-driven rather than template-driven.",
    suggestedResearchTest:
      "Check the factor-attribution panel for these names to confirm the move is momentum-led rather than a broad-market beta artifact.",
  },
  {
    id: "semiconductors",
    title: "Semiconductors",
    tagline: "Cycle inflection, inventory, and export policy",
    assetType: "public-proxy",
    sectorTags: ["Technology", "Semiconductors"],
    signalModel: "growth",
    baseConfidence: 56,
    catalystSummary:
      "The semis cycle turns on inventory normalization, AI accelerator demand, and export-control headlines. Universe coverage is partial, so part of this read is template-based.",
    catalysts: [
      { label: "Inventory normalization", detail: "Channel inventory draw-down precedes earnings upgrades.", sensitivity: 0.75 },
      { label: "AI accelerator demand", detail: "Data-center silicon offsets soft consumer end-markets.", sensitivity: 0.8 },
      { label: "Export policy", detail: "Controls and licensing shift addressable demand by region.", sensitivity: 0.7 },
    ],
    proxyTemplates: [
      { symbol: "NVDA", name: "NVIDIA", role: "core", catalystBeta: 1.5 },
      { symbol: "AMD", name: "Advanced Micro Devices", role: "core", catalystBeta: 1.6 },
      { symbol: "AVGO", name: "Broadcom", role: "core", catalystBeta: 1.2 },
      { symbol: "TSM", name: "Taiwan Semiconductor", role: "core", catalystBeta: 1.1 },
      { symbol: "SMH", name: "VanEck Semiconductor ETF", role: "core", catalystBeta: 1.3 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Cycle upturn", impactLow: 0.06, impactHigh: 0.14, probability: 0.33, narrative: "Inventory normalizes into AI demand; the ETF and high-beta names re-rate together." },
      { case: "base", label: "Mid-cycle chop", impactLow: -0.05, impactHigh: 0.05, probability: 0.42, narrative: "Mixed end-markets keep the group rotational and headline-sensitive." },
      { case: "bear", label: "Demand air-pocket", impactLow: -0.15, impactHigh: -0.06, probability: 0.25, narrative: "An export shock or inventory glut hits the most cyclical proxies hardest." },
    ],
    riskFlags: [
      "Highly cyclical — drawdowns can exceed the broad market.",
      "Policy headlines (export controls) can gap the group overnight.",
    ],
    researchNote:
      "Only part of the semiconductor basket is in the live universe; out-of-universe proxies are reference-only.",
    suggestedResearchTest:
      "Compare the in-universe proxy's stress-adjusted score against the broad market to gauge cyclicality before observation.",
  },
  {
    id: "defense-aerospace",
    title: "Defense & Aerospace",
    tagline: "Budget cycles, backlog, and geopolitical demand",
    assetType: "public-proxy",
    sectorTags: ["Defense", "Aerospace", "Industrials"],
    signalModel: "macro",
    baseConfidence: 54,
    catalystSummary:
      "Defense budgets, order backlog, and geopolitical risk underpin the primes. The group historically offers lower beta and defensive characteristics in risk-off tape.",
    catalysts: [
      { label: "Budget appropriations", detail: "Defense budget trajectory anchors multi-year backlog.", sensitivity: 0.7 },
      { label: "Geopolitical demand", detail: "Conflict and deterrence spending lift order flow.", sensitivity: 0.65 },
      { label: "Program milestones", detail: "Major platform awards re-rate individual primes.", sensitivity: 0.55 },
    ],
    proxyTemplates: [
      { symbol: "LMT", name: "Lockheed Martin", role: "core", catalystBeta: 0.8 },
      { symbol: "NOC", name: "Northrop Grumman", role: "core", catalystBeta: 0.85 },
      { symbol: "RTX", name: "RTX Corp", role: "core", catalystBeta: 0.9 },
      { symbol: "BA", name: "Boeing", role: "adjacent", catalystBeta: 1.1 },
      { symbol: "HON", name: "Honeywell", role: "adjacent", catalystBeta: 0.8 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Budget + backlog tailwind", impactLow: 0.04, impactHigh: 0.1, probability: 0.32, narrative: "Rising budgets and fresh awards extend the primes' defensive up-trend." },
      { case: "base", label: "Steady backlog burn", impactLow: -0.03, impactHigh: 0.05, probability: 0.48, narrative: "Stable, lower-beta grind supported by multi-year backlog." },
      { case: "bear", label: "Budget or program risk", impactLow: -0.1, impactHigh: -0.03, probability: 0.2, narrative: "Budget delays or program setbacks pressure the group, though less than high-beta growth." },
    ],
    riskFlags: [
      "Program concentration — single-platform setbacks can dominate a prime's move.",
      "Mostly outside the live universe; HON is the in-universe read-through.",
    ],
    researchNote:
      "Defense primes are a classic lower-beta, defensive sleeve — relevant as a risk-off rotation destination, not a high-beta catalyst trade.",
    suggestedResearchTest:
      "Test whether the in-universe industrial proxy holds its trend when the market-stress score rises (defensive confirmation).",
  },
  {
    id: "energy-transition",
    title: "Energy Transition",
    tagline: "Renewables buildout, grid, and rate sensitivity",
    assetType: "public-proxy",
    sectorTags: ["Utilities", "Renewables", "Energy"],
    signalModel: "macro",
    baseConfidence: 55,
    catalystSummary:
      "Renewable capacity additions, grid investment, and interest-rate direction drive the transition complex. Rate-sensitive utilities in the live universe provide a real read-through.",
    catalysts: [
      { label: "Renewable capacity", detail: "Solar/wind additions and interconnection queues set growth.", sensitivity: 0.65 },
      { label: "Grid investment", detail: "Transmission capex supports regulated utility earnings.", sensitivity: 0.6 },
      { label: "Rate direction", detail: "Lower rates re-rate long-duration, capital-intensive names.", sensitivity: 0.7 },
    ],
    proxyTemplates: [
      { symbol: "NEE", name: "NextEra Energy", role: "core", catalystBeta: 1.0 },
      { symbol: "DUK", name: "Duke Energy", role: "adjacent", catalystBeta: 0.7 },
      { symbol: "TSLA", name: "Tesla", role: "adjacent", catalystBeta: 1.4 },
      { symbol: "ENPH", name: "Enphase Energy", role: "core", catalystBeta: 1.8 },
      { symbol: "ICLN", name: "iShares Global Clean Energy ETF", role: "core", catalystBeta: 1.3 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Rate relief + buildout", impactLow: 0.05, impactHigh: 0.12, probability: 0.3, narrative: "Falling rates and capacity additions lift rate-sensitive renewables and the clean-energy ETF." },
      { case: "base", label: "Range-bound", impactLow: -0.04, impactHigh: 0.05, probability: 0.45, narrative: "Steady regulated growth offset by rate uncertainty keeps the group rotational." },
      { case: "bear", label: "Higher-for-longer", impactLow: -0.12, impactHigh: -0.04, probability: 0.25, narrative: "Sticky rates pressure long-duration, capital-intensive renewables most." },
    ],
    riskFlags: [
      "Rate-sensitive — duration risk dominates near-term moves.",
      "High-beta pure-plays (ENPH, ICLN) are outside the live universe.",
    ],
    researchNote:
      "The in-universe utilities act as the lower-beta, rate-sensitive core; pure-play renewables amplify the same rate signal.",
    suggestedResearchTest:
      "Cross-check this theme against the Rate-Cut Sensitivity theme — they share the same rate driver and should move together.",
  },
  {
    id: "crypto-infrastructure",
    title: "Crypto Infrastructure",
    tagline: "Exchange volume, miners, and treasury proxies",
    assetType: "public-proxy",
    sectorTags: ["Crypto", "Financials", "Technology"],
    signalModel: "growth",
    baseConfidence: 44,
    catalystSummary:
      "Listed crypto infrastructure (exchanges, miners, treasury proxies) tracks digital-asset volume and spot prices. None of these proxies are in the live universe, so this read is fully template-based.",
    catalysts: [
      { label: "Exchange volume", detail: "Trading volume drives exchange take-rate revenue.", sensitivity: 0.75 },
      { label: "Spot price trend", detail: "Underlying crypto prices set miner and treasury-proxy beta.", sensitivity: 0.85 },
      { label: "Regulatory clarity", detail: "Rule-making shifts the addressable, compliant market.", sensitivity: 0.6 },
    ],
    proxyTemplates: [
      { symbol: "COIN", name: "Coinbase", role: "core", catalystBeta: 1.8 },
      { symbol: "MSTR", name: "MicroStrategy", role: "core", catalystBeta: 2.0 },
      { symbol: "MARA", name: "Marathon Digital", role: "core", catalystBeta: 2.0 },
      { symbol: "RIOT", name: "Riot Platforms", role: "core", catalystBeta: 1.9 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Volume + price up-cycle", impactLow: 0.1, impactHigh: 0.25, probability: 0.3, narrative: "Rising spot prices and volume lift the highest-beta miners and treasury proxies sharply." },
      { case: "base", label: "Choppy consolidation", impactLow: -0.08, impactHigh: 0.08, probability: 0.4, narrative: "Sideways crypto keeps the group volatile and headline-driven." },
      { case: "bear", label: "Risk-off + price drop", impactLow: -0.25, impactHigh: -0.1, probability: 0.3, narrative: "A risk-off leg and falling spot prices compound losses across the basket." },
    ],
    riskFlags: [
      "Extreme beta — among the most volatile proxies in any theme.",
      "Entire basket is outside the live universe — reference-only, no factor read.",
    ],
    researchNote:
      "With no in-universe coverage, signal strength here is anchored to the market regime plus the configured template, and labeled accordingly.",
    suggestedResearchTest:
      "If a live data adapter is connected, add at least one liquid proxy to the universe before drawing any observation conclusion.",
  },
  {
    id: "rate-cut-sensitivity",
    title: "Rate Cut Sensitivity",
    tagline: "Duration winners: REITs, utilities, and rate-geared financials",
    assetType: "macro-rotation",
    sectorTags: ["Real Estate", "Utilities", "Financials"],
    signalModel: "macro",
    baseConfidence: 60,
    catalystSummary:
      "Rate-path expectations re-rate long-duration assets. REITs and utilities in the live universe give a direct read on how the market is pricing cuts.",
    catalysts: [
      { label: "Rate-path repricing", detail: "Shifts in expected policy path move duration-sensitive names.", sensitivity: 0.85 },
      { label: "Inflation prints", detail: "CPI/PCE surprises reset the cut timeline.", sensitivity: 0.7 },
      { label: "Credit spreads", detail: "Spread widening offsets duration relief for levered names.", sensitivity: 0.55 },
    ],
    proxyTemplates: [
      { symbol: "O", name: "Realty Income", role: "core", catalystBeta: 1.1 },
      { symbol: "AMT", name: "American Tower", role: "core", catalystBeta: 1.0 },
      { symbol: "NEE", name: "NextEra Energy", role: "core", catalystBeta: 1.0 },
      { symbol: "DUK", name: "Duke Energy", role: "adjacent", catalystBeta: 0.7 },
      { symbol: "JPM", name: "JPMorgan Chase", role: "adjacent", catalystBeta: 0.8 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Cuts pulled forward", impactLow: 0.04, impactHigh: 0.1, probability: 0.32, narrative: "A dovish repricing lifts REITs and utilities as duration relief flows through." },
      { case: "base", label: "Data-dependent drift", impactLow: -0.03, impactHigh: 0.05, probability: 0.46, narrative: "Mixed inflation keeps the rate-sensitive complex rotational." },
      { case: "bear", label: "Higher-for-longer", impactLow: -0.1, impactHigh: -0.03, probability: 0.22, narrative: "Sticky inflation pushes cuts out; long-duration proxies de-rate." },
    ],
    riskFlags: [
      "Duration risk cuts both ways — a hawkish surprise reverses the thesis.",
      "REIT credit sensitivity can offset rate relief.",
    ],
    researchNote:
      "Well-covered by the live universe (REITs + utilities), so this theme's signal is largely data-driven.",
    suggestedResearchTest:
      "Confirm the rate-sensitive proxies are trending together (high pairwise correlation) before treating them as one bet.",
  },
  {
    id: "china-adr-rebound",
    title: "China ADR Rebound",
    tagline: "Policy stimulus and valuation mean-reversion",
    assetType: "public-proxy",
    sectorTags: ["China", "Technology", "Consumer"],
    signalModel: "growth",
    baseConfidence: 42,
    catalystSummary:
      "China ADRs trade on stimulus signals and depressed valuations. None of these proxies are in the live universe, so this read is template-based and labeled as such.",
    catalysts: [
      { label: "Policy stimulus", detail: "Fiscal/monetary support drives sharp sentiment reversals.", sensitivity: 0.85 },
      { label: "Valuation reset", detail: "Depressed multiples create mean-reversion potential.", sensitivity: 0.6 },
      { label: "ADR/listing risk", detail: "De-listing and audit headlines re-introduce tail risk.", sensitivity: 0.7 },
    ],
    proxyTemplates: [
      { symbol: "BABA", name: "Alibaba", role: "core", catalystBeta: 1.5 },
      { symbol: "PDD", name: "PDD Holdings", role: "core", catalystBeta: 1.8 },
      { symbol: "JD", name: "JD.com", role: "core", catalystBeta: 1.5 },
      { symbol: "KWEB", name: "KraneShares China Internet ETF", role: "core", catalystBeta: 1.4 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Stimulus surprise", impactLow: 0.08, impactHigh: 0.2, probability: 0.28, narrative: "A credible stimulus package triggers a sharp valuation re-rating across the ADR basket." },
      { case: "base", label: "Stabilization", impactLow: -0.05, impactHigh: 0.07, probability: 0.42, narrative: "Incremental support keeps the group volatile but range-bound." },
      { case: "bear", label: "Policy or listing shock", impactLow: -0.2, impactHigh: -0.07, probability: 0.3, narrative: "A policy disappointment or listing headline pressures the highest-beta ADRs." },
    ],
    riskFlags: [
      "Headline-driven — sharp, hard-to-time reversals in both directions.",
      "Entire basket is outside the live universe — reference-only.",
    ],
    researchNote:
      "Signal strength is anchored to the market regime and the configured template; treat as a watch theme until a live proxy is added.",
    suggestedResearchTest:
      "If connecting live data, add a liquid China-internet ETF proxy and re-run the scenario with a real factor read.",
  },
  {
    id: "risk-off-rotation",
    title: "Market Selloff / Risk-Off Rotation",
    tagline: "Defensive leadership when stress rises",
    assetType: "macro-rotation",
    sectorTags: ["Consumer Staples", "Utilities", "Health Care"],
    signalModel: "defensive",
    baseConfidence: 62,
    catalystSummary:
      "When the market-stress regime turns risk-off, leadership rotates to low-volatility staples, utilities, and health care. This theme's signal is driven directly by the live market-stress score.",
    catalysts: [
      { label: "Volatility expansion", detail: "Rising realized/implied vol pulls capital toward defensives.", sensitivity: 0.8 },
      { label: "Breadth deterioration", detail: "Falling participation confirms a defensive rotation.", sensitivity: 0.7 },
      { label: "Drawdown discipline", detail: "Deeper index drawdowns reward low-beta sleeves.", sensitivity: 0.6 },
    ],
    proxyTemplates: [
      { symbol: "PG", name: "Procter & Gamble", role: "core", catalystBeta: 0.6 },
      { symbol: "KO", name: "Coca-Cola", role: "core", catalystBeta: 0.6 },
      { symbol: "WMT", name: "Walmart", role: "core", catalystBeta: 0.7 },
      { symbol: "JNJ", name: "Johnson & Johnson", role: "core", catalystBeta: 0.6 },
      { symbol: "DUK", name: "Duke Energy", role: "adjacent", catalystBeta: 0.6 },
    ],
    scenarioTemplate: [
      { case: "bull", label: "Defensive leadership", impactLow: 0.02, impactHigh: 0.07, probability: 0.35, narrative: "In a risk-off leg, low-beta staples and utilities outperform on a relative basis and hold absolute value better." },
      { case: "base", label: "Mild rotation", impactLow: -0.02, impactHigh: 0.04, probability: 0.45, narrative: "A modest defensive tilt as the tape digests; absolute moves stay small." },
      { case: "bear", label: "Broad de-risking", impactLow: -0.08, impactHigh: -0.02, probability: 0.2, narrative: "In a full liquidation even defensives fall, just less than high-beta growth." },
    ],
    riskFlags: [
      "Defensives still fall in a broad liquidation — this is relative, not absolute, protection.",
      "A fast risk-on reversal leaves defensive leadership behind.",
    ],
    researchNote:
      "This theme is the inverse of the growth themes: its signal rises with the market-stress score, so it brightens exactly when the others dim.",
    suggestedResearchTest:
      "Compare the defensive proxies' current drawdown against the index in the stress diagnostics to quantify the protection.",
  },
];

export function findThemeTemplate(id: string): ThemeTemplate | undefined {
  return THEME_TEMPLATES.find((t) => t.id === id);
}
