import type { FactorSnapshot } from "@/types/market";
import { pct, pctPlain } from "@/lib/utils/format";
import { boundedSet } from "@/lib/utils/boundedCache";
import { callDeepseekJson, isDeepseekConfigured } from "./deepseek";

export interface MarketSummary {
  tone: "risk-on" | "defensive" | "mixed";
  summary: string;
  risk: string;
  dataNote: string;
  highlights: string[];
  source: "deepseek" | "template";
}

interface LlmNarrative {
  summary: string;
  risk: string;
  highlights: string[];
}

const summaryCache = new Map<string, MarketSummary>();
// Keyed by day + symbol set, so this realistically holds only a handful of
// entries — but cap it so a long-lived process can't accumulate forever.
const SUMMARY_CACHE_MAX = 256;

export async function generateMarketSummary(factors: FactorSnapshot[]): Promise<MarketSummary> {
  const baseline = buildTemplateSummary(factors);
  const cacheKey = buildCacheKey(factors);
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  if (!isDeepseekConfigured()) {
    boundedSet(summaryCache, cacheKey, baseline, SUMMARY_CACHE_MAX);
    return baseline;
  }

  const narrative = await callDeepseekJson<LlmNarrative>({
    messages: [
      {
        role: "system",
        content:
          "You are a buy-side market microstructure analyst writing brief tape-reading notes for a research dashboard. " +
          "Cite only numbers present in the user payload — never invent levels, prices, or percentages. " +
          "Be concrete: name specific symbols when calling out leadership or weakness. " +
          "If any symbol has isFallback=true, label that tape as demo data and do not draw real-market conclusions from it. " +
          "Respond ONLY with a valid JSON object using the exact schema requested.",
      },
      { role: "user", content: buildPrompt(factors, baseline) },
    ],
    temperature: 0.4,
    maxTokens: 600,
  });

  const summary: MarketSummary = narrative
    ? {
        tone: baseline.tone,
        summary: pickString(narrative.summary, baseline.summary),
        risk: pickString(narrative.risk, baseline.risk),
        dataNote: baseline.dataNote,
        highlights: cleanHighlights(narrative.highlights) ?? baseline.highlights,
        source: "deepseek",
      }
    : baseline;

  boundedSet(summaryCache, cacheKey, summary, SUMMARY_CACHE_MAX);
  return summary;
}

function buildCacheKey(factors: FactorSnapshot[]): string {
  // factors are deterministic per day; key by the latest date across all symbols plus the symbol set
  const latest = factors.map((f) => f.date).sort().at(-1) ?? "no-date";
  const symbols = factors.map((f) => f.symbol).sort().join(",");
  const fallbackCount = factors.filter((f) => f.isFallback).length;
  return `${latest}::${symbols}::${fallbackCount}`;
}

function buildPrompt(factors: FactorSnapshot[], baseline: MarketSummary): string {
  const payload = factors.map((f) => ({
    symbol: f.symbol,
    date: f.date,
    momentum20d: f.momentum20d,
    momentum60d: f.momentum60d,
    volatility20d: f.volatility20d,
    rsi14: f.rsi14,
    aboveSma200: f.aboveSma200,
    volumeSurge: f.volumeSurge,
    isFallback: f.isFallback,
  }));

  return [
    "Write a market-tape note for a long-only research dashboard. Return JSON with these keys:",
    "  summary    — one sentence on the overall regime (breadth, trend, momentum).",
    "  risk       — one sentence on the dominant risk given volatility and RSI extremes.",
    "  highlights — array of exactly 3 short strings, each calling out a specific symbol's behavior (leader, laggard, RSI extreme, or volume surge).",
    "",
    "Constraints:",
    "- Use only the numbers in the payload. Reference symbol names explicitly.",
    `- Baseline tone has been classified as "${baseline.tone}". Do not contradict that classification unless the data clearly disagrees.`,
    "- If a highlighted symbol has isFallback=true, prepend \"[demo] \" to that highlight.",
    "- Plain prose. No markdown.",
    "",
    "Factor snapshot payload:",
    JSON.stringify(payload),
  ].join("\n");
}

function cleanHighlights(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);
  return cleaned.length > 0 ? cleaned : null;
}

function pickString(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildTemplateSummary(factors: FactorSnapshot[]): MarketSummary {
  const realCount = factors.filter((factor) => !factor.isFallback).length;
  const aboveTrend = factors.filter((factor) => factor.aboveSma200).length;
  const momentum20 = factors
    .map((factor) => factor.momentum20d)
    .filter((value): value is number => value !== null);
  const avgMomentum20 = momentum20.reduce((sum, value) => sum + value, 0) / Math.max(momentum20.length, 1);
  const volatility = factors
    .map((factor) => factor.volatility20d)
    .filter((value): value is number => value !== null);
  const avgVol = volatility.reduce((sum, value) => sum + value, 0) / Math.max(volatility.length, 1);
  const tone: MarketSummary["tone"] =
    aboveTrend >= factors.length * 0.7 ? "risk-on" : aboveTrend <= factors.length * 0.4 ? "defensive" : "mixed";

  const sortedByMomentum = [...factors]
    .filter((f) => f.momentum20d !== null)
    .sort((a, b) => (b.momentum20d ?? 0) - (a.momentum20d ?? 0));
  const leader = sortedByMomentum[0];
  const laggard = sortedByMomentum[sortedByMomentum.length - 1];
  const rsiExtreme = [...factors]
    .filter((f) => f.rsi14 !== null)
    .sort((a, b) => Math.abs((b.rsi14 ?? 50) - 50) - Math.abs((a.rsi14 ?? 50) - 50))[0];

  const highlights: string[] = [];
  if (leader && leader.momentum20d !== null) highlights.push(`${leader.symbol} leads 20d return at ${pct(leader.momentum20d)}.`);
  if (laggard && laggard.momentum20d !== null && laggard.symbol !== leader?.symbol) highlights.push(`${laggard.symbol} lags at ${pct(laggard.momentum20d)}.`);
  if (rsiExtreme && rsiExtreme.rsi14 !== null) highlights.push(`${rsiExtreme.symbol} RSI14 at ${rsiExtreme.rsi14.toFixed(0)} is the watchlist extreme.`);

  return {
    tone,
    summary: `${aboveTrend}/${factors.length} symbols in the default watchlist are above SMA200. Average 20-day return is ${pct(avgMomentum20)} and average annualized 20-day volatility is about ${pctPlain(avgVol)}.`,
    risk: avgVol > 0.4
      ? "Volatility is elevated; breakout strategies need stricter stops and position sizing."
      : "Volatility is within an observable range, but concentration and drawdown still need monitoring.",
    dataNote: realCount === factors.length
      ? "Market summary is generated from real Yahoo daily OHLCV data."
      : `Market summary includes ${factors.length - realCount} fallback/demo symbols.`,
    highlights,
    source: "template",
  };
}
