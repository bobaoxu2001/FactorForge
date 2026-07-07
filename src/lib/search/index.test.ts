import { describe, expect, it } from "vitest";
import { SEARCH_ITEMS, searchItems } from ".";
import { GLOSSARY } from "@/data/glossary";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { UNIVERSE } from "@/data/watchlist";

describe("searchItems", () => {
  it("finds symbols and links to filtered strategy results", () => {
    const [result] = searchItems("NVDA");
    expect(result.title).toBe("NVDA");
    expect(result.href).toBe("/strategies?symbol=NVDA");
  });

  it("finds symbols by company name, not just ticker", () => {
    const results = searchItems("JPMorgan");
    expect(results.some((item) => item.title === "JPM")).toBe(true);
  });

  it("finds maintainer workflow route", () => {
    const result = searchItems("codex maintainer")[0];
    expect(result.title).toBe("OSS & Maintainers");
    expect(result.href).toBe("/oss");
  });

  it("finds glossary terms and deep-links to their /learn anchor", () => {
    const [result] = searchItems("profit factor");
    expect(result.category).toBe("Glossary");
    expect(result.href).toBe("/learn#profitfactor");
  });

  it("returns no results for unrelated queries", () => {
    expect(searchItems("zzzz-no-match")).toEqual([]);
  });
});

/**
 * Drift guards: the derived sections must stay complete. If a symbol, strategy,
 * or glossary entry is added to its source of truth, it must be searchable —
 * these fail loudly instead of letting ⌘K silently go stale.
 */
describe("search index completeness", () => {
  it("covers every universe symbol", () => {
    for (const constituent of UNIVERSE) {
      const [top] = searchItems(constituent.symbol);
      expect(top, `symbol ${constituent.symbol} missing from search`).toBeTruthy();
      expect(top.title).toBe(constituent.symbol);
      expect(top.href).toBe(`/strategies?symbol=${constituent.symbol}`);
    }
  });

  it("covers every strategy detail page with its catalog name", () => {
    for (const definition of STRATEGY_CATALOG) {
      const item = SEARCH_ITEMS.find((candidate) => candidate.href === `/strategies/${definition.id}`);
      expect(item, `strategy ${definition.id} missing from search`).toBeTruthy();
      expect(item?.title).toBe(definition.name);
    }
  });

  it("covers every glossary entry with a /learn anchor link", () => {
    for (const entry of GLOSSARY) {
      const item = SEARCH_ITEMS.find((candidate) => candidate.href === `/learn#${entry.id}`);
      expect(item, `glossary entry ${entry.id} missing from search`).toBeTruthy();
      expect(item?.title).toBe(entry.term);
      expect(item?.category).toBe("Glossary");
    }
  });

  it("covers the navigation routes users actually visit", () => {
    for (const href of ["/", "/learn", "/data", "/factors", "/strategies", "/radar", "/consensus", "/portfolio", "/ai-market", "/hotspots", "/paper-trading", "/simulator", "/track-record", "/reports", "/oss", "/my-watchlist"]) {
      expect(
        SEARCH_ITEMS.some((item) => item.href === href),
        `route ${href} missing from search`,
      ).toBe(true);
    }
  });

  it("has no duplicate hrefs", () => {
    const hrefs = SEARCH_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
