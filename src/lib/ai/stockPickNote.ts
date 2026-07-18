import type { StockPickReport } from "@/lib/quant/stockPicks";
import { boundedSet } from "@/lib/utils/boundedCache";
import { callDeepseekJson, isDeepseekConfigured } from "./deepseek";

/**
 * Prose layer for the cross-sectional stock picks. Same contract as the other
 * AI modules: every score is computed in {@link buildStockPicks} and passed
 * through; the LLM writes the narrative only and silently falls back to a
 * deterministic template when the key is unset or the call fails.
 */
export interface StockPickNote {
  /** One-sentence headline naming the top-ranked pick and the regime. */
  headline: string;
  /** 2-3 sentences on what separates the leaders — which components carried them. */
  body: string;
  /** One sentence on the biggest caveat a researcher should verify first. */
  watch: string;
  source: "deepseek" | "template";
}

interface LlmNarrative {
  headline: string;
  body: string;
  watch: string;
}

const noteCache = new Map<string, StockPickNote>();
const NOTE_CACHE_MAX = 64;

export async function generateStockPickNote(report: StockPickReport): Promise<StockPickNote> {
  const baseline = buildTemplateNote(report);
  const cacheKey = buildCacheKey(report);
  const cached = noteCache.get(cacheKey);
  if (cached) return cached;

  if (!isDeepseekConfigured() || report.picks.length === 0) {
    boundedSet(noteCache, cacheKey, baseline, NOTE_CACHE_MAX);
    return baseline;
  }

  const narrative = await callDeepseekJson<LlmNarrative>({
    messages: [
      {
        role: "system",
        content:
          "You are a quant desk analyst summarizing a deterministic cross-sectional stock screen for a RESEARCH workbench. " +
          "The evidence is technical only (momentum, trend, volatility, volume, multi-strategy confirmation) — there is no fundamental data, and nothing here is investment advice or a return forecast. " +
          "Cite only the numbers in the user payload; never invent scores, returns, or names. " +
          "Be sober and concrete. Respond ONLY with a valid JSON object using the exact schema requested.",
      },
      { role: "user", content: buildPrompt(report) },
    ],
    temperature: 0.3,
    maxTokens: 450,
  });

  const note: StockPickNote = narrative
    ? {
        headline: pickString(narrative.headline, baseline.headline),
        body: pickString(narrative.body, baseline.body),
        watch: pickString(narrative.watch, baseline.watch),
        source: "deepseek",
      }
    : baseline;

  boundedSet(noteCache, cacheKey, note, NOTE_CACHE_MAX);
  return note;
}

function buildCacheKey(report: StockPickReport): string {
  return [
    report.asOf,
    report.regime,
    report.picks
      .slice(0, 5)
      .map((pick) => `${pick.symbol}:${pick.compositeScore}`)
      .join(","),
  ].join("::");
}

function buildPrompt(report: StockPickReport): string {
  const payload = {
    regime: report.regime,
    regimeNote: report.regimeNote,
    coverage: report.coverage,
    topPicks: report.picks.slice(0, 5).map((pick) => ({
      symbol: pick.symbol,
      name: pick.name,
      sector: pick.sector,
      compositeScore: pick.compositeScore,
      tier: pick.tier,
      heldByStrategies: pick.heldByStrategies,
      components: pick.components.map((c) => ({ label: c.label, score: Math.round(c.score) })),
      caveats: pick.caveats,
    })),
  };

  return [
    "Summarize this deterministic cross-sectional stock screen. Return JSON with these keys:",
    "  headline — one sentence naming the top-ranked name, its composite score, and the regime.",
    "  body     — 2-3 sentences on what separates the leaders (which components carried them, strategy confirmation, sector spread).",
    "  watch    — one sentence on the single most important caveat to verify before acting on the screen.",
    "",
    "Constraints:",
    "- Use only the numbers in the payload. Do not fabricate values.",
    "- Technical evidence only; never imply a valuation judgment or a return forecast.",
    "- This is research software, not investment advice — do not recommend buying or selling.",
    "- Plain prose, no markdown.",
    "",
    "Screen payload:",
    JSON.stringify(payload),
  ].join("\n");
}

function pickString(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildTemplateNote(report: StockPickReport): StockPickNote {
  if (report.picks.length === 0) {
    return {
      headline: "No universe name has a complete factor row to score this session.",
      body: "The cross-section needs momentum, volatility, and RSI values for at least one single-name stock. Check the data page for provider coverage before reading anything into an empty screen.",
      watch: "Verify provider status on /data — an empty screen is a data problem, not a market read.",
      source: "template",
    };
  }

  const [top, ...rest] = report.picks;
  const runnersUp = rest.slice(0, 2);
  const strongest = [...top.components].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];

  const headline = `${top.symbol} (${top.name}) leads the ${report.regime}-regime screen at ${top.compositeScore}/100.`;
  const runnerClause =
    runnersUp.length > 0
      ? ` Next in line: ${runnersUp.map((pick) => `${pick.symbol} at ${pick.compositeScore}`).join(", ")}.`
      : "";
  const evidenceClause =
    top.heldByStrategies > 0
      ? ` ${top.heldByStrategies} independent ${top.heldByStrategies === 1 ? "strategy holds" : "strategies hold"} the leader.`
      : " No catalog strategy currently holds the leader — the rank rests on factors alone.";
  const body = `${strongest.label} is the leader's strongest weighted component.${evidenceClause}${runnerClause} ${report.regimeNote}`;

  const watch =
    top.caveats[0] ??
    "No caveat is flagged on the leader — still verify data provenance and remember this is technical evidence, not advice.";

  return { headline, body, watch, source: "template" };
}
