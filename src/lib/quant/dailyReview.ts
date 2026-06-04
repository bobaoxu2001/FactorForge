import type {
  DailyReview,
  DailyReviewTape,
  PaperAccountSummary,
  PaperObservation,
  RadarCandidate,
} from "@/types/strategy";

/**
 * Post-market auto-review of the paper-observation book.
 *
 * This is the deterministic half of the Daily Review feature: it
 * folds the exact observations the rest of the app renders into a desk-style
 * end-of-session blotter (book P&L tally, weakest leg, same-batch concentration,
 * today's tape) without inventing a single number. The narrative layer
 * (`src/lib/ai/dailyReviewNote.ts`) writes prose on top of this and nothing more.
 *
 * Honesty note: every "trade" here is a simulated observation. No broker is
 * connected and no order is routed — the tape counts radar admissions/exits and
 * concentration-gate rejections, not real fills.
 */
export function buildDailyReview(
  observations: PaperObservation[],
  paperAccount: PaperAccountSummary,
  radarCandidates: RadarCandidate[] = [],
): DailyReview {
  const asOf = reviewDate(observations);

  const winners = observations.filter((o) => o.simulatedReturn >= 0).length;
  const losers = observations.length - winners;

  const weakest = observations.length > 0
    ? observations.reduce((min, o) => (o.simulatedReturn < min.simulatedReturn ? o : min))
    : null;

  const largestBatch = computeLargestBatch(observations);

  const tape = computeTape(observations, radarCandidates, asOf);

  return {
    asOf,
    bookSize: observations.length,
    winners,
    losers,
    deployedExposurePct: paperAccount.exposurePct,
    weakest: weakest
      ? {
          label: weakest.candidate.result.strategyName,
          symbol: weakest.currentSymbol,
          returnPct: weakest.simulatedReturn,
        }
      : null,
    largestBatch,
    tape,
    watchItems: buildWatchItems(observations, paperAccount, largestBatch, weakest, tape),
  };
}

/** Newest signal date across the book, the session this review closes out. */
function reviewDate(observations: PaperObservation[]): string {
  const dates = observations
    .map((o) => o.candidate.result.metrics.lastSignalDate)
    .filter((d): d is string => Boolean(d));
  if (dates.length === 0) return new Date().toISOString().slice(0, 10);
  return dates.reduce((latest, d) => (d > latest ? d : latest));
}

/**
 * Largest group of observations admitted on the same signal date. A wide batch
 * means one scan cycle drove several admissions at once, so the review flags it
 * for a "was that one good read or one crowded read?" check.
 */
function computeLargestBatch(observations: PaperObservation[]): DailyReview["largestBatch"] {
  if (observations.length === 0) return null;
  const counts = new Map<string, number>();
  for (const o of observations) {
    const date = o.candidate.result.metrics.lastSignalDate;
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let signalDate = "";
  let count = 0;
  for (const [date, n] of counts) {
    // Tie-break on the later date so the batch shown is the most recent crowd.
    if (n > count || (n === count && date > signalDate)) {
      signalDate = date;
      count = n;
    }
  }
  return { signalDate, count };
}

function computeTape(
  observations: PaperObservation[],
  radarCandidates: RadarCandidate[],
  asOf: string,
): DailyReviewTape {
  // Entries/exits are tied to TODAY's session only, so the tape reflects activity
  // on the review date rather than the whole book's lifetime.
  const entries = observations.filter(
    (o) => o.status === "active" && o.candidate.result.metrics.lastSignalDate === asOf,
  ).length;
  const exits = observations.filter((o) => {
    const last = o.candidate.result.signals[o.candidate.result.signals.length - 1];
    return last?.type === "sell" && last.date === asOf;
  }).length;
  const skipped = radarCandidates.filter((c) => c.status === "continue observing").length;
  // The concentration gate refusing a near-duplicate a slot is this app's order
  // rejection: a would-be order the desk declined because it doubled an existing bet.
  const rejected = radarCandidates.filter((c) => c.redundancy?.demoted).length;
  return { entries, exits, skipped, rejected };
}

function buildWatchItems(
  observations: PaperObservation[],
  paperAccount: PaperAccountSummary,
  largestBatch: DailyReview["largestBatch"],
  weakest: PaperObservation | null,
  tape: DailyReviewTape,
): string[] {
  const items: string[] = [];

  if (weakest && weakest.simulatedReturn < 0) {
    items.push(
      `${weakest.candidate.result.strategyName} (${weakest.currentSymbol}) is the only underwater leg — confirm the thesis still holds before the next session.`,
    );
  }
  if (largestBatch && largestBatch.count >= 2) {
    items.push(
      `${largestBatch.count} observations were admitted in the ${largestBatch.signalDate} batch — review that scan's breadth so they aren't one crowded read.`,
    );
  }
  if (paperAccount.exposurePct > 0.6) {
    items.push("Deployed exposure is above the 60% target — no new admissions until a slot frees up.");
  }
  if (tape.rejected > 0) {
    items.push(
      `${tape.rejected} near-duplicate candidate${tape.rejected > 1 ? "s were" : " was"} rejected by the concentration gate — that crowding is real, not noise.`,
    );
  }
  if (observations.some((o) => o.candidate.result.dataStatus.isFallback)) {
    items.push("At least one observation runs on fallback/demo data — don't read its tape as live evidence.");
  }
  if (items.length === 0) {
    items.push("No flags this session — the book is within every guardrail and no leg needs attention.");
  }
  return items;
}
