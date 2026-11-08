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

    it(`${c.slug}: carries its limitations and open questions`, () => {
      const last = memo.at(-1)!;
      for (const l of c.limitations) expect(last.paragraphs).toContain(l);
    });
  }
});
