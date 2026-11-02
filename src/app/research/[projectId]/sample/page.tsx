import Link from "next/link";
import { notFound } from "next/navigation";
import SampleActions from "@/components/intel/SampleActions";
import sampleExport from "@/data/research/sample-export.json";
import { getResearchProject } from "@/lib/intel/project";
import { buildWritingSample } from "@/lib/intel/writingSample";

export const revalidate = 3600;
export const metadata = { title: "One-page research sample" };

export default function WritingSamplePage({ params }: { params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const sample = buildWritingSample(view);
  const downloadHref = sample.projectId === "freight" && sampleExport.snapshotBuiltAt === sample.snapshotBuiltAt ? sampleExport.path : undefined;
  return <div className="space-y-4">
    <SampleActions downloadHref={downloadHref} />
    <article className="writing-sample mx-auto max-w-[900px] border border-line bg-paper px-5 py-7 sm:px-9">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 text-[12px] text-ink-muted"><span>FactorForge · independent research</span><span>{sample.author} · writing sample</span></div>
      <h2 className="mt-5 text-[30px] font-semibold leading-tight text-ink">{sample.title}</h2>
      <p className="mt-2 text-[11.5px] text-ink-soft">Data snapshot {sample.snapshotBuiltAt.slice(0, 10)} · analysis as of {sample.asOfUtc} UTC · observation periods shown below</p>
      <p className="mt-4 border-l-[3px] border-accent pl-3 font-serif text-[22px] leading-snug text-ink">{sample.conclusion}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{sample.question}</p>
      <div className="mt-5 space-y-4">
        {sample.observations.map((observation) => <section key={observation.label}>
          <h3 className="text-[13px] font-semibold text-accent">{observation.label}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{observation.finding} <span className="whitespace-nowrap text-[11px] text-accent">{observation.references.map((number) => <a key={number} href={`#sample-source-${number}`}>[{number}] </a>)}</span></p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{observation.interpretation}</p>
        </section>)}
      </div>
      <div className="mt-5 grid gap-5 border-t border-line pt-4 sm:grid-cols-[0.9fr_1.1fr]">
        <section><h3 className="text-[13px] font-semibold text-accent">Alternative explanations</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-[12px] leading-relaxed text-ink-muted">{sample.alternativeExplanations.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3 className="text-[13px] font-semibold text-accent">What I would investigate next</h3><ol className="mt-2 list-decimal space-y-2 pl-4 text-[12px] leading-relaxed text-ink-muted">{sample.nextChecks.map((item) => <li key={item.question}><strong className="font-semibold text-ink">{item.question}. </strong>{item.test}</li>)}</ol></section>
      </div>
      <section className="mt-5 border-t border-line pt-3"><h3 className="text-[11px] font-semibold text-ink">Sources · numbered references link to the original series or filing</h3><ol className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">{sample.sources.map((source) => <li id={`sample-source-${source.number}`} key={source.url} className="text-[10.5px] leading-snug text-ink-muted"><a href={source.url} target="_blank" rel="noreferrer" className="hover:text-accent">[{source.number}] {source.title} ↗</a></li>)}</ol></section>
      <p className="mt-4 border-t border-line pt-3 text-[10.5px] leading-relaxed text-ink-soft">{sample.scope}</p>
    </article>
    <div className="writing-sample-actions flex flex-wrap gap-5 text-[13px] text-accent"><Link href={`/research/${sample.projectId}/memo`} className="hover:underline">Read the full research memo →</Link><Link href={`/research/${sample.projectId}/primary`} className="hover:underline">See the proposed fieldwork →</Link></div>
  </div>;
}
