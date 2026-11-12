import { GLOSSARY } from "@/data/glossary";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { UNIVERSE } from "@/data/watchlist";
import { RESEARCH_PROJECTS } from "@/data/research/projects";

export interface SearchItem {
  title: string;
  href: string;
  category: "Route" | "Company" | "Symbol" | "Strategy" | "Factor" | "Report" | "Glossary" | "Maintainer";
  description: string;
  keywords: string[];
}

/**
 * Curated route entries. Everything data-shaped (symbols, strategy detail
 * pages, glossary terms) is derived below from its single source of truth —
 * UNIVERSE, STRATEGY_CATALOG, GLOSSARY — so adding a symbol or a glossary
 * entry makes it searchable automatically instead of silently drifting out
 * of ⌘K. A guard test asserts the derived sections stay complete.
 */
const ROUTE_ITEMS: SearchItem[] = [
  {
    title: "Research Home",
    href: "/",
    category: "Route",
    description: "Active research projects, coverage, catalysts, evidence and research tasks.",
    keywords: ["home", "research", "workspace", "coverage", "catalysts", "tasks"],
  },
  {
    title: "Freight case study: Is the U.S. freight recovery real?",
    href: "/research/freight",
    category: "Report",
    description: "End-to-end research project: value chain, evidence, KPIs, companies, hypotheses, memo.",
    keywords: ["freight", "trucking", "knx", "jbht", "chrw", "case study", "recovery", "channel check"],
  },
  {
    title: "Event radar",
    href: "/events",
    category: "Route",
    description: "Material events with verification state, lifecycle, affected industries, measured market reaction and thesis impact.",
    keywords: ["events", "radar", "news", "verification", "breach", "regulation", "moratorium", "selloff"],
  },
  {
    title: "AI data-center restrictions and the 5 Nov 2026 selloff",
    href: "/events/ai-datacenter-shock/brief",
    category: "Report",
    description: "Public-source brief on policy risk, company economics and the 5 November selloff; causality remains unestablished.",
    keywords: ["ai", "data center", "moratorium", "texas", "new york", "nasdaq", "nvda", "vrt", "ceg", "vst", "power", "grid"],
  },
  {
    title: "Binance security incident, 29 Oct 2026",
    href: "/events/binance-breach/brief",
    category: "Report",
    description: "What failed, frozen versus recovered, AI-tool role, and transmission to crypto assets and US-listed crypto and security stocks.",
    keywords: ["binance", "hack", "breach", "crypto", "bnb", "btc", "coin", "cybersecurity", "frozen"],
  },
  {
    title: "Thesis tracker",
    href: "/theses",
    category: "Route",
    description: "Original theses, assumptions, revision history, invalidation triggers and outcomes.",
    keywords: ["thesis", "revision", "invalidation", "triggers", "tracker"],
  },
  {
    title: "Forecast scorecard",
    href: "/forecasts",
    category: "Route",
    description: "Hash-chained forecast ledger, realized outcomes versus benchmarks, and the baseline's out-of-sample record.",
    keywords: ["forecast", "scorecard", "calibration", "brier", "coverage", "walk-forward", "ledger"],
  },
  {
    title: "Industry map (freight value chain)",
    href: "/research/freight/industry",
    category: "Route",
    description: "Value-chain graph with relationships verified against 10-K text.",
    keywords: ["industry", "value chain", "suppliers", "customers", "competitors", "map"],
  },
  {
    title: "KPI trends",
    href: "/research/freight/kpis",
    category: "Factor",
    description: "Freight KPIs with freshness, anomalies, fuel-adjusted pricing and lead-lag.",
    keywords: ["kpi", "tonnage", "cass", "ppi", "diesel", "leading indicator", "lead lag"],
  },
  {
    title: "Competitive intelligence",
    href: "/research/freight/companies",
    category: "Route",
    description: "Peer matrix from SEC XBRL: growth, margins, FCF, leverage, valuation.",
    keywords: ["competitors", "peers", "valuation", "margin", "xbrl", "sec"],
  },
  {
    title: "Evidence explorer",
    href: "/research/freight/evidence",
    category: "Report",
    description: "Trace every claim to its source with verification status.",
    keywords: ["evidence", "sources", "citations", "verified", "provenance"],
  },
  {
    title: "Primary research & channel checks",
    href: "/research/freight/primary",
    category: "Route",
    description: "Interview plan, guides, compliance screening and your private notes.",
    keywords: ["interviews", "channel checks", "primary research", "mnpi", "compliance"],
  },
  {
    title: "Thesis & decision support",
    href: "/research/freight/thesis",
    category: "Route",
    description: "Hypothesis tests, invalidation triggers, scenarios, portfolio context, outcome review.",
    keywords: ["thesis", "scenarios", "bull", "bear", "invalidation", "attribution", "review"],
  },
  {
    title: "Research memo",
    href: "/research/freight/memo",
    category: "Report",
    description: "19-section editable, exportable research memo with citations.",
    keywords: ["memo", "report", "export", "markdown", "investment memo"],
  },
  {
    title: "AI research copilot",
    href: "/research/freight/copilot",
    category: "Route",
    description: "Evidence-grounded research assistant with citation validation.",
    keywords: ["copilot", "ai", "assistant", "llm", "deepseek", "grounded"],
  },
  {
    title: "KPI frameworks",
    href: "/research/frameworks",
    category: "Route",
    description: "KPI definitions for freight, software, retail and healthcare.",
    keywords: ["frameworks", "saas", "retail", "healthcare", "arr", "same-store sales"],
  },
  {
    title: "Quant overview",
    href: "/quant",
    category: "Route",
    description: "Quant lab overview: model portfolio, stress mode, radar, and factor evidence.",
    keywords: ["quant", "overview", "model portfolio", "workbench", "demo"],
  },
  {
    title: "Learn (Stocks 101)",
    href: "/learn",
    category: "Route",
    description: "Plain-English guide to every quant term the platform uses.",
    keywords: ["learn", "stocks 101", "glossary", "beginner", "education", "plain english"],
  },
  {
    title: "Data",
    href: "/data",
    category: "Route",
    description: "Provider provenance, fallback policy, adjusted-close metadata.",
    keywords: ["provider", "fallback", "yahoo", "polygon", "alpha vantage", "ohlcv"],
  },
  {
    title: "Factors",
    href: "/factors",
    category: "Factor",
    description: "Momentum, volatility, trend, liquidity, and factor-return correlations.",
    keywords: ["momentum", "volatility", "trend", "liquidity", "rsi", "sma"],
  },
  {
    title: "Strategies",
    href: "/strategies",
    category: "Strategy",
    description: "Rule-based strategy cards with next-open backtests and modeled costs.",
    keywords: ["backtest", "slippage", "fees", "execution", "strategy"],
  },
  {
    title: "Radar",
    href: "/radar",
    category: "Route",
    description: "Composite ranking, rejection rules, and concentration gate.",
    keywords: ["screening", "score", "candidate", "rejected", "sharpe", "drawdown"],
  },
  {
    title: "Consensus",
    href: "/consensus",
    category: "Route",
    description: "Multi-strategy agreement and signal resonance.",
    keywords: ["agreement", "resonance", "multi-strategy", "confirmation"],
  },
  {
    title: "Portfolio",
    href: "/portfolio",
    category: "Route",
    description: "Score-weighted portfolio construction, benchmark, and effective bets.",
    keywords: ["weight", "correlation", "effective bets", "benchmark", "spy"],
  },
  {
    title: "AI Market",
    href: "/ai-market",
    category: "Report",
    description: "Template or LLM market memo from deterministic factor payloads.",
    keywords: ["llm", "template memo", "deepseek", "market memo", "prose", "stress"],
  },
  {
    title: "Quant Screen (model-ranked cross-section)",
    href: "/picks",
    category: "Route",
    description: "Model-ranked cross-sectional stock selection with regime-aware factor weights.",
    keywords: ["picks", "stock picks", "selection", "screen", "ranking", "cross-sectional", "potential"],
  },
  {
    title: "Market Hotspots",
    href: "/hotspots",
    category: "Route",
    description: "Coverage-weighted catalyst intelligence and scenario research across themes.",
    keywords: ["hotspots", "catalyst", "scenario", "theme", "news", "spacex", "pre-ipo"],
  },
  {
    title: "Paper Trading",
    href: "/paper-trading",
    category: "Route",
    description: "Simulated observation only; no live order execution or live trading.",
    keywords: ["paper", "simulated", "observation", "no broker", "no orders"],
  },
  {
    title: "Trade Simulator",
    href: "/simulator",
    category: "Route",
    description: "Interactive paper-trading desk: virtual cash, buy/sell at real prices, live return. No broker.",
    keywords: ["simulator", "simulate", "paper trade", "buy", "sell", "virtual", "practice", "game", "return", "portfolio", "炒股", "模拟"],
  },
  {
    title: "Track Record",
    href: "/track-record",
    category: "Route",
    description: "Public paper ledger performance receipt for outside viewers.",
    keywords: ["track record", "performance", "public", "share", "ledger", "paper", "receipt"],
  },
  {
    title: "Reports",
    href: "/reports",
    category: "Report",
    description: "Research cards where numbers come from the engine and prose from template or LLM.",
    keywords: ["reports", "research memo", "template memo", "llm memo"],
  },
  {
    title: "OSS & Maintainers",
    href: "/oss",
    category: "Maintainer",
    description: "Contribution areas, maintainer workflow, automation use cases, roadmap.",
    keywords: ["open source", "maintainer", "contributing", "codex", "roadmap", "release"],
  },
  {
    title: "My Watchlist",
    href: "/my-watchlist",
    category: "Route",
    description: "Optional saved preferences and watchlist area. Sign-in required.",
    keywords: ["watchlist", "account", "saved preferences", "sign in"],
  },
  {
    title: "Cache Admin",
    href: "/admin/cache",
    category: "Maintainer",
    description: "Protected cache diagnostics for backtest persistence and hit rates.",
    keywords: ["cache", "admin", "sqlite", "diagnostics", "protected"],
  },
];

