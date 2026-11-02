import type { RawMetric } from "./financials";
import type { SplitEvent } from "./valuation";

/**
 * Shape of the committed research snapshot written by
 * scripts/build-research-snapshot.mjs. Kept separate from the domain types
 * so the fixture format can evolve behind one adapter.
 */

export interface MacroSeriesFixture {
  id: string;
  url: string;
  csvUrl: string;
  retrievedAt: string;
  title: string | null;
  units: string | null;
  seasonalAdjustment: string | null;
  frequency: string | null;
  source: string | null;
  release: string | null;
  updated: string | null;
  nextRelease: string | null;
  notes: string | null;
  licenseUrl: string | null;
  licenseLabel: string | null;
  dateModified: string | null;
  excluded: string | null;
  observations: Array<[string, number]>;
}

export interface FilingFixture {
  form: string;
  filed: string;
  reportDate: string | null;
  accession: string;
  items: string | null;
  kind: "annual-report" | "quarterly-report" | "earnings-release";
  url: string;
  indexUrl: string;
}

export interface ExcerptFixture {
  topic: string;
  text: string;
  section: string;
}

export interface CompanyFixture {
  ticker: string;
  cik: number;
  name: string;
  sic: string | null;
  sicDescription: string | null;
  fiscalYearEnd: string | null;
  exchanges: string[];
  retrievedAt: string;
  sources: { companyFacts: string; submissions: string; browse: string };
  metrics: Record<string, RawMetric>;
  filings: FilingFixture[];
  annualReport: {
    form: string;
    filed: string;
    reportDate: string | null;
    url: string;
    accession: string;
    excerpts: ExcerptFixture[];
  } | null;
}

export interface PriceFixture {
  symbol: string;
  provider: string;
  url: string;
  retrievedAt: string;
  note: string;
  columns: string[];
  splits: SplitEvent[];
  /** [date, open, high, low, close (split-adj), adjclose (split+div adj), volume] */
  rows: Array<[string, number, number, number, number, number, number]>;
}

export interface ResearchSnapshot {
  manifest: {
    projectId: string;
    builtAt: string;
    builder: string;
    counts: Record<string, number>;
  };
  macro: { retrievedAt: string; series: MacroSeriesFixture[] };
  companies: { retrievedAt: string; companies: Record<string, CompanyFixture> };
  prices: { retrievedAt: string; prices: Record<string, PriceFixture> };
}
