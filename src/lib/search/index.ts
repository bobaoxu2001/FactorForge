import { GLOSSARY } from "@/data/glossary";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { UNIVERSE } from "@/data/watchlist";

export interface SearchItem {
  title: string;
  href: string;
  category: "Route" | "Symbol" | "Strategy" | "Factor" | "Report" | "Glossary" | "Maintainer";
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
    title: "Overview",
    href: "/",
    category: "Route",
    description: "Open-source AI-assisted quant research workbench overview.",
    keywords: ["home", "overview", "workbench", "demo", "safety", "maintainable"],
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
  ...STRATEGY_ITEMS,
  ...SYMBOL_ITEMS,
  ...GLOSSARY_ITEMS,
];

export function searchItems(query: string, limit = 8): SearchItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SEARCH_ITEMS.slice(0, limit);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return SEARCH_ITEMS
    .map((item) => {
      const haystack = [
        item.title,
        item.category,
        item.description,
        ...item.keywords,
      ].join(" ").toLowerCase();
      const score = terms.reduce((sum, term) => {
        if (item.title.toLowerCase() === term) return sum + 8;
        if (item.title.toLowerCase().includes(term)) return sum + 5;
        if (item.keywords.some((keyword) => keyword.toLowerCase().includes(term))) return sum + 3;
        if (haystack.includes(term)) return sum + 1;
        return sum;
      }, 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item);
}
