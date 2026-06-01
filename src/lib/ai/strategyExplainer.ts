import type { BacktestResult } from "@/types/backtest";
import { pct, num } from "@/lib/utils/format";
import { boundedSet } from "@/lib/utils/boundedCache";
import { callDeepseekJson, isDeepseekConfigured } from "./deepseek";

export interface StrategyExplanation {
  summary: string;
  whyItWorks: string;
  keyRisks: string;
  nextStep: string;
  thesis: string;
  modelReasoning: string;
  suggestedExperiments: string[];
  confidenceScore: number;
  confidenceLevel: "low" | "medium" | "high";
  source: "deepseek" | "template";
}

interface LlmNarrative {
  summary: string;
  whyItWorks: string;
  keyRisks: string;
  nextStep: string;
  thesis: string;
  modelReasoning: string;
  suggestedExperiments: string[];
}

const explanationCache = new Map<string, StrategyExplanation>();
// Keyed by strategy + symbol + last-signal date; bounded so it can't grow
// without limit over a long-lived process.
const EXPLANATION_CACHE_MAX = 256;

export async function generateStrategyExplanation(result: BacktestResult): Promise<StrategyExplanation> {
  const cacheKey = buildCacheKey(result);
  const cached = explanationCache.get(cacheKey);
  if (cached) return cached;

  const baseline = buildTemplateExplanation(result);

  if (!isDeepseekConfigured()) {
    boundedSet(explanationCache, cacheKey, baseline, EXPLANATION_CACHE_MAX);
    return baseline;
  }

  const narrative = await callDeepseekJson<LlmNarrative>({
    messages: [
      {
        role: "system",
        content:
          "You are a senior quantitative research analyst writing concise, evidence-based memos for a research dashboard. " +
          "Never invent numbers — only reference metrics that appear in the user payload. " +
          "Be sober: if data is fallback/demo or trade count is small, say so. " +
          "Avoid filler words and never give live trading instructions. " +
          "Respond ONLY with a valid JSON object using the exact schema requested.",
      },
      {
        role: "user",
        content: buildPrompt(result),
      },
    ],
    temperature: 0.35,
    maxTokens: 750,
  });

  const explanation: StrategyExplanation = narrative
    ? mergeNarrative(baseline, narrative)
    : baseline;

  boundedSet(explanationCache, cacheKey, explanation, EXPLANATION_CACHE_MAX);
  return explanation;
}

function buildCacheKey(result: BacktestResult): string {
  return [
    result.strategyId,
    result.symbol,
    result.metrics.lastSignalDate ?? "no-signal",
    result.metrics.tradeCount,
    result.dataStatus.isFallback ? "fallback" : "real",
  ].join("::");
}

function buildPrompt(result: BacktestResult): string {
  const { metrics, dataStatus, riskFlags } = result;
  const payload = {
    strategy: { id: result.strategyId, name: result.strategyName, type: result.type, description: result.description },
    symbol: result.symbol,
    dataStatus: {
      provider: dataStatus.provider,
      isFallback: dataStatus.isFallback,
      adjusted: dataStatus.adjusted,
      message: dataStatus.message,
    },
    metrics: {
      totalReturn: metrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn,
      benchmarkReturn: metrics.benchmarkReturn,
      excessReturn: metrics.excessReturn,
      sharpe: metrics.sharpe,
      maxDrawdown: metrics.maxDrawdown,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      tradeCount: metrics.tradeCount,
      averageHoldingDays: metrics.averageHoldingDays,
      volatility: metrics.volatility,
      currentPosition: metrics.currentPosition,
      lastSignalDate: metrics.lastSignalDate,
    },
    riskFlags,
    recentSignals: result.signals.slice(-3),
  };

  return [
    "Write an AI research memo for a long-only equity strategy backtest. Return JSON with these keys:",
    "  summary           — one sentence stating strategy, symbol, data basis, and the key risk-return metrics.",
    "  whyItWorks        — 1-2 sentences on the structural reason this rule may produce the observed profile.",
    "  keyRisks          — 1-2 sentences on the most material risks given the metrics and risk flags.",
    "  nextStep          — one sentence prescribing the next research action, not a trading instruction.",
    "  thesis            — 1-2 sentences framing this as research evidence, not a live signal.",
    "  modelReasoning    — 1-2 sentences explaining what the ranking model weighs and why this strategy looks the way it does.",
    "  suggestedExperiments — array of exactly 3 short, concrete experiment ideas to validate or stress-test the strategy.",
    "",
    "Constraints:",
    "- Reference only metrics present in the payload. Do not fabricate numbers.",
    "- If dataStatus.isFallback is true, explicitly call out that the result uses demo data.",
    "- If tradeCount < 5, explicitly mention sample size is limited.",
    "- English output. Plain prose, no markdown, no bullets except inside suggestedExperiments array.",
    "",
    "Backtest payload:",
    JSON.stringify(payload),
  ].join("\n");
}

