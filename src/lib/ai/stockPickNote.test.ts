import { afterEach, describe, expect, it } from "vitest";
import { buildStockPicks } from "@/lib/quant/stockPicks";
import type { FactorSnapshot } from "@/types/market";
import { generateStockPickNote } from "./stockPickNote";

function makeSnapshot(symbol: string, overrides: Partial<FactorSnapshot> = {}): FactorSnapshot {
  return {
    symbol,
    date: "2026-07-17",
    momentum20d: 0.03,
    momentum60d: 0.08,
    volatility20d: 0.18,
    volumeSurge: 1.0,
    aboveSma200: true,
    rsi14: 55,
    provider: "yahoo",
    isFallback: false,
    adjusted: true,
    ...overrides,
  };
}

const emptyConsensus = {
  asOf: "2026-07-17",
  strategyCount: 5,
  symbolsScanned: 28,
  picks: [],
  consensusCount: 0,
  topPick: null,
  verdict: "test",
};

describe("generateStockPickNote (template path — no API key)", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey;
    else delete process.env.DEEPSEEK_API_KEY;
  });

  it("names the leader, its score, and the regime without an LLM", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const report = buildStockPicks({
      factors: [makeSnapshot("AAPL", { momentum60d: 0.2 }), makeSnapshot("JNJ", { momentum60d: 0.02 })],
      consensus: emptyConsensus,
      regime: { regime: "stable", stressScore: 20 },
      generatedAt: "2026-07-17T00:00:00.000Z",
    });

    const note = await generateStockPickNote(report);
    expect(note.source).toBe("template");
    expect(note.headline).toContain("AAPL");
    expect(note.headline).toContain(String(report.picks[0].compositeScore));
    expect(note.headline).toContain("stable");
    expect(note.body.length).toBeGreaterThan(0);
    expect(note.watch.length).toBeGreaterThan(0);
  });

  it("degrades honestly when the screen is empty", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const report = buildStockPicks({
      factors: [],
      consensus: emptyConsensus,
      regime: { regime: "caution", stressScore: 50 },
      generatedAt: "2026-07-17T00:00:00.000Z",
    });

    const note = await generateStockPickNote(report);
    expect(note.source).toBe("template");
    expect(note.headline).toContain("No universe name");
    expect(note.watch).toContain("/data");
  });
});
