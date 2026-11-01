import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import StageNav, { type Stage } from "@/components/intel/StageNav";
import { getResearchProject, listProjectIds } from "@/lib/intel/project";
import { MEMO_STATUS_LABEL } from "@/lib/intel/quality";

// Every valid id is known at build time; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return listProjectIds().map((projectId) => ({ projectId }));
}

export default function ResearchProjectLayout({ children, params }: { children: ReactNode; params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const verified = view.valueChain.relationships.filter((r) => r.status === "verified").length;
  const decided = view.hypotheses.filter((h) => h.overall !== "insufficient-data").length;
  const fresh = view.kpis.filter((k) => k.freshness === "fresh").length;
  const stages: Stage[] = [
    { slug: "", label: "Overview", step: "00" },
    { slug: "industry", label: "Industry map", step: "01", status: `${verified}/${view.valueChain.relationships.length} verified` },
    { slug: "evidence", label: "Evidence", step: "02", status: `${view.evidence.length} items` },
    { slug: "kpis", label: "KPIs", step: "03", status: `${fresh}/${view.kpis.length} fresh` },
    { slug: "companies", label: "Competitive intel", step: "04", status: `${view.companies.length} cos` },
    { slug: "primary", label: "Primary research", step: "05", status: "plan" },
    { slug: "thesis", label: "Thesis & decision", step: "06", status: `${decided}/${view.hypotheses.length} tested` },
    { slug: "memo", label: "Memo", step: "07", status: view.memoStatus === "evidence-backed" ? "evidence-backed" : "draft" },
    { slug: "copilot", label: "Copilot", step: "AI" },
  ];
  return (
    <div className="space-y-5">
      <header className="relative">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="lab-eyebrow">
              <Link href="/" className="hover:text-white">Research</Link>
              <span className="text-ink-soft">/</span>
              <span>{view.config.industry}</span>
            </div>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white md:text-[32px]">{view.config.title}</h1>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">{view.config.subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11.5px]">
            <span className={`chip ${view.memoStatus === "evidence-backed" ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-amber-300/35 bg-amber-400/10 text-amber-100"}`}>
              {MEMO_STATUS_LABEL[view.memoStatus]}
            </span>
            <span className="rounded-lg border border-line bg-white/[0.035] px-2.5 py-1.5 text-ink-muted" title={`Snapshot built ${view.snapshot.builtAt}`}>
              Data as of {view.snapshot.builtAt.slice(0, 10)} · {view.snapshot.ageDays}d old
            </span>
          </div>
        </div>
      </header>
      <StageNav projectId={view.config.id} stages={stages} />
      {children}
      <footer className="pt-2 text-[11px] leading-relaxed text-ink-soft">
        Independent research workbench. Not affiliated with, or endorsed by, any company, data provider or research firm named here. Sources: SEC EDGAR; FRED (BTS, BLS, EIA, Census Bureau, Federal Reserve Board, and Cass Information Systems, whose data are copyrighted and shown with citation as FRED&apos;s terms require); Yahoo Finance prices. Not investment advice.
      </footer>
    </div>
  );
}
