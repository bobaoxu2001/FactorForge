import type { StrategyDefinition } from "@/types/strategy";

export const STRATEGY_CATALOG: StrategyDefinition[] = [
  {
    id: "vcp-tight-breakout",
    name: "VCP Tight-Base Breakout Candidate",
    description: "Flags symbols near a recent high when volatility contracts and volume remains healthy enough for a breakout watch signal.",
    type: "breakout",
    defaultSymbol: "NVDA",
  },
  {
    id: "keltner-atr-breakout",
    name: "Keltner ATR Breakout Candidate",
    description: "Triggers when close breaks above the EMA20 + ATR channel with above-average volume and a SMA200 trend filter.",
    type: "breakout",
    defaultSymbol: "MSFT",
  },
  {
    id: "sma200-rsi-pullback",
    name: "SMA200 RSI Defensive Pullback",
    description: "Looks for RSI pullback rebounds while the long-term trend remains above the SMA200.",
    type: "mean reversion",
    defaultSymbol: "AAPL",
  },
  {
    id: "ema-trend-pullback",
    name: "EMA Trend Pullback Candidate",
    description: "Looks for trend continuation after price reclaims EMA20/EMA50 while remaining above EMA50 and SMA200.",
    type: "momentum",
    defaultSymbol: "AMZN",
  },
  {
    id: "lowvol-rotation-proxy",
    name: "Low-Volatility Rotation Proxy",
    description: "Selects lower 60-day volatility symbols with positive trend from the default watchlist; dividend component is not connected yet.",
    type: "rotation",
    defaultSymbol: "SPY",
  },
];
