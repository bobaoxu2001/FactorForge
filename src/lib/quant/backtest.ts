import type { BacktestAssumptions, BacktestResult, EquityPoint, StrategySignal, Trade } from "@/types/backtest";
import type { HistoricalPriceResult, MarketPrice } from "@/types/market";
import type { StrategyDefinition } from "@/types/strategy";
import { addDrawdown } from "./indicators";
import { calculateMetrics } from "./metrics";

export interface BacktestConfig {
  initialCapital?: number;
  positionFraction?: number;
  stopLossPct?: number;
  trailingStopPct?: number;
  maxHoldingDays?: number;
  slippageBps?: number;
  feePerTrade?: number;
}

interface SignalPlan {
  buy: boolean;
  sell?: boolean;
  reason: string;
}

export function runLongOnlyBacktest(
  definition: StrategyDefinition,
  market: HistoricalPriceResult,
  benchmark: HistoricalPriceResult,
  signalPlans: SignalPlan[],
  config: BacktestConfig = {},
): BacktestResult {
  const assumptions: BacktestAssumptions = {
    initialCapital: config.initialCapital ?? 100_000,
    positionFraction: config.positionFraction ?? 0.2,
    stopLossPct: config.stopLossPct ?? 0.08,
    trailingStopPct: config.trailingStopPct ?? 0.12,
    maxHoldingDays: config.maxHoldingDays ?? 45,
    execution: "next_open",
    slippageBps: config.slippageBps ?? 5,
    feePerTrade: config.feePerTrade ?? 1,
  };
  const {
    initialCapital,
    positionFraction,
    stopLossPct,
    trailingStopPct,
    maxHoldingDays,
    slippageBps,
    feePerTrade,
  } = assumptions;

  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = "";
  let entryFee = 0;
  let highWater = 0;
  let holdingDays = 0;
  const trades: Trade[] = [];
  const signals: StrategySignal[] = [];
  const rawCurve: Omit<EquityPoint, "drawdown">[] = [];
  const benchmarkStart = benchmark.prices[0]?.close ?? 1;
  const benchmarkByDate = new Map<string, number>();
  benchmark.prices.forEach((item) => benchmarkByDate.set(item.date, item.close));

  market.prices.forEach((price, index) => {
    const previousPlan = index > 0 ? signalPlans[index - 1] ?? { buy: false, reason: "no signal" } : { buy: false, reason: "no signal" };
    const previousPrice = market.prices[index - 1];
    // Prefer an exact date match for the benchmark close. If the benchmark
    // calendar has a gap on this date (holiday mismatch, late listing), fall
    // back to the positional close — approximate, but bounded to the same index
    // window so the benchmark equity can't run away from the strategy's timeline.
    const benchmarkPrice = benchmarkByDate.get(price.date) ?? benchmark.prices[Math.min(index, benchmark.prices.length - 1)]?.close ?? benchmarkStart;

    if (shares > 0) {
      holdingDays += 1;
      highWater = Math.max(highWater, price.close);
      const stopHit = price.close <= entryPrice * (1 - stopLossPct);
      const trailingHit = price.close <= highWater * (1 - trailingStopPct);
      const expired = holdingDays >= maxHoldingDays;
      const plannedSell = previousPlan.sell === true;
      const exitReason = stopHit ? "stop loss" : trailingHit ? "trailing stop" : expired ? "holding period" : plannedSell ? previousPlan.reason : null;

      if (exitReason) {
        const baseExitPrice = stopHit || trailingHit ? price.close : price.open;
        const exitPrice = applySlippage(baseExitPrice, slippageBps, "sell");
        const proceeds = shares * exitPrice;
        const exitFee = feePerTrade;
        const fees = entryFee + exitFee;
        const pnl = proceeds - shares * entryPrice - fees;
        cash += proceeds - exitFee;
        trades.push({
          entryDate,
          exitDate: price.date,
          entryPrice,
          exitPrice,
          shares,
          fees,
          slippage: Math.abs(baseExitPrice - exitPrice) * shares,
          pnl,
          returnPct: pnl / (shares * entryPrice + fees),
          holdingDays,
          exitReason,
        });
        signals.push({ date: price.date, type: "sell", price: exitPrice, reason: `${exitReason}; executed at ${stopHit || trailingHit ? "same-day close" : "next open"}` });
        shares = 0;
        entryPrice = 0;
        entryDate = "";
        entryFee = 0;
        highWater = 0;
        holdingDays = 0;
      }
    }

    if (shares === 0 && previousPlan.buy && index > 0) {
      const allocation = cash * positionFraction;
      const entryExecutionPrice = applySlippage(price.open, slippageBps, "buy");
      const nextShares = Math.floor((allocation - feePerTrade) / entryExecutionPrice);
      if (nextShares > 0) {
        shares = nextShares;
        cash -= shares * entryExecutionPrice + feePerTrade;
        entryPrice = entryExecutionPrice;
        entryDate = price.date;
        entryFee = feePerTrade;
        highWater = price.close;
        holdingDays = 0;
        signals.push({ date: price.date, type: "buy", price: entryExecutionPrice, reason: `${previousPlan.reason}; signal date ${previousPrice?.date ?? "n/a"}; executed next open` });
      }
    } else if (shares === 0 && previousPlan.reason !== "no signal" && previousPlan.buy === false && index > 0) {
      signals.push({ date: price.date, type: "observe", price: previousPrice?.close ?? price.close, reason: `${previousPlan.reason}; observed after completed bar` });
    }

    const positionValue = shares * price.close;
    rawCurve.push({
      date: price.date,
      equity: cash + positionValue,
      cash,
      positionValue,
      benchmarkEquity: initialCapital * (benchmarkPrice / benchmarkStart),
    });
  });

  const equityCurve = addDrawdown(rawCurve);
  const lastSignalDate = signals.length > 0 ? signals[signals.length - 1].date : null;
  const metrics = calculateMetrics(equityCurve, trades, lastSignalDate);
  const riskFlags = buildRiskFlags(metrics, market, definition);

  return {
    symbol: market.symbol,
    strategyId: definition.id,
    strategyName: definition.name,
    description: definition.description,
    type: definition.type,
    signals,
    trades,
    equityCurve,
    metrics,
    riskFlags,
    recommendation: buildRecommendation(metrics),
    assumptions,
    dataStatus: {
      provider: market.provider,
      isFallback: market.isFallback,
      message: market.message,
      updatedAt: market.updatedAt,
      adjusted: market.quality.adjusted,
    },
  };
}

