import "server-only";
import manifest from "@/__fixtures__/research/freight/manifest.json";
import macro from "@/__fixtures__/research/freight/macro.json";
import cassLinehaul from "@/__fixtures__/research/freight/cass-linehaul.json";
import revision from "@/data/research/revision.json";
import sourceChecks from "@/data/research/source-checks.json";
import companiesFixture from "@/__fixtures__/research/freight/companies.json";
import pricesFixture from "@/__fixtures__/research/freight/prices.json";
import { RESEARCH_PROJECTS } from "@/data/research/projects";
import type { ResearchProjectConfig } from "@/data/research/types";
import { marketSectorAttribution, type MarketSectorAttribution } from "./attribution";
import { adjCloses, buildCompanyView, type CompanyView } from "./companies";
import { buildEvidence, validateEvidence } from "./evidence";
import { buildKpiViews, buildLeadLagViews, fuelAdjustedResidual, type FuelResidualAnalysis, type LeadLagView } from "./kpis";
import { classifyMemo, runQualityChecks } from "./quality";
import type { ResearchSnapshot } from "./snapshot";
import { applyStances, evaluateHypotheses } from "./thesis";
import type { Evidence, HypothesisView, KpiSeriesView, MemoStatus, QualityCheck, Relationship, ValueChainNode } from "./types";

/**
 * Server-side assembly of a research project from its config + committed
 * snapshot. Published editions pin their cutoff and freshness date; explicit
 * dates remain available for analysis tests.
 */

export interface Catalyst {
  date: string;
  kind: "data-release" | "earnings-estimate";
  label: string;
  detail: string;
  url?: string;
  confirmed: boolean;
  kpiId?: string;
  ticker?: string;
}

export interface ResearchProjectView {
  config: ResearchProjectConfig;
  asOf: string;
  revision?: { id: string; date: string; informationCutoff: string };
  componentDates?: { macro: string; companies: string; prices: string; directSources: string };
  snapshot: { builtAt: string; ageDays: number; builder: string };
  kpis: KpiSeriesView[];
  residuals: FuelResidualAnalysis[];
  leadLag: LeadLagView[];
  companies: CompanyView[];
  attribution: Record<string, MarketSectorAttribution | null>;
  evidence: Evidence[];
  evidenceIssues: string[];
  hypotheses: HypothesisView[];
  valueChain: { nodes: ValueChainNode[]; relationships: Relationship[] };
  marketStructure: Array<{ heading: string; points: string[]; evidenceIds: string[] }>;
  quality: QualityCheck[];
  memoStatus: MemoStatus;
  catalysts: Catalyst[];
}

const SNAPSHOTS: Record<string, ResearchSnapshot> = {
  freight: {
    revision,
    manifest,
    macro: { ...macro, series: [...macro.series, cassLinehaul] } as ResearchSnapshot["macro"],
    companies: companiesFixture as unknown as ResearchSnapshot["companies"],
    prices: pricesFixture as unknown as ResearchSnapshot["prices"],
  },
};

export const PROJECT_CONFIGS: Record<string, ResearchProjectConfig> = Object.fromEntries(RESEARCH_PROJECTS.map((p) => [p.id, p]));

export function listProjectIds(): string[] {
  return Object.keys(PROJECT_CONFIGS);
}

export function getSnapshot(projectId: string): ResearchSnapshot | null {
  return SNAPSHOTS[projectId] ?? null;
}