/** Derive company coverage and briefs from the project registry, not the quant universe. */
const RESEARCH_ITEMS: SearchItem[] = RESEARCH_PROJECTS.flatMap((project) => [
  {
    title: `${project.industry} · one-page brief`,
    href: `/research/${project.id}/sample`,
    category: "Report" as const,
    description: `Read the conclusion, evidence, limitations and next validation steps for ${project.title}`,
    keywords: [project.id, project.industry, "brief", "sample", "one page", "research"],
  },
  ...project.companies.map((company) => ({
    title: company.ticker,
    href: `/research/${project.id}/companies/${company.ticker}`,
    category: "Company" as const,
    description: `${company.displayName} — ${company.researchAngle}`,
    keywords: [company.ticker, company.displayName, company.businessModel, project.id, project.industry, "company", "research", "filings", "margins", "valuation"],
  })),
]);

/** Keep evidence and business-impact paths searchable without bundling source ledgers into the client. */
const EVENT_RESEARCH_ITEMS: SearchItem[] = ROUTE_ITEMS
  .filter((item) => item.href.startsWith("/events/") && item.href.endsWith("/brief"))
  .flatMap((item) => [
    {
      title: `${item.title} · evidence`,
      href: item.href.replace(/\/brief$/, "/evidence"),
      category: "Report" as const,
      description: "Inspect dated sources, individual claims and verification limits for this case.",
      keywords: [...item.keywords, "evidence", "sources", "verification", "citations"],
    },
    {
      title: `${item.title} · business impact`,
      href: item.href.replace(/\/brief$/, "/impact"),
      category: "Report" as const,
      description: "Trace company exposure and economic mechanisms; distinguish sourced links from assumptions.",
      keywords: [...item.keywords, "impact", "company", "exposure", "economics"],
    },
  ]);

