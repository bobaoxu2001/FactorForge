import type { BacktestResult } from "@/types/backtest";
import { pct, num } from "@/lib/utils/format";

export interface StrategyExplanation {
  summary: string;
  whyItWorks: string;
  keyRisks: string;
  nextStep: string;
  confidenceLevel: "low" | "medium" | "high";
}

export function generateStrategyExplanation(result: BacktestResult): StrategyExplanation {
  const { metrics } = result;
  const confidenceLevel =
    result.dataStatus.isFallback || metrics.tradeCount < 5 ? "low" :
    metrics.sharpe > 1.2 && metrics.maxDrawdown > -0.2 ? "high" : "medium";

  const dataBasis = result.dataStatus.isFallback ? "fallback/demo-data" : result.dataStatus.adjusted ? "adjusted real-data" : "real-data";
  const summary = `${result.strategyName} on ${result.symbol} produced a ${dataBasis} backtest annualized return of ${pct(metrics.annualizedReturn)}, Sharpe ${num(metrics.sharpe)}, and max drawdown ${pct(metrics.maxDrawdown)}.`;
  const whyItWorks =
    metrics.sharpe > 1 && metrics.maxDrawdown > -0.25
      ? "The return and drawdown profile is relatively balanced, suggesting the rule captures trend windows while retaining some defensive behavior in weaker tape."
      : metrics.annualizedReturn > 0.15
        ? "The strategy is more aggressive; returns appear concentrated in a smaller number of trend-continuation windows, so drawdown and trade concentration need monitoring."
        : "The strategy currently behaves more like an observation rule with limited return elasticity, useful as a pre-radar baseline.";
  const keyRisks = [
    metrics.tradeCount < 5 ? "Trade count is low; sample size is limited." : null,
    metrics.maxDrawdown < -0.25 ? "Historical drawdown is deep." : null,
    result.dataStatus.isFallback ? "Current market data is fallback/demo and should not be treated as real market validation." : null,
    result.riskFlags.join("；"),
  ].filter(Boolean).join(" ");
  const nextStep =
    confidenceLevel === "high"
      ? "Move into paper-observation mode and keep checking whether future signals preserve the same risk-return profile."
      : confidenceLevel === "medium"
        ? "Keep it on the radar and prioritize expanding the universe plus testing different market regimes."
        : "Add more real data and samples before considering paper observation.";

  return { summary, whyItWorks, keyRisks: keyRisks || "No major risk flag is currently triggered, but continued validation is still required.", nextStep, confidenceLevel };
}
