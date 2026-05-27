import type { StrategyDefinition } from "@/types/strategy";

export const STRATEGY_CATALOG: StrategyDefinition[] = [
  {
    id: "vcp-tight-breakout",
    name: "Quality Momentum Breakout",
    description: "Identifies symbols near recent highs where volatility compression and healthy participation create a higher-quality breakout setup.",
    type: "breakout",
    defaultSymbol: "NVDA",
  },
  {
    id: "keltner-atr-breakout",
    name: "ATR Channel Expansion",
    description: "Uses EMA20 plus ATR expansion, volume confirmation, and a long-term trend filter to detect controlled range expansion.",
    type: "breakout",
    defaultSymbol: "MSFT",
  },
  {
    id: "sma200-rsi-pullback",
    name: "Defensive Trend Pullback",
    description: "Looks for RSI rebound behavior inside a longer-term SMA200 uptrend, prioritizing controlled mean reversion over aggressive entry.",
    type: "mean reversion",
    defaultSymbol: "AAPL",
  },
  {
    id: "ema-trend-pullback",
    name: "EMA Continuation Signal",
    description: "Searches for continuation after price reclaims EMA20 while remaining aligned with EMA50 and SMA200 trend structure.",
    type: "momentum",
    defaultSymbol: "AMZN",
  },
  {
    id: "lowvol-rotation-proxy",
    name: "Low-Volatility Rotation",
    description: "Ranks lower-volatility symbols with positive medium-term trend from the default watchlist; dividend inputs are not connected yet.",
    type: "rotation",
    defaultSymbol: "SPY",
    knownLimitations: ["dividend component not connected yet"],
  },
];
