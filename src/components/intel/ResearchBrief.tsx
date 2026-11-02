import Link from "next/link";
import type { CompanyView } from "@/lib/intel/companies";
import type { ResearchProjectView } from "@/lib/intel/project";
import { buildCompanyBrief, buildResearchBrief } from "@/lib/intel/researchBrief";
import { EvidenceLinks, KeyFinding, Panel } from "./ui";

export default function ResearchBrief({ view }: { view: ResearchProjectView }) {
  const brief = buildResearchBrief(view);
  const pid = view.config.id;
  return (
    <Panel eyebrow="Research brief · public-data case study" title="The question, the evidence, the next test">
      <KeyFinding>{brief.conclusion}</KeyFinding>
      <p className="mt-3 max-w-[85ch] text-[14px] leading-relaxed text-ink-muted">{brief.framing}</p>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {brief.observations.map((item) => (
          <div key={item.label} className="border-t-2 border-accent/40 pt-3">
            <h3 className="text-[13px] font-semibold text-accent">{item.label}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{item.finding}</p>
            <div className="mt-2"><EvidenceLinks ids={item.evidenceIds} projectId={pid} /></div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{item.interpretation}</p>
          </div>
        ))}
      </div>
      <details className="mt-5 border-t border-line pt-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-ink">What would change this view?</summary>
        <ol className="mt-3 grid gap-3 lg:grid-cols-3">
          {brief.nextChecks.map((item) => (
            <li key={item.question} className="text-[12.5px] leading-relaxed text-ink-muted"><strong className="mb-1 block font-semibold text-ink">{item.question}</strong>{item.test}</li>
          ))}
        </ol>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-[12.5px]">
        <span className="text-ink-soft">Public sources and reproducible calculations; no primary interviews are included in this public study.</span>
        <Link href={`/research/${pid}/memo`} className="font-medium text-accent hover:underline">Read the research memo →</Link>
      </div>
    </Panel>
  );
}

export function CompanyResearchBrief({ company, view }: { company: CompanyView; view: ResearchProjectView }) {
  const observations = buildCompanyBrief(company, view);
  return (
    <Panel eyebrow="Research reading" title="What the results establish — and what remains open">
      <div className="grid gap-4 lg:grid-cols-2">
        {observations.map((item) => (
          <div key={item.label}>
            <h3 className="text-[12.5px] font-semibold text-accent">{item.label}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink">{item.finding}</p>
            <div className="mt-2"><EvidenceLinks ids={item.evidenceIds} projectId={view.config.id} /></div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{item.interpretation}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed">
        <strong className="font-semibold text-ink">Next test: </strong><span className="text-ink-muted">{company.coverage.researchAngle} Review segment-level volume, yield and cost commentary in the filings before assigning a mechanism.</span>
      </div>
    </Panel>
  );
}