function parseReleaseDate(text: string | null): string | null {
  if (!text || /not available/i.test(text)) return null;
  const t = Date.parse(`${text} 12:00 UTC`);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

export function buildProjectView(config: ResearchProjectConfig, snapshot: ResearchSnapshot, now: Date): ResearchProjectView {
  if (snapshot.revision) {
    const cutoff = Date.parse(snapshot.revision.informationCutoff);
    const retrievals = [snapshot.manifest.builtAt, snapshot.macro.retrievedAt, snapshot.companies.retrievedAt, snapshot.prices.retrievedAt, ...snapshot.macro.series.map((s) => s.retrievedAt)];
    if (!Number.isFinite(cutoff) || retrievals.some((date) => !Number.isFinite(Date.parse(date)) || Date.parse(date) > cutoff)) {
      throw new Error("Research sources are newer than the fixed edition cutoff. Publish a new research edition and regenerate its PDF.");
    }
  }
  const asOf = now.toISOString().slice(0, 10);
  const kpis = buildKpiViews(config, snapshot.macro.series, now);
  const kpiById = new Map(kpis.map((k) => [k.kpi.id, k]));
  const fuel = kpiById.get(config.fuelKpiId);
  const residualTargets = kpis.filter((k) => k.kpi.category === "pricing");
  const residuals = fuel
    ? residualTargets.map((k) => fuelAdjustedResidual(k, fuel)).filter((r): r is FuelResidualAnalysis => r !== null)
    : [];
  const prices = snapshot.prices.prices;
  const market = prices[config.marketBenchmark.symbol];
  const sector = prices[config.sectorBenchmark.symbol];
  const companies = config.companies
    .map((coverage) => {
      const fixture = snapshot.companies.companies[coverage.ticker];
      return fixture ? buildCompanyView(fixture, coverage, prices[coverage.ticker], market, sector, asOf) : null;
    })
    .filter((c): c is CompanyView => c !== null);

  const attribution: Record<string, MarketSectorAttribution | null> = {};
  if (market && sector) {
    const lastDate = market.rows.at(-1)?.[0] ?? asOf;
    const twoYearsBack = `${Number(lastDate.slice(0, 4)) - 2}${lastDate.slice(4)}`;
    for (const c of companies) {
      const p = prices[c.ticker];
      attribution[c.ticker] = p ? marketSectorAttribution(adjCloses(p), adjCloses(market), adjCloses(sector), twoYearsBack) : null;
    }
  }

  const { evidence: rawEvidence, resolvedClaims } = buildEvidence(config, kpis, residuals, companies);
  const ctx = {
    kpis: kpiById,
    residuals: new Map(residuals.map((r) => [r.kpiId, r])),
    companies: new Map(companies.map((c) => [c.ticker, c])),
    evidenceIds: new Set(rawEvidence.map((e) => e.id)),
  };
  const hypotheses = evaluateHypotheses(config.hypotheses, ctx);
  const checkedEvidence = (sourceChecks as Evidence[]).filter((item) => item.projectId === config.id && item.retrievedAt <= now.toISOString());
  const evidence = applyStances([...rawEvidence, ...checkedEvidence], hypotheses);

  const claimEvidence = (ids: string[]) => ids.map((id) => resolvedClaims.get(id)).filter((r) => r?.found).map((r) => r!.evidenceId);
  const relationships: Relationship[] = config.valueChain.relationships.map((r) => {
    const evidenceIds = claimEvidence(r.excerptClaimIds);
    return {
      id: r.id,
      from: r.from,
      to: r.to,
      type: r.type,
      label: r.label,
      rationale: r.rationale,
      evidenceIds,
      status: evidenceIds.length > 0 ? "verified" : r.fallbackStatus,
    };
  });

  const catalysts: Catalyst[] = [];
  for (const k of kpis) {
    const date = parseReleaseDate(k.source.nextRelease);
    if (date && date >= asOf) {
      catalysts.push({ date, kind: "data-release", label: `${k.kpi.name} release`, detail: `${k.source.release ?? "Scheduled release"} (next release date per FRED).`, url: k.source.url, confirmed: true, kpiId: k.kpi.id });
    }
  }
  for (const c of companies) {
    if (c.nextEarningsEstimate) {
      catalysts.push({ date: c.nextEarningsEstimate.date, kind: "earnings-estimate", label: `${c.ticker} quarterly results (estimated)`, detail: c.nextEarningsEstimate.basis, url: c.sources.browse, confirmed: false, ticker: c.ticker });
    }
  }
  catalysts.sort((a, b) => a.date.localeCompare(b.date));

  const quality = runQualityChecks({ config, evidence, hypotheses, kpis, companies, primaryResearchCount: 0, scenarioProbabilityCount: 0 });
  const builtAt = snapshot.manifest.builtAt;
  return {
    config,
    asOf,
    revision: snapshot.revision,
    componentDates: { macro: snapshot.macro.retrievedAt, companies: snapshot.companies.retrievedAt, prices: snapshot.prices.retrievedAt, directSources: cassLinehaul.retrievedAt },
    snapshot: { builtAt, ageDays: Math.max(0, Math.floor((now.getTime() - Date.parse(builtAt)) / 86_400_000)), builder: snapshot.manifest.builder },
    kpis,
    residuals,
    leadLag: buildLeadLagViews(config, kpis),
    companies,
    attribution,
    evidence,
    evidenceIssues: validateEvidence(evidence),
    hypotheses,
    valueChain: { nodes: config.valueChain.nodes, relationships },
    marketStructure: config.marketStructure.map((s) => ({ heading: s.heading, points: s.points, evidenceIds: claimEvidence(s.excerptClaimIds) })),
    quality,
    memoStatus: classifyMemo(quality, hypotheses),
    catalysts,
  };
}

const cache = new Map<string, ResearchProjectView>();

export function getResearchProject(projectId: string, now?: Date): ResearchProjectView | null {
  const config = PROJECT_CONFIGS[projectId];
  const snapshot = SNAPSHOTS[projectId];
  if (!config || !snapshot) return null;
  // A published work sample is a fixed research edition, not a visitor-clock date.
  const effectiveNow = now ?? new Date(snapshot.revision?.informationCutoff ?? snapshot.manifest.builtAt);
  const key = `${projectId}::${effectiveNow.toISOString()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const view = buildProjectView(config, snapshot, effectiveNow);
  cache.clear();
  cache.set(key, view);
  return view;
}

export function getCompany(view: ResearchProjectView, ticker: string): CompanyView | undefined {
  return view.companies.find((c) => c.ticker === ticker.toUpperCase());
}