/** One entry per strategy detail page, straight from the catalog. */
const STRATEGY_ITEMS: SearchItem[] = STRATEGY_CATALOG.map((definition) => ({
  title: definition.name,
  href: `/strategies/${definition.id}`,
  category: "Strategy" as const,
  description: definition.description,
  keywords: [definition.id, definition.type, definition.defaultSymbol.toLowerCase(), "strategy", "backtest"],
}));

/** Every universe constituent — searchable by ticker, company name, or sector. */
const SYMBOL_ITEMS: SearchItem[] = UNIVERSE.map((constituent) => ({
  title: constituent.symbol,
  href: `/strategies?symbol=${constituent.symbol}`,
  category: "Symbol" as const,
  description: `${constituent.name} — filter strategy results for ${constituent.symbol}.`,
  keywords: [
    constituent.symbol.toLowerCase(),
    constituent.name.toLowerCase(),
    constituent.sector.toLowerCase(),
    constituent.kind,
    "symbol",
    "ticker",
    "watchlist",
  ],
}));

/** Every glossary term — deep-links to its anchor on /learn. */
const GLOSSARY_ITEMS: SearchItem[] = GLOSSARY.map((entry) => ({
  title: entry.term,
  href: `/learn#${entry.id}`,
  category: "Glossary" as const,
  description: entry.plain,
  keywords: [
    entry.id,
    ...(entry.aliases ?? []).map((alias) => alias.toLowerCase()),
    entry.category.toLowerCase(),
    "glossary",
    "learn",
  ],
}));

export const SEARCH_ITEMS: SearchItem[] = [
  ...ROUTE_ITEMS,
  ...RESEARCH_ITEMS,
  ...EVENT_RESEARCH_ITEMS,
  ...STRATEGY_ITEMS,
  ...SYMBOL_ITEMS,
  ...GLOSSARY_ITEMS,
];

const normalize = (value: string) => value.toLowerCase().replace(/[$]/g, "").replace(/[-–—/·]+/g, " ").replace(/\s+/g, " ").trim();

export function searchItems(query: string, limit = 8): SearchItem[] {
  if (limit <= 0) return [];
  const normalized = normalize(query);
  if (!normalized) return SEARCH_ITEMS.slice(0, limit);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return SEARCH_ITEMS
    .map((item) => {
      const title = normalize(item.title);
      const keywords = item.keywords.map(normalize);
      const haystack = normalize([
        item.title,
        item.category,
        item.description,
        ...item.keywords,
      ].join(" "));
      // A multi-word request must match every word: "Binance evidence"
      // must not return unrelated freight evidence just for sharing one term.
      if (!terms.every((term) => haystack.includes(term))) return { item, score: 0 };
      const score = (title === normalized ? 20 : 0) + terms.reduce((sum, term) => {
        if (title === term) return sum + 8;
        if (title.includes(term)) return sum + 5;
        if (keywords.some((keyword) => keyword.includes(term))) return sum + 3;
        if (haystack.includes(term)) return sum + 1;
        return sum;
      }, 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(b.item.category === "Company") - Number(a.item.category === "Company") || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item);
}
