import type { BacktestResult } from "@/types/backtest";
import type { RadarCandidate } from "@/types/strategy";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function scoreBacktest(result: BacktestResult): number {
  const { metrics } = result;
  const annualScore = clamp((metrics.annualizedReturn + 0.02) / 0.12 * 100);
  const sharpeScore = clamp(metrics.sharpe / 1.5 * 100);
  const drawdownScore = clamp((metrics.maxDrawdown + 0.25) / 0.25 * 100);
  const winScore = clamp(metrics.winRate * 100);
  const tradeScore = metrics.tradeCount < 5 ? metrics.tradeCount * 12 : metrics.tradeCount > 80 ? 70 : 100;
  const overfitPenalty = result.riskFlags.some((flag) => flag.includes("sample")) ? 45 : result.riskFlags.some((flag) => flag.includes("fallback")) ? 25 : 0;
  return Math.round(
    annualScore * 0.25 +
      sharpeScore * 0.25 +
      drawdownScore * 0.2 +
      winScore * 0.1 +
      tradeScore * 0.1 +
      (100 - overfitPenalty) * 0.1,
  );
}

export function buildRadar(results: BacktestResult[]): RadarCandidate[] {
  return results
    .map((result) => {
      const score = scoreBacktest(result);
      const hardReject = result.metrics.maxDrawdown < -0.35 || result.metrics.sharpe < 0;
      const status: RadarCandidate["status"] =
        hardReject ? "rejected" :
        score >= 80 && result.metrics.maxDrawdown > -0.25 && result.metrics.sharpe > 1 && result.metrics.tradeCount >= 5
          ? "radar candidate"
          : score >= 70
            ? "continue observing"
            : "rejected";
      const reasons = buildReasons(result, score, status);
      return {
        rank: 0,
        score,
        status,
        result,
        reasons,
        nextAction: status === "radar candidate" ? "Eligible for simulated observation review" : status === "continue observing" ? "Keep collecting signal and stability evidence" : "Park outside the radar shortlist",
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function buildReasons(result: BacktestResult, score: number, status: RadarCandidate["status"]): string[] {
  const reasons = [`Composite score ${score}`];
  const includePositives = status !== "rejected";
  if (includePositives && result.metrics.sharpe > 1) reasons.push("Sharpe is above 1");
  if (includePositives && result.metrics.maxDrawdown > -0.25) reasons.push("Max drawdown is within the -25% threshold");
  if (result.metrics.tradeCount < 5) reasons.push("Fewer than 5 completed trades");
  if (result.metrics.maxDrawdown < -0.35) reasons.push("Max drawdown breaches rejection threshold");
  if (result.metrics.sharpe < 0) reasons.push("Sharpe is negative");
  if (result.dataStatus.isFallback) reasons.push("Result includes fallback/demo market data label");
  if (status === "radar candidate") reasons.push("Meets simulated-observation admission rules");
  return reasons;
}
