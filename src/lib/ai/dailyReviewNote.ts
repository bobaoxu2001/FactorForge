import type { DailyReview } from "@/types/strategy";
import { pct, pctPlain } from "@/lib/utils/format";
import { boundedSet } from "@/lib/utils/boundedCache";
import { callDeepseekJson, isDeepseekConfigured } from "./deepseek";

/**
 * Prose layer for the post-market Daily Review. Same contract as the other AI
 * modules: every number is computed in {@link buildDailyReview} and passed
 * through; the LLM writes the narrative only and silently falls back to a
 * deterministic template when the key is unset or the call fails.
 */
export interface DailyReviewNote {
  /** One-sentence headline of the session's book state. */
  headline: string;
  /** 1-2 sentence read of P&L breadth, today's tape, and the weakest leg. */
  body: string;
  /** What to look at before the next session (single sentence). */
  watch: string;
  source: "deepseek" | "template";
}

interface LlmNarrative {
  headline: string;
  body: string;
  watch: string;
}

const noteCache = new Map<string, DailyReviewNote>();
const NOTE_CACHE_MAX = 64;

export async function generateDailyReviewNote(
  review: DailyReview | null,
): Promise<DailyReviewNote | null> {
  if (!review) return null;

  const baseline = buildTemplateNote(review);
  const cacheKey = buildCacheKey(review);
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
          "You are a quant desk analyst writing a short post-market review of a SIMULATED paper-observation book. " +
          "No broker is connected and no real orders exist — describe observations, never live fills. " +
          "Cite only the numbers in the user payload; never invent returns, counts, or dates. " +
          "Be sober and concrete. Respond ONLY with a valid JSON object using the exact schema requested.",
      },
      { role: "user", content: buildPrompt(review) },
    ],
    temperature: 0.35,
    maxTokens: 450,
  });

  const note: DailyReviewNote = narrative
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

function buildCacheKey(review: DailyReview): string {
  return [
    review.asOf,
    review.bookSize,
    review.winners,
    review.losers,
    review.deployedExposurePct.toFixed(2),
    review.weakest ? `${review.weakest.symbol}:${review.weakest.returnPct.toFixed(3)}` : "none",
    review.largestBatch ? `${review.largestBatch.signalDate}:${review.largestBatch.count}` : "none",
    `${review.tape.entries}/${review.tape.exits}/${review.tape.skipped}/${review.tape.rejected}`,
  ].join("::");
}

function buildPrompt(review: DailyReview): string {
  const payload = {
    asOf: review.asOf,
    bookSize: review.bookSize,
    winners: review.winners,
    losers: review.losers,
    deployedExposurePct: Number((review.deployedExposurePct * 100).toFixed(2)),
    weakest: review.weakest
      ? { symbol: review.weakest.symbol, returnPct: Number((review.weakest.returnPct * 100).toFixed(2)) }
      : null,
    largestBatch: review.largestBatch,
    tape: review.tape,
  };

  return [
    "Write a post-market review of a simulated paper-observation book. Return JSON with these keys:",
    "  headline — one sentence stating book size and the winners/losers split.",
    "  body     — 1-2 sentences on today's tape (entries/exits/skipped/rejected), the weakest leg, and same-batch concentration.",
    "  watch    — one sentence on what a researcher should check before the next session.",
    "",
    "Constraints:",
    "- Use only the numbers in the payload. Do not fabricate values.",
    "- These are simulated observations, not real fills. 'rejected' = near-duplicates the concentration gate refused a slot.",
    "- Plain prose, no markdown.",
    "",
    "Review payload:",
    JSON.stringify(payload),
  ].join("\n");
}

function pickString(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildTemplateNote(review: DailyReview): DailyReviewNote {
  if (review.bookSize === 0) {
    return {
      headline: "The paper-observation book is empty this session.",
      body: "No strategy currently meets radar admission rules, so there is nothing to review and no simulated capital is deployed.",
      watch: "Wait for the next scan — admission only happens when a candidate clears the radar and concentration gate.",
      source: "template",
    };
  }

  const splitClause =
    review.losers === 0
      ? `all ${review.winners} in profit`
      : review.winners === 0
        ? `all ${review.losers} underwater`
        : `${review.winners} in profit, ${review.losers} underwater`;
  const headline = `${review.bookSize} simulated observation${review.bookSize > 1 ? "s" : ""} in the book — ${splitClause}.`;

  const tape = review.tape;
  const tapeClause =
    `Today's tape: ${tape.entries} new ${plural(tape.entries, "entry", "entries")}, ` +
    `${tape.exits} ${plural(tape.exits, "exit", "exits")}, ` +
    `${tape.skipped} skipped ${plural(tape.skipped, "signal", "signals")}, ` +
    `${tape.rejected} gate ${plural(tape.rejected, "rejection", "rejections")}.`;
  const weakClause = review.weakest
    ? ` Weakest leg is ${review.weakest.label} (${review.weakest.symbol}) at ${pct(review.weakest.returnPct)}.`
    : "";
  const batchClause =
    review.largestBatch && review.largestBatch.count >= 2
      ? ` ${review.largestBatch.count} were admitted in the ${review.largestBatch.signalDate} batch, so review that scan's breadth.`
      : "";
  const body = `${tapeClause}${weakClause}${batchClause}`;

  const watch = review.watchItems[0] ?? "No flags this session.";

  return {
    headline: `${headline} ${pctPlain(review.deployedExposurePct)} of simulated capital is deployed.`,
    body,
    watch,
    source: "template",
  };
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}
