import { describe, expect, it } from "vitest";
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  glossaryByCategory,
  lookupTerm,
} from "./glossary";

describe("glossary data", () => {
  it("has unique ids", () => {
    const ids = GLOSSARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty plain-English definition and a known category", () => {
    for (const entry of GLOSSARY) {
      expect(entry.plain.trim().length).toBeGreaterThan(0);
      expect(GLOSSARY_CATEGORIES).toContain(entry.category);
      expect(["starter", "intermediate"]).toContain(entry.level);
    }
  });

  it("keeps definitions jargon-light (plain text, reasonably short)", () => {
    for (const entry of GLOSSARY) {
      // A one-liner for beginners shouldn't run on forever.
      expect(entry.plain.length).toBeLessThan(240);
    }
  });

  it("resolves by id, display term, and alias, case-insensitively", () => {
    expect(lookupTerm("sharpe")?.term).toBe("Sharpe ratio");
    expect(lookupTerm("Sharpe Ratio")?.id).toBe("sharpe");
    expect(lookupTerm("MAX DD")?.id).toBe("drawdown");
    expect(lookupTerm("n_eff")?.id).toBe("neff");
    expect(lookupTerm("  Ticker  ")?.id).toBe("ticker");
  });

  it("returns undefined for unknown terms (so <Term> can fall back to plain text)", () => {
    expect(lookupTerm("definitely-not-a-term")).toBeUndefined();
  });

  it("has no alias that collides with a different entry's id", () => {
    const idSet = new Set(GLOSSARY.map((e) => e.id));
    for (const entry of GLOSSARY) {
      for (const alias of entry.aliases ?? []) {
        const resolved = lookupTerm(alias);
        // An alias must resolve back to its own entry, never hijack another.
        expect(resolved?.id).toBe(entry.id);
        if (idSet.has(alias) && alias !== entry.id) {
          throw new Error(`alias "${alias}" collides with another entry id`);
        }
      }
    }
  });

  it("groups all entries by category with nothing dropped", () => {
    const grouped = glossaryByCategory();
    const total = grouped.reduce((sum, g) => sum + g.entries.length, 0);
    expect(total).toBe(GLOSSARY.length);
  });

  it("covers the core terms the dashboards actually use", () => {
    for (const id of ["sharpe", "drawdown", "benchmark", "neff", "backtest", "correlation"]) {
      expect(lookupTerm(id), `missing glossary entry: ${id}`).toBeTruthy();
    }
  });
});
