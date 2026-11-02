"use client";

export default function SampleActions({ downloadHref }: { downloadHref?: string }) {
  return <div className="writing-sample-actions flex flex-wrap items-center gap-3 text-[13px]">
    {downloadHref && <a href={downloadHref} download className="rounded-md border border-accent bg-accent px-3 py-2 font-medium text-white hover:bg-accent/90">Download one-page PDF</a>}
    <button type="button" onClick={() => window.print()} className="rounded-md border border-line bg-paper px-3 py-2 font-medium text-ink hover:border-accent/40">Print this brief</button>
    <span className="text-ink-soft">Public-data research sample · no interviews included</span>
  </div>;
}
