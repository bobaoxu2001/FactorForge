import { notFound } from "next/navigation";
import { CitedProse, When } from "@/components/events/EventUI";
import { Note } from "@/components/intel/ui";
import { caseBySlug } from "@/data/events";
import { buildEventMemo } from "@/lib/events/memo";
import { PLATFORM_AS_OF } from "@/lib/events/view";

export const metadata = { title: "Event research memo" };

export default async function EventMemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const sections = buildEventMemo(c);

  return (
    <article className="card mx-auto max-w-[860px] p-6 md:p-10">
      <header className="border-b border-line pb-5">
        <div className="text-[12.5px] font-medium text-ink-soft">Research memo · draft from public sources</div>
        <h2 className="mt-1 font-serif text-[28px] font-semibold leading-tight text-ink md:text-[34px]">{c.title}</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          Latest source <When iso={c.asOf} /> · market data built <When iso={PLATFORM_AS_OF} /> · claims cited as links to the evidence page.
        </p>
        <div className="mt-4">
          <Note>
            Sections marked &ldquo;from data&rdquo; are generated from the verified claims and measured market checks, so every number traces to a source or a calculation. Sections marked &ldquo;interpretation&rdquo; are the case author&apos;s reading. Not investment advice.
          </Note>
        </div>
      </header>
      {sections.map((s, i) => (
        <section key={s.title} className="mt-7">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-serif text-[21px] font-semibold text-ink">
              <span className="num mr-2 text-[15px] text-ink-soft">{i + 1}</span>
              {s.title}
            </h3>
            <span className={`text-[11.5px] font-medium ${s.kind === "analyst" ? "text-amber-800" : "text-ink-soft"}`}>{s.kind === "analyst" ? "interpretation" : "from data"}</span>
          </div>
          <div className="mt-2 space-y-3 text-[15px] leading-[1.7] text-ink">
            {s.paragraphs.map((p) => (
              <p key={p} className="max-w-[72ch]">
                <CitedProse text={p} caseSlug={c.slug} />
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
