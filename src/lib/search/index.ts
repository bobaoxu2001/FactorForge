export interface SearchItem {
  title: string;
  href: string;
  category: "Route" | "Symbol" | "Strategy" | "Factor" | "Report" | "Glossary" | "Maintainer";
  description: string;
  keywords: string[];
}

export const SEARCH_ITEMS: SearchItem[] = [
  {
    title: "Overview",
    href: "/",
    category: "Route",
    description: "Open-source AI-assisted quant research workbench overview.",
    keywords: ["home", "overview", "workbench", "demo", "safety", "maintainable"],
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
    keywords: ["llm", "template memo", "deepseek", "market memo", "prose"],
  },
  {
    title: "Paper Trading",
    href: "/paper-trading",
    category: "Route",
    description: "Simulated observation only; no broker connection or live trading.",
    keywords: ["paper", "simulated", "observation", "no broker", "no orders"],
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
  {
    title: "Quality Momentum Breakout",
    href: "/strategies/vcp-tight-breakout",
    category: "Strategy",
    description: "VCP-style breakout strategy details and memo.",
    keywords: ["vcp", "breakout", "nvda", "quality momentum"],
  },
  {
    title: "ATR Channel Expansion",
    href: "/strategies/keltner-atr-breakout",
    category: "Strategy",
    description: "Keltner/ATR breakout strategy details and memo.",
    keywords: ["atr", "keltner", "breakout", "msft"],
  },
  {
    title: "Defensive Trend Pullback",
    href: "/strategies/sma200-rsi-pullback",
    category: "Strategy",
    description: "SMA200 + RSI pullback strategy details and memo.",
    keywords: ["sma200", "rsi", "pullback", "aapl"],
  },
  {
    title: "EMA Continuation Signal",
    href: "/strategies/ema-trend-pullback",
    category: "Strategy",
    description: "EMA trend pullback strategy details and memo.",
    keywords: ["ema", "trend", "pullback", "amzn"],
  },
  {
    title: "Low-Volatility Rotation",
    href: "/strategies/lowvol-rotation-proxy",
    category: "Strategy",
    description: "Low-volatility rotation proxy strategy details and memo.",
    keywords: ["low vol", "rotation", "spy", "low-volatility"],
  },
  ...["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "SPY", "QQQ", "CVX"].map((symbol) => ({
    title: symbol,
    href: `/strategies?symbol=${symbol}`,
    category: "Symbol" as const,
    description: `Filter strategy results for ${symbol}.`,
    keywords: [symbol.toLowerCase(), "symbol", "ticker", "watchlist"],
  })),
  {
    title: "Sharpe ratio",
    href: "/learn#sharpe",
    category: "Glossary",
    description: "Plain-English glossary entry for risk-adjusted return.",
    keywords: ["sharpe", "risk adjusted", "glossary"],
  },
  {
    title: "Drawdown",
    href: "/learn#drawdown",
    category: "Glossary",
    description: "Plain-English glossary entry for peak-to-trough loss.",
    keywords: ["drawdown", "loss", "risk", "glossary"],
  },
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
