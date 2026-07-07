import { describe, expect, it } from "vitest";
import sitemap, { PUBLIC_ROUTES } from "./sitemap";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { SEARCH_ITEMS } from "@/lib/search";

const entries = sitemap();
const urls = entries.map((entry) => entry.url);
const paths = urls.map((url) => new URL(url).pathname);

describe("sitemap", () => {
  it("includes every public route and the homepage at top priority", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(paths, `route ${route} missing from sitemap`).toContain(route);
    }
    const home = entries.find((entry) => new URL(entry.url).pathname === "/");
    expect(home?.priority).toBe(1);
  });

  it("derives every strategy detail page from the catalog", () => {
    for (const definition of STRATEGY_CATALOG) {
      expect(paths).toContain(`/strategies/${definition.id}`);
    }
  });

  it("never lists protected or account surfaces", () => {
    for (const path of paths) {
      expect(path).not.toMatch(/^\/(admin|api|my-watchlist|sign-in|sign-up)/);
    }
  });

  it("has no duplicate urls and only absolute urls on one origin", () => {
    expect(new Set(urls).size).toBe(urls.length);
    const origins = new Set(urls.map((url) => new URL(url).origin));
    expect(origins.size).toBe(1);
  });

  it("covers every public route the ⌘K search index links to", () => {
    // The search index is the in-app map of the platform; anything it offers
    // to users (minus protected surfaces and anchors) should be crawlable.
    const searchPaths = SEARCH_ITEMS
      .map((item) => item.href.split(/[#?]/)[0])
      .filter((path) => !/^\/(admin|my-watchlist|sign-in|sign-up)/.test(path));
    for (const path of new Set(searchPaths)) {
      expect(paths, `search links to ${path} but sitemap omits it`).toContain(path);
    }
  });
});
