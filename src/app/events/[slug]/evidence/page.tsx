import { notFound } from "next/navigation";
import { caseMetadata } from "@/lib/events/caseMetadata";
import { ClaimCard, EvidenceRefs, When } from "@/components/events/EventUI";
import { Note, Panel } from "@/components/intel/ui";
import { caseBySlug } from "@/data/events";
import { TIER_LABEL } from "@/lib/events/sources";
import { eventView } from "@/lib/events/view";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => caseMetadata(params, "Evidence");

export default async function EventEvidencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) notFound();
  const views = c.events.map((e) => eventView(e.id)).filter((v) => v !== null);
  const claims = views.flatMap((v) => v.claims);
  const sources = new Map(c.sources.map((s) => [s.id, s]));
  const timeline = c.events.flatMap((e) => e.timeline.map((t) => ({ ...t, event: e.title }))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const topics = [...new Set(claims.map((x) => x.topic))];
  const citedBy = (sourceId: string) => claims.filter((x) => x.citations.some((ci) => ci.sourceId === sourceId)).map((x) => x.id);

  return (
    <div className="space-y-5">
      <Note>
        Each claim shows what kind of statement it is and how well it is sourced as of today. Verification is computed from the sources, never typed in: an official document stated first-hand confirms; two independent newsrooms corroborate; one report, or unnamed sourcing, stays reported; rewrites alone are rumour; a source that contradicts makes a claim disputed. Copies of one wire story count once. Texts are paraphrased; follow the links for the originals.
      </Note>

      <Panel title="Evidence timeline" eyebrow="When things happened and when they became known" source="Case sources listed below; times shown in UTC (hover for the original offset).">
        <ol className="relative space-y-4 border-l border-line pl-5">
          {timeline.map((t) => (
            <li key={`${t.at}-${t.label}`} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden />
              <div className="text-[12px] text-ink-soft">
                <When iso={t.at} precision={t.precision} /> · {t.event}
              </div>
              <p className="mt-0.5 max-w-[80ch] text-[14px] leading-relaxed text-ink">{t.label}</p>
              {t.claimIds.length > 0 && (
                <div className="mt-1">
                  <EvidenceRefs ids={t.claimIds} caseSlug={c.slug} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </Panel>

      {topics.map((topic) => (
        <Panel key={topic} title={topic} eyebrow={`${claims.filter((x) => x.topic === topic).length} claims`}>
          {claims
            .filter((x) => x.topic === topic)
            .map((x) => (
              <ClaimCard key={x.id} claim={x} sources={sources} />
            ))}
        </Panel>
      ))}

      <Panel title="Sources" eyebrow={`${c.sources.length} sources · ${c.sources.filter((s) => s.retrieval !== "read").length} could not be read`} source="Retrieval attempted by this platform; unread sources support no claim.">
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-line text-[12px] text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium md:pl-6">Source</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Published</th>
                <th scope="col" className="px-3 py-2 font-medium">Retrieval</th>
                <th scope="col" className="px-3 py-2 font-medium md:pr-6">Cited by</th>
              </tr>
            </thead>
            <tbody>
              {c.sources.map((s) => (
                <tr key={s.id} id={s.id} className="border-b border-line align-top last:border-0">
                  <td className="px-5 py-2.5 md:pl-6">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">{s.title}</a>
                    <div className="text-[12px] text-ink-soft">{s.publisher}{s.originator ? ` · content from ${s.originator}` : ""}{s.interestedParty ? " · interested party" : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink-muted">{TIER_LABEL[s.tier]}</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink-muted"><When iso={s.publishedAt} precision={s.publishedPrecision} /></td>
                  <td className="px-3 py-2.5 text-[12.5px]">
                    <span className={s.retrieval === "read" ? "text-ink" : "font-medium text-rose-800"}>{s.retrieval === "read" ? "read" : s.retrieval}</span>
                    {s.retrievalNote && <div className="mt-0.5 max-w-[42ch] text-[12px] text-ink-muted">{s.retrievalNote}</div>}
                  </td>
                  <td className="px-3 py-2.5 md:pr-6"><EvidenceRefs ids={citedBy(s.id)} caseSlug={c.slug} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
