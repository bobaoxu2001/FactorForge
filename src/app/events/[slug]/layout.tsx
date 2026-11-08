import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import StageNav, { type Stage } from "@/components/intel/StageNav";
import { When } from "@/components/events/EventUI";
import { RESEARCH_CASES, caseBySlug } from "@/data/events";
import { SNAPSHOT, eventView, thesisViews } from "@/lib/events/view";

export const dynamicParams = false;

export function generateStaticParams() {
  return RESEARCH_CASES.map((c) => ({ slug: c.slug }));
}

export default async function EventCaseLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const views = c.events.map((e) => eventView(e.id)).filter((v) => v !== null);
  const claims = views.flatMap((v) => v.claims);
  const confirmed = claims.filter((x) => x.verification === "CONFIRMED").length;
  const read = c.sources.filter((s) => s.retrieval === "read").length;
  const theses = thesisViews().filter((t) => t.replay.thesis.caseId === c.id);
  const pricesThrough = SNAPSHOT.runLog.filter((r) => r.step === "prices" && r.last).map((r) => r.last!).sort().at(-1);
  const stages: Stage[] = [
    { slug: "", label: "Overview", step: "00" },
    { slug: "evidence", label: "Evidence & timeline", step: "01", status: `${confirmed}/${claims.length} confirmed` },
    { slug: "market", label: "Market reaction", step: "02", status: `${c.windows.length} windows` },
    { slug: "impact", label: "Impact map & exposure", step: "03" },
    { slug: "scenarios", label: "Scenarios & forecasts", step: "04" },
    { slug: "memo", label: "Research memo", step: "05" },
  ];
  return (
    <div className="space-y-6">
      <header className="relative pt-1">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="lab-eyebrow">
              <Link href="/events" className="hover:text-ink">Event radar</Link>
              <span className="text-ink-soft">/</span>
              <span>Research case</span>
            </div>
            <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] text-ink md:text-[42px]">{c.title}</h1>
            <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-muted">{c.dek}</p>
          </div>
          <dl className="grid shrink-0 grid-cols-2 border border-line bg-paper text-[12.5px] xl:max-w-[420px]">
            <div className="border-r border-line px-3 py-2">
              <dt className="text-ink-soft">Status</dt>
              <dd className="mt-0.5 font-semibold text-amber-800">Research draft · public sources</dd>
            </div>
            <div className="px-3 py-2">
              <dt className="text-ink-soft">Latest source</dt>
              <dd className="mt-0.5 font-medium text-ink"><When iso={c.asOf} /></dd>
            </div>
            <div className="border-r border-t border-line px-3 py-2">
              <dt className="text-ink-soft">Prices through</dt>
              <dd className="num mt-0.5 font-medium text-ink">{pricesThrough}</dd>
            </div>
            <div className="border-t border-line px-3 py-2">
              <dt className="text-ink-soft">Sources</dt>
              <dd className="mt-0.5 font-medium text-ink">{read} read · {c.sources.length - read} unreadable</dd>
              <span className="text-[11px] text-ink-muted">{theses.length} theses tracked</span>
            </div>
          </dl>
        </div>
      </header>
      <StageNav projectId={c.slug} basePath={`/events/${c.slug}`} stages={stages} label="Case sections" />
      {children}
      <footer className="border-t border-line pt-3 text-[12px] leading-relaxed text-ink-soft">
        Independent research workbench built from public sources, paraphrased and linked. Not affiliated with any company, agency or publisher named here. No proprietary channel checks or interviews were used. Not investment advice.
      </footer>
    </div>
  );
}
