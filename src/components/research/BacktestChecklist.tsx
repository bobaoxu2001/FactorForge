import type { BacktestResult } from "@/types/backtest";

export default function BacktestChecklist({ result }: { result: BacktestResult }) {
  const checks = [
    { name: "Real market data or explicit fallback label", passed: !result.dataStatus.isFallback },
    { name: "At least 5 completed trades", passed: result.metrics.tradeCount >= 5 },
    { name: "Sharpe > 1", passed: result.metrics.sharpe > 1 },
    { name: "Max drawdown better than -25%", passed: result.metrics.maxDrawdown > -0.25 },
    { name: "No same-bar fills: signals execute at next open", passed: result.assumptions.execution === "next_open" },
    { name: "Costs included: slippage and fees are modeled", passed: result.assumptions.slippageBps > 0 || result.assumptions.feePerTrade > 0 },
  ];

  return (
    <div className="card divide-soft">
      {checks.map((check) => (
        <div key={check.name} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
          <span className="text-ink">{check.name}</span>
          <span className={`chip ${check.passed ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200" : "border-rose-400/35 bg-rose-500/12 text-rose-200"}`}>
            {check.passed ? "passed" : "watch"}
          </span>
        </div>
      ))}
    </div>
  );
}
