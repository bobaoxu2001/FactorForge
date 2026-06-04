import { pctPlain } from "@/lib/utils/format";
import { boundedSet } from "@/lib/utils/boundedCache";
import { factorLabel, type SignalConcentrationReport } from "@/lib/quant/signalConcentration";
import { callDeepseekJson, isDeepseekConfigured } from "./deepseek";

/**
 * Batch-level concentration memo for the Reports page. Mirrors the strategy
 * explainer contract: every number is computed in code and passed through; the
 * LLM writes prose only and silently falls back to the deterministic template.
 *
 * This keeps the narrative layer honest about the same N_eff / overlap finding
 * the radar, paper-trading, and portfolio surfaces already enforce numerically.
 */
export interface ConcentrationNote {
  headline: string;
  assessment: string;
  researchAction: string;
  source: "deepseek" | "template";
}

interface LlmNarrative {
  headline: string;
  assessment: string;
  researchAction: string;
}

const noteCache = new Map<string, ConcentrationNote>();
const NOTE_CACHE_MAX = 64;

export async function generateConcentrationNote(
  report: SignalConcentrationReport | null,
  options: { demotedCount?: number } = {},
): Promise<ConcentrationNote | null> {
  if (!report) return null;
  const demotedCount = options.demotedCount ?? 0;

  const baseline = buildTemplateNote(report, demotedCount);
  const cacheKey = buildCacheKey(report, demotedCount);
  const cached = noteCache.get(cacheKey);
  if (cached) return cached;

  if (!isDeepseekConfigured()) {
    boundedSet(noteCache, cacheKey, baseline, NOTE_CACHE_MAX);
    return baseline;
  }

  const narrative = await callDeepseekJson<LlmNarrative>({
    messages: [
      {
        role: "system",
        content:
          "You are a portfolio risk analyst writing a short diversification note for a research dashboard. " +
          "Cite only the numbers present in the user payload — never invent correlations, counts, or percentages. " +
          "The core idea: a set of strategies can look diverse while being one underlying bet. " +
          "Be sober and specific. Respond ONLY with a valid JSON object using the exact schema requested.",
      },
      { role: "user", content: buildPrompt(report, demotedCount) },
    ],
    temperature: 0.35,
    maxTokens: 450,
  });

  const note: ConcentrationNote = narrative
    ? {
        headline: pickString(narrative.headline, baseline.headline),
        assessment: pickString(narrative.assessment, baseline.assessment),
        researchAction: pickString(narrative.researchAction, baseline.researchAction),
        source: "deepseek",
      }
    : baseline;

  boundedSet(noteCache, cacheKey, note, NOTE_CACHE_MAX);
  return note;
}

function buildCacheKey(report: SignalConcentrationReport, demotedCount: number): string {
  return [
    report.strategyCount,
    report.level,
    report.averagePairwiseCorrelation.toFixed(2),
    report.effectiveStrategies.toFixed(1),
    report.sharedDominantFactor?.factor ?? "none",
    demotedCount,
  ].join("::");
}

function buildPrompt(report: SignalConcentrationReport, demotedCount: number): string {
  const payload = {
    strategyCount: report.strategyCount,
    effectiveBets: Number(report.effectiveStrategies.toFixed(2)),
    averagePairwiseCorrelation: Number(report.averagePairwiseCorrelation.toFixed(3)),
    overlapLevel: report.level,
    mostCorrelatedPair: report.maxPair
      ? { a: report.maxPair.a, b: report.maxPair.b, correlation: Number(report.maxPair.correlation.toFixed(3)) }
      : null,
    sharedDominantFactor: report.sharedDominantFactor
      ? { factor: factorLabel(report.sharedDominantFactor.factor), count: report.sharedDominantFactor.count }
      : null,
    nearDuplicatesDemotedByGate: demotedCount,
  };

  return [
    "Write a portfolio diversification note. Return JSON with these keys:",
    "  headline       — one sentence stating how many strategies were screened and roughly how many independent bets they represent.",
    "  assessment     — 1-2 sentences interpreting the overlap level, the most correlated pair, and any shared dominant factor.",
    "  researchAction — one sentence naming the next review step for the simulated observation set, not a trading instruction.",
    "",
    "Constraints:",
    "- Use only the numbers in the payload. Do not fabricate values.",
    "- 'effectiveBets' is N_eff = N / (1 + (N-1)·avg correlation). Treat low N_eff relative to strategyCount as redundancy.",
    "- Plain prose, no markdown.",
    "",
    "Concentration payload:",
    JSON.stringify(payload),
  ].join("\n");
}

function pickString(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildTemplateNote(report: SignalConcentrationReport, demotedCount: number): ConcentrationNote {
  const neff = report.effectiveStrategies.toFixed(1);
  const avg = pctPlain(report.averagePairwiseCorrelation);

  const headline = `${report.strategyCount} screened strategies behave like roughly ${neff} independent bets (${report.level} overlap).`;

  const sharedClause = report.sharedDominantFactor
    ? ` ${report.sharedDominantFactor.count} of them load primarily on the ${factorLabel(report.sharedDominantFactor.factor)} factor, so different rules share one underlying driver.`
    : "";
  const pairClause = report.maxPair && report.maxPair.correlation > 0.5
    ? ` The most correlated pair (${report.maxPair.a} vs ${report.maxPair.b}) moves together ${pctPlain(report.maxPair.correlation)} of the time.`
    : "";
  const assessment = `Average pairwise return correlation is ${avg}.${sharedClause}${pairClause}`;

  const researchAction =
    report.level === "high"
      ? "For review, keep only the strongest strategy within each correlated cluster in the simulated observation set because adding more concentrates risk rather than diversifying it."
      : report.level === "medium"
        ? "For review, compare the highest-scoring strategy per cluster and flag near-duplicates before simulated observation."
        : "For review, the set shows lower overlap and can be studied as separate simulated exposures.";

  const gateClause = demotedCount > 0
    ? ` ${demotedCount} near-duplicate candidate${demotedCount > 1 ? "s were" : " was"} already demoted by the concentration gate.`
    : "";

  return {
    headline,
    assessment: assessment + gateClause,
    researchAction,
    source: "template",
  };
}
