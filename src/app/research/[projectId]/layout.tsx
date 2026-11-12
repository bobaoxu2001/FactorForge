import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import StageNav, { type Stage } from "@/components/intel/StageNav";
import { getResearchProject, listProjectIds } from "@/lib/intel/project";
import { MEMO_STATUS_LABEL } from "@/lib/intel/quality";
import WorkspaceStorageNotice from "@/components/intel/WorkspaceStorageNotice";

// Every valid id is known at build time; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return listProjectIds().map((projectId) => ({ projectId }));
}

export default async function ResearchProjectLayout({ children, params: paramsPromise }: { children: ReactNode; params: Promise<{ projectId: string }> }) {
  const params = await paramsPromise;
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const verified = view.valueChain.relationships.filter((r) => r.status === "verified").length;
  const decided = view.hypotheses.filter((h) => h.overall !== "insufficient-data").length;
  const fresh = view.kpis.filter((k) => k.freshness === "fresh").length;
  const priceDates = [...new Set(view.companies.flatMap((company) => company.priceStats ? [company.priceStats.lastDate] : []))].sort();
  const priceDateLabel = priceDates.length === 1 ? priceDates[0] : priceDates.length ? `${priceDates[0]}–${priceDates.at(-1)}` : "Unavailable";
  const financialPeriods = [...new Set(view.companies.flatMap((company) => company.latest ? [company.latest.label] : []))];
  const stages: Stage[] = [
    { slug: "sample", label: "One-page brief", step: "Read" },
    { slug: "", label: "Overview", step: "00" },
    { slug: "industry", label: "Industry map", step: "01", status: `${verified}/${view.valueChain.relationships.length} verified` },
    { slug: "evidence", label: "Evidence", step: "02", status: `${view.evidence.length} items` },
    { slug: "kpis", label: "KPIs", step: "03", status: `${fresh}/${view.kpis.length} fresh` },
    { slug: "companies", label: "Competitive intel", step: "04", status: `${view.companies.length} cos` },
    { slug: "primary", label: "Primary research", step: "05", status: "plan" },
    { slug: "thesis", label: "Thesis & decision", step: "06", status: `${decided}/${view.hypotheses.length} public-data screens evaluated; direct validation incomplete` },
    { slug: "memo", label: "Memo", step: "07", status: "public-source sample" },
    { slug: "copilot", label: "Copilot", step: "AI" },
  ];
  return (
    <div className="research-project-layout space-y-6">
      <header className="research-project-header relative pt-1">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="lab-eyebrow">
              <Link href="/" className="hover:text-ink">Research</Link>
              <span className="text-ink-soft">/</span>
              <span>{view.config.industry}</span>
            </div>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.08] text-ink md:text-[44px]">{view.config.title}</h1>
            <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-muted">{view.config.subtitle}</p>
          </div>
          <dl className="grid shrink-0 grid-cols-2 border border-line bg-paper text-[12.5px] xl:max-w-[400px]">
            <div className="border-r border-line px-3 py-2">
              <dt className="text-ink-soft">Status</dt>
              <dd className={`mt-0.5 font-semibold ${view.memoStatus === "public-source" ? "text-accent" : "text-amber-800"}`}>{MEMO_STATUS_LABEL[view.memoStatus]}</dd>
            </div>
            <div className="px-3 py-2" title={`Snapshot built ${view.snapshot.builtAt}`}>
              <dt className="text-ink-soft">Research edition</dt>
              <dd className="num mt-0.5 font-semibold text-ink">{view.asOf} · {view.revision?.id.split("-").at(-1) ?? "fixed snapshot"}</dd>
              <span className="text-[11px] text-ink-muted">Macro {view.componentDates?.macro.slice(0, 10)} · SEC / prices {view.componentDates?.companies.slice(0, 10)}</span>
            </div>
            <div className="border-r border-t border-line px-3 py-2">
              <dt className="text-ink-soft">Prices through</dt>
              <dd className="num mt-0.5 font-medium text-ink">{priceDateLabel}</dd>
            </div>
            <div className="border-t border-line px-3 py-2">
              <dt className="text-ink-soft">Financial periods</dt>
              <dd className="mt-0.5 font-medium text-ink">{financialPeriods.join(" / ") || "Unavailable"}</dd>
              {financialPeriods.length > 1 && <span className="text-[11px] text-amber-800">Latest filed; periods differ</span>}
            </div>
          </dl>
        </div>
      </header>
      <StageNav projectId={view.config.id} stages={stages} />
      <WorkspaceStorageNotice projectId={view.config.id} />
      {children}
      <footer className="research-project-footer border-t border-line pt-3 text-[12px] leading-relaxed text-ink-soft">
        Independent research workbench. Not affiliated with, or endorsed by, any company, data provider or research firm named here. Sources: SEC EDGAR; FRED (BTS, BLS, EIA, Census Bureau, Federal Reserve Board, and Cass Information Systems, whose data are copyrighted and shown with citation as FRED&apos;s terms require); Yahoo Finance prices. Not investment advice.
      </footer>
    </div>
  );
}
