// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALL_CLAIMS, RESEARCH_CASES } from "@/data/events";
import { buildEventMemo } from "./memo";

describe("event research memo", () => {
  for (const c of RESEARCH_CASES) {
    const memo = buildEventMemo(c);
    const text = memo.flatMap((s) => s.paragraphs).join("\n");

    it(`${c.slug}: cites only claims that exist`, () => {
      const cited = [...text.matchAll(/\[([A-Z]-C\d+)\]/g)].map((m) => m[1]);
      expect(cited.length).toBeGreaterThan(0);
      const known = new Set(ALL_CLAIMS.map((x) => x.id));
      for (const id of cited) expect(known.has(id), id).toBe(true);
    });

    it(`${c.slug}: labels interpretation separately from data`, () => {
      expect(memo.find((s) => s.title === "Analyst notes")?.kind).toBe("analyst");
      expect(memo.find((s) => s.title === "Scenarios")?.kind).toBe("analyst");
      expect(memo.find((s) => s.title === "How the event reached markets")?.kind).toBe("data");
    });

    it(`${c.slug}: attaches no probabilities to scenarios`, () => {
      const scen = memo.find((s) => s.title === "Scenarios")!.paragraphs.join(" ");
      expect(scen).not.toMatch(/\d+% (chance|probability)/i);
      expect(scen).toMatch(/No probabilities are attached/);
    });

    it(`${c.slug}: calls market reactions associations, not causes`, () => {
      const market = memo.find((s) => s.title === "How the event reached markets")!.paragraphs.join(" ");
      expect(market).toMatch(/associations around a date, not proof/);
      expect(market).not.toMatch(/\|t\| ≥ 1\.96\)/); // significance needs both checks, not the t-test alone
    });

    it(`${c.slug}: carries its limitations and open questions`, () => {
      const last = memo.at(-1)!;
      for (const l of c.limitations) expect(last.paragraphs).toContain(l);
    });
  }

  it("reports the 5 Nov result as benchmark-sensitive, with each count labelled, and infers no cause", () => {
    const ai = RESEARCH_CASES.find((c) => c.slug === "ai-datacenter-shock")!;
    const market = buildEventMemo(ai).find((s) => s.title === "How the event reached markets")!.paragraphs.join(" ");
    expect(market).toMatch(/Against each stock's own benchmark \(QQQ or SPY\), 0 of 19/);
    expect(market).toMatch(/against the equal-weight S&P 500 \(RSP\), \d+ of 19 do/);
    expect(market).toMatch(/depends on the benchmark chosen/);
    expect(market).toMatch(/Neither comparison says why the stocks moved/);
    expect(market).not.toMatch(/absorbed|not market-wide|market-wide/);
  });
});
