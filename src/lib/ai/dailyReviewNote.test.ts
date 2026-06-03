import { describe, expect, it } from "vitest";
import type { DailyReview } from "@/types/strategy";
import { generateDailyReviewNote } from "./dailyReviewNote";

function review(overrides: Partial<DailyReview> = {}): DailyReview {
  return {
    asOf: "2026-06-02",
    bookSize: 3,
    winners: 2,
    losers: 1,
    deployedExposurePct: 0.4,
    weakest: { label: "Quality Momentum Breakout", symbol: "NVDA", returnPct: -0.03 },
    largestBatch: { signalDate: "2026-06-01", count: 2 },
    tape: { entries: 0, exits: 0, skipped: 1, rejected: 1 },
    watchItems: ["Confirm the underwater leg before the next session."],
    ...overrides,
  };
}

describe("generateDailyReviewNote", () => {
  it("returns null when there is no review", async () => {
    expect(await generateDailyReviewNote(null)).toBeNull();
  });

  it("builds a template note citing book split, tape, and weakest leg (no API key)", async () => {
    const note = await generateDailyReviewNote(review());
    expect(note).not.toBeNull();
    expect(note!.source).toBe("template");
    expect(note!.headline).toMatch(/3 simulated observations/);
    expect(note!.headline).toMatch(/2 in profit, 1 underwater/);
    expect(note!.headline).toMatch(/40.0% of simulated capital is deployed/);
    expect(note!.body).toMatch(/1 skipped signal/);
    expect(note!.body).toMatch(/1 gate rejection/);
    expect(note!.body).toMatch(/Weakest leg is Quality Momentum Breakout \(NVDA\) at -3.0%/);
    expect(note!.body).toMatch(/admitted in the 2026-06-01 batch/);
  });

  it("handles an empty book", async () => {
    const note = await generateDailyReviewNote(
      review({ bookSize: 0, winners: 0, losers: 0, weakest: null, largestBatch: null, deployedExposurePct: 0 }),
    );
    expect(note!.headline).toMatch(/empty this session/);
  });

  it("renders an all-winners book without a losers clause", async () => {
    const note = await generateDailyReviewNote(review({ winners: 3, losers: 0 }));
    expect(note!.headline).toMatch(/all 3 in profit/);
  });
});
