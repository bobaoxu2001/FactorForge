import { describe, expect, it } from "vitest";
import manifest from "@/__fixtures__/research/freight/manifest.json";
import macro from "@/__fixtures__/research/freight/macro.json";
import cassLinehaul from "@/__fixtures__/research/freight/cass-linehaul.json";
import companies from "@/__fixtures__/research/freight/companies.json";
import prices from "@/__fixtures__/research/freight/prices.json";
import { FREIGHT_PROJECT } from "@/data/research/projects/freight";
import { buildValuation } from "./companies";
import { applyStaleness, validateEvidence } from "./evidence";
import { buildMemoSections, memoMeta, memoToMarkdown } from "./memo";
import { getResearchProject } from "./project";
import type { CompanyFixture, MacroSeriesFixture, PriceFixture } from "./snapshot";
import type { Evidence } from "./types";

const NOW = new Date("2026-11-01T12:00:00Z");
const view = getResearchProject("freight", NOW)!;

describe("research snapshot drift guards", () => {
  it("covers every configured KPI series with licensed, dated observations", () => {
    const fixtures = [...macro.series, cassLinehaul] as unknown as MacroSeriesFixture[];
    const series = new Map(fixtures.map((s) => [s.id, s]));
    for (const kpi of FREIGHT_PROJECT.kpis) {
      const s = series.get(kpi.sourceSeriesId!);
      expect(s, kpi.id).toBeDefined();
      expect(s!.excluded).toBeNull();
      if (s!.provider === "Cass") {
        expect(s!.observations).toHaveLength(13);
        expect(s!.url).toMatch(/^https:\/\/www\.cassinfo\.com\//);
        expect(s!.licenseLabel).toContain("Copyright Cass");
        continue;
      }
      expect(s!.observations.length).toBeGreaterThan(24);
      expect(s!.licenseLabel).toMatch(/Public Domain|Copyrighted: Citation Required/i);
      expect(s!.url).toMatch(/^https:\/\/fred\.stlouisfed\.org\/series\//);
    }
  });

  it("never redistributes a series whose licence requires pre-approval", () => {
    for (const s of macro.series) {
      if (/pre-approval/i.test(s.licenseLabel ?? "")) expect(s.observations).toHaveLength(0);
    }
  });

  it("has no observation dated after the snapshot was built", () => {
    const built = manifest.builtAt.slice(0, 10);
    for (const s of macro.series) expect(s.observations.at(-1)![0] <= built).toBe(true);
    for (const p of Object.values((prices as { prices: Record<string, { rows: unknown[][] }> }).prices)) expect((p.rows.at(-1)![0] as string) <= built).toBe(true);
  });

  it("includes filings and prices for every covered company and both benchmarks", () => {
    const c = (companies as unknown as { companies: Record<string, unknown> }).companies;
    const p = (prices as { prices: Record<string, unknown> }).prices;
    for (const co of FREIGHT_PROJECT.companies) {
      expect(c[co.ticker], co.ticker).toBeDefined();
      expect(p[co.ticker], co.ticker).toBeDefined();
    }
    expect(p.SPY).toBeDefined();
    expect(p.IYT).toBeDefined();
  });

  it("does not record the SEC contact address in committed files", () => {
    const all = JSON.stringify(manifest) + JSON.stringify(macro).slice(0, 5000);
    expect(all).not.toMatch(/@[a-z0-9-]+\.(edu|com|org)/i);
    expect(manifest.secUserAgent).toMatch(/not recorded/);
  });
});

describe("evidence integrity", () => {
  it("passes every integrity rule", () => {
    expect(view.evidenceIssues).toEqual([]);
  });

  it("verifies every 10-K claim against a retrieved sentence (re-verify after a refresh if this fails)", () => {
    const filingClaims = view.evidence.filter((e) => e.id.startsWith("EV-10K-"));
    expect(filingClaims.length).toBe(FREIGHT_PROJECT.excerptClaims.length);
    for (const e of filingClaims) {
      expect(e.status, e.id).toBe("verified");
      expect(e.excerpt).toBeTruthy();
      expect(e.source.url).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
    }
  });

  it("links each company fact to an SEC filing URL", () => {
    for (const e of view.evidence.filter((x) => /^EV-[A-Z]+-(REV|OM|FUEL)$/.test(x.id))) {
      expect(e.source.url, e.id).toMatch(/sec\.gov/);
      expect(e.location).toMatch(/accession/);
    }
  });

  it("rejects AI-generated 'verified' items, uncited public items and duplicates", () => {
    const base = view.evidence[0];
    const bad: Evidence[] = [
      { ...base, id: "X1", origin: "ai-generated", status: "verified" },
      { ...base, id: "X2", origin: "public-secondary", source: { ...base.source, url: undefined } },
      { ...base, id: "X2" },
      { ...base, id: "X3", origin: "user-primary", status: "verified", source: { ...base.source, documentRef: undefined } },
    ];
    const issues = validateEvidence(bad);
    expect(issues.some((i) => i.includes("X1") && i.includes("cannot be marked"))).toBe(true);
    expect(issues.some((i) => i.includes("X2") && i.includes("without a source URL"))).toBe(true);
    expect(issues.some((i) => i.includes("Duplicate"))).toBe(true);
    expect(issues.some((i) => i.includes("X3"))).toBe(true);
  });

  it("downgrades old observations to stale", () => {
    const item = { ...view.evidence[0], observationPeriod: { end: "2025-01-01" } };
    expect(applyStaleness(item, NOW, 120).status).toBe("stale");
  });
});

describe("hypotheses and value chain", () => {
  it("uses individual evidence relationships and keeps diagnostic/group inputs contextual", () => {
    for (const h of view.hypotheses) {
      for (const t of h.tests) {
        for (const relation of t.evidenceRelations ?? []) expect(view.evidence.find((e) => e.id === relation.evidenceId)?.stance[h.id]).toBe(relation.stance);
      }
      expect(h.supportingEvidenceIds.filter((id) => h.contradictingEvidenceIds.includes(id))).toEqual([]);
    }
  });

  it("only marks relationships verified when evidence exists", () => {
    for (const r of view.valueChain.relationships) {
      if (r.status === "verified") expect(r.evidenceIds.length).toBeGreaterThan(0);
      else expect(r.evidenceIds).toHaveLength(0);
    }
    expect(view.valueChain.relationships.some((r) => r.status === "hypothetical")).toBe(true);
  });

  it("does not let future filings change earlier historical multiples", () => {
    for (const c of view.companies) {
      const history = c.valuation!.history;
      const raw = (companies.companies as unknown as Record<string, CompanyFixture>)[c.ticker].metrics;
      const price = (prices.prices as unknown as Record<string, PriceFixture>)[c.ticker];
      // Reconstruct first/middle/last history points from snapshots with every
      // later raw fact physically removed. Aggregate row dates cannot prove
      // that all four quarters of each valuation denominator were public.
      for (const h of [history[0], history[Math.floor(history.length / 2)], history[history.length - 1]]) {
        const rawThen = Object.fromEntries(Object.entries(raw).map(([key, metric]) => [key, { ...metric, points: metric.points.filter((p) => p.filed <= h.date) }]));
        const priceThen = { ...price, rows: price.rows.filter((r) => r[0] <= h.date) };
        const then = buildValuation(rawThen, priceThen)!;
        expect(h.fundamentalsThrough, `${c.ticker} ${h.date}`).toBe(then.fundamentalsThrough);
        expect(h.pe).toBe(then.current.pe);
        expect(h.evToEbitda).toBe(then.current.evToEbitda);
        expect(h.evToSales).toBe(then.current.evToSales);
        expect(h.fcfYield).toBe(then.current.fcfYield);
      }
    }
  });
});

describe("memo", () => {
  const sections = buildMemoSections(view);
  it("retains the memo structure and adds the peer sensitivity section", () => {
    expect(sections[0].title).toBe("Executive Summary");
    expect(sections.at(-1)!.title).toBe("As-of Date and Data Limitations");
    expect(sections.some((s) => s.id === "peer-sensitivity")).toBe(true);
  });
  it("cites only evidence that exists", () => {
    const ids = new Set(view.evidence.map((e) => e.id));
    const cited = sections.flatMap((s) => s.body.join(" ").match(/EV-[A-Za-z0-9-]+/g) ?? []);
    expect(cited.length).toBeGreaterThan(10);
    for (const id of cited) expect(ids.has(id), id).toBe(true);
  });
  it("is honest about its status without primary research", () => {
    expect(view.memoStatus).not.toBe("evidence-backed");
    const md = memoToMarkdown(memoMeta(view), sections, view.memoStatus, { "variant-view": "Analyst text" });
    expect(md).toMatch(/Status:\*\* Public-source research sample/);
    expect(md).toMatch(/Not investment advice/);
    expect(md).toMatch(/Edited by analyst/);
  });
});

describe("test evidence attribution", () => {
  it("links a 3-month-average test only to the 3-month evidence item", () => {
    const h1 = view.hypotheses.find((h) => h.id === "H1")!;
    const t1 = h1.tests.find((t) => t.id === "H1-T1")!;
    expect(t1.evidenceIds).toEqual(["EV-KPI-truck-tonnage-3M"]);
  });
  it("links a fuel-residual test only to the residual calculation", () => {
    const t2 = view.hypotheses.find((h) => h.id === "H2")!.tests.find((t) => t.id === "H2-T2")!;
    expect(t2.evidenceIds).toEqual(["EV-CALC-ppi-truckload-FUEL"]);
  });
});
