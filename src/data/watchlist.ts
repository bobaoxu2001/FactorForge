export const DEFAULT_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "META",
  "GOOGL",
  "JPM",
  "SPY",
  "QQQ",
] as const;

export type DefaultSymbol = (typeof DEFAULT_SYMBOLS)[number];
