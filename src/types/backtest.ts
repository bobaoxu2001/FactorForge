export interface StrategySignal {
  date: string;
  type: "buy" | "sell" | "observe";
  price: number;
  reason: string;
}

export interface Trade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  fees: number;
  slippage: number;
  pnl: number;
  returnPct: number;
  holdingDays: number;
  exitReason: string;
}

export interface EquityPoint {
  date: string;
  equity: number;
  cash: number;
  positionValue: number;
  drawdown: number;
  benchmarkEquity: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  averageHoldingDays: number;
  volatility: number;
  currentPosition: "flat" | "long";
  lastSignalDate: string | null;
}

export interface BacktestAssumptions {
  initialCapital: number;
  positionFraction: number;
  stopLossPct: number;
  trailingStopPct: number;
  maxHoldingDays: number;
  execution: "next_open";
  slippageBps: number;
  feePerTrade: number;
}

export interface BacktestResult {
  symbol: string;
  strategyId: string;
  strategyName: string;
  description: string;
  type: string;
  signals: StrategySignal[];
  trades: Trade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
  riskFlags: string[];
  recommendation: string;
  assumptions: BacktestAssumptions;
  dataStatus: {
    provider: string;
    isFallback: boolean;
    message: string;
    updatedAt: string;
    adjusted: boolean;
  };
}
