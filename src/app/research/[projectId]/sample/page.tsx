import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import SampleActions from "@/components/intel/SampleActions";
import sampleExport from "@/data/research/sample-export.json";
import { getResearchProject } from "@/lib/intel/project";
import { buildWritingSample, sampleExportMatches } from "@/lib/intel/writingSample";

export const revalidate = 3600;
export const metadata = { title: "One-page research sample" };

function CitedSampleText({ text, parts, references = [] }: { text: string; parts?: Array<{ text: string; references: number[] }>; references?: number[] }) {
  return <>{(parts ?? [{ text, references }]).map((part, index) => <Fragment key={index}>{part.text}{part.references.length > 0 && <span className="text-[12px] text-accent"> {part.references.map((number) => <a key={number} href={`#sample-source-${number}`}>[{number}]</a>)}</span>}</Fragment>)}</>;
}

export default async function WritingSamplePage({ params: paramsPromise }: { params: Promise<{ projectId: string }> }) {
  const params = await paramsPromise;
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const sample = buildWritingSample(view);
  const downloadHref = sample.projectId === "freight" && sampleExportMatches(sample, sampleExport) ? `${sampleExport.path}?v=${sample.contentHash.slice(0, 12)}` : undefined;
  return <div className="space-y-4">
    <article className="writing-sample mx-auto max-w-[1100px] border border-line bg-paper px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 text-[13px] text-ink-muted"><span>FactorForge · independent public-source research</span><span>{sample.author} · {sample.authorRole} · {sample.asOfUtc}</span></div>
      <h1 className="mt-4 text-[30px] font-semibold leading-tight text-ink">{sample.title}</h1>
      <p className="mt-2 text-[13px] text-ink-muted">Public-source research sample · Primary fieldwork proposed · edition {sample.researchVersion}</p>
      <p className="mt-4 border-l-[3px] border-accent pl-3 font-serif text-[22px] leading-snug text-ink">{sample.conclusion}</p>
      <div className="writing-sample-actions mt-4 flex flex-wrap items-center gap-4"><SampleActions downloadHref={downloadHref} /><Link href={`/research/${sample.projectId}/memo`} className="text-[13px] font-medium text-accent hover:underline">Full research memo →</Link></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {sample.observations.map((observation) => <section key={observation.label} className="border-t border-line pt-3">
          <h3 className="text-[13px] font-semibold text-accent">{observation.label}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-ink"><CitedSampleText text={observation.finding} parts={observation.findingParts} references={observation.references} /></p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted"><CitedSampleText text={observation.interpretation} parts={observation.interpretationParts} /></p>
        </section>)}
      </div>
      <div className="mt-5 grid gap-5 border-t border-line pt-4 sm:grid-cols-[0.9fr_1.1fr]">
        <section><h3 className="text-[14px] font-semibold text-accent">Alternative explanations</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-[13px] leading-relaxed text-ink-muted">{sample.alternativeExplanations.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3 className="text-[14px] font-semibold text-accent">What I would investigate next</h3><ol className="mt-2 list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-ink-muted">{sample.nextChecks.map((item) => <li key={item.question}><strong className="font-semibold text-ink">{item.question}. </strong>{item.test}</li>)}</ol></section>
      </div>
      <section className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-muted"><h3 className="font-semibold text-ink">Project leadership & AI tools</h3><p className="mt-2">{sample.contribution}</p><p className="mt-2">{sample.aiAssistance}</p></section>
      <section className="mt-5 border-t border-line pt-3"><h3 className="text-[13px] font-semibold text-ink">Sources · numbered references link to the original series or filing</h3><ol className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">{sample.sources.map((source) => <li id={`sample-source-${source.number}`} key={source.url} className="text-[12px] leading-relaxed text-ink-muted"><a href={source.url} target="_blank" rel="noreferrer" className="hover:text-accent">[{source.number}] {source.title} ↗</a></li>)}</ol></section>
      <details className="mt-5 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted"><summary className="cursor-pointer font-medium text-ink">Research question and fixed information cutoff</summary><p className="mt-2">{sample.question}</p><p className="mt-2">Edition {sample.researchVersion} · analysis date {sample.asOfUtc} UTC · information cutoff {sample.informationCutoff}. No automatic date rollover.</p><p className="mt-2">Macro retrieved {sample.componentDates?.macro}; SEC fundamentals retrieved {sample.componentDates?.companies}; market prices retrieved {sample.componentDates?.prices}; direct Cass extract retrieved {sample.componentDates?.directSources}. Observation periods differ and are shown with each finding.</p></details>
      <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted">{sample.scope}</p>
    </article>
    <div className="writing-sample-actions flex flex-wrap gap-5 text-[13px] text-accent"><Link href={`/research/${sample.projectId}`} className="hover:underline">Research overview →</Link><Link href={`/research/${sample.projectId}/primary`} className="hover:underline">See the proposed fieldwork →</Link></div>
  </div>;
}