function applySlippage(price: number, slippageBps: number, side: "buy" | "sell"): number {
  const multiplier = 1 + (side === "buy" ? 1 : -1) * (slippageBps / 10_000);
  return Number((price * multiplier).toFixed(4));
}

function buildRiskFlags(metrics: ReturnType<typeof calculateMetrics>, market: HistoricalPriceResult, definition: StrategyDefinition): string[] {
  const flags: string[] = [];
  if (market.isFallback) flags.push("Market data source is fallback/demo and should not be used for real research conclusions");
  if (metrics.tradeCount < 5) flags.push("Trade sample is limited; statistical confidence is low");
  if (metrics.maxDrawdown < -0.25) flags.push("Historical max drawdown is deep");
  if (metrics.sharpe < 0.5) flags.push("Risk-adjusted return is weak");
  definition.knownLimitations?.forEach((note) => flags.push(note));
  return flags;
}

function buildRecommendation(metrics: ReturnType<typeof calculateMetrics>): string {
  if (metrics.maxDrawdown < -0.35 || metrics.sharpe < 0) return "Reject: risk-return profile does not meet research threshold.";
  if (metrics.tradeCount < 5) return "Continue observing: sample size is too limited for paper observation.";
  if (metrics.sharpe > 1 && metrics.maxDrawdown > -0.25) return "Radar candidate: eligible for paper-observation queue.";
  return "Continue observing: wait for more signals and stability confirmation.";
}

export function emptySignalPlans(prices: MarketPrice[]): SignalPlan[] {
  return prices.map(() => ({ buy: false, reason: "no signal" }));
}