function mergeNarrative(baseline: StrategyExplanation, narrative: LlmNarrative): StrategyExplanation {
  const experiments = Array.isArray(narrative.suggestedExperiments) && narrative.suggestedExperiments.length > 0
    ? narrative.suggestedExperiments.slice(0, 4).map((item) => String(item))
    : baseline.suggestedExperiments;

  return {
    summary: pickString(narrative.summary, baseline.summary),
    whyItWorks: pickString(narrative.whyItWorks, baseline.whyItWorks),
    keyRisks: pickString(narrative.keyRisks, baseline.keyRisks),
    nextStep: pickString(narrative.nextStep, baseline.nextStep),
    thesis: pickString(narrative.thesis, baseline.thesis),
    modelReasoning: pickString(narrative.modelReasoning, baseline.modelReasoning),
    suggestedExperiments: experiments,
    confidenceScore: baseline.confidenceScore,
    confidenceLevel: baseline.confidenceLevel,
    source: "deepseek",
  };
}

function pickString(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildTemplateExplanation(result: BacktestResult): StrategyExplanation {
  const { metrics } = result;
  const confidenceLevel: StrategyExplanation["confidenceLevel"] =
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
    result.riskFlags.join("; "),
  ].filter(Boolean).join(" ");
  const nextStep =
    confidenceLevel === "high"
      ? "Move into paper-observation mode and keep checking whether future signals preserve the same risk-return profile."
      : confidenceLevel === "medium"
        ? "Keep it on the radar and prioritize expanding the universe plus testing different market regimes."
        : "Add more real data and samples before considering paper observation.";
  const confidenceScore = Math.round(
    Math.min(95, Math.max(18,
      (metrics.sharpe + 0.5) * 22 +
      Math.max(0, metrics.maxDrawdown + 0.45) * 70 +
      Math.min(metrics.tradeCount, 20) * 1.2 -
      (result.dataStatus.isFallback ? 18 : 0),
    )),
  );
  const thesis = `${result.type} thesis: prioritize ${result.symbol} only when factor evidence, trend structure, and risk-adjusted backtest behavior align. The current model reads the setup as ${confidenceLevel}-confidence research evidence, not a live trading instruction.`;
  const modelReasoning = `The ranking model weighs annualized return, Sharpe, drawdown containment, trade sample size, data quality, and cost-aware execution. This strategy is strongest when its signal frequency is sufficient and drawdown remains inside the radar threshold.`;
  const suggestedExperiments = [
    "Expand the universe beyond the current sector-diversified watchlist and rerun the same rule set.",
    "Test a tighter slippage and fee sensitivity range to understand implementation drag.",
    "Compare 20%, 10%, and volatility-scaled position sizing across the same signals.",
  ];

  return {
    summary,
    whyItWorks,
    keyRisks: keyRisks || "No major risk flag is currently triggered, but continued validation is still required.",
    nextStep,
    thesis,
    modelReasoning,
    suggestedExperiments,
    confidenceScore,
    confidenceLevel,
    source: "template",
  };
}
