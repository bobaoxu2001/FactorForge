import { describe, expect, it } from "vitest";
import { SEARCH_ITEMS, searchItems } from ".";
import { GLOSSARY } from "@/data/glossary";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { UNIVERSE } from "@/data/watchlist";
import { RESEARCH_PROJECTS } from "@/data/research/projects";

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

  it("opens covered company research before the quant symbol entry", () => {
    expect(searchItems("$KNX")[0]).toMatchObject({ category: "Company", href: "/research/freight/companies/KNX" });
    expect(searchItems("Knight Swift").some((item) => item.href === "/research/freight/companies/KNX")).toBe(true);
  });

  it("finds briefs and the correct case's evidence with multi-word queries", () => {
    expect(searchItems("freight one-page brief")[0].href).toBe("/research/freight/sample");
    expect(searchItems("Binance evidence")[0].href).toBe("/events/binance-breach/evidence");
    expect(searchItems("AI data center impact")[0].href).toBe("/events/ai-datacenter-shock/impact");
    expect(searchItems("Binance evidence").every((item) => item.href.startsWith("/events/binance-breach"))).toBe(true);
  });

  it("does not return partial matches when one query word is unknown", () => {
    expect(searchItems("freight zzzz-no-match")).toEqual([]);
    expect(searchItems("KNX", 0)).toEqual([]);
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
      const results = searchItems(constituent.symbol);
      expect(results.some((item) => item.title === constituent.symbol && item.href === `/strategies?symbol=${constituent.symbol}`), `symbol ${constituent.symbol} missing from search`).toBe(true);
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

  it("covers every registered company and project brief", () => {
    for (const project of RESEARCH_PROJECTS) {
      expect(SEARCH_ITEMS.some((item) => item.href === `/research/${project.id}/sample`)).toBe(true);
      for (const company of project.companies) {
        expect(searchItems(company.ticker).some((item) => item.href === `/research/${project.id}/companies/${company.ticker}`)).toBe(true);
      }
    }
  });
});
