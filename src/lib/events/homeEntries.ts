import "server-only";
import { RESEARCH_CASES, caseBySlug } from "@/data/events";
import { eventView, pricesThrough, thesisViews } from "./view";

/**
 * Homepage entries for the event cases. Everything shown comes from each
 * case's own records: the featured case's question, view, interpretation
 * strength and first-listed uncertainty are the shared current assessment,
 * unshortened, so the homepage cannot carry a stronger copy of the
 * conclusion. Entries open the brief; the case root stays the Updates page.
 */

export const FEATURED_CASE_SLUG = "ai-datacenter-shock";

export const caseBriefHref = (slug: string) => `/events/${slug}/brief`;
export const caseUpdatesHref = (slug: string) => `/events/${slug}`;

export interface FeaturedCase {
  slug: string;
  title: string;
  briefHref: string;
  impactHref: string;
  evidenceHref: string;
  question: string;
  view: string;
  interpretation: string;
  keyUncertainty: string;
  factsVerification: string | null;
  assessedAt: string;
  sourcesThrough: string;
  pricesThrough: string | null;
}

export function featuredCase(): FeaturedCase {
  const c = caseBySlug(FEATURED_CASE_SLUG)!;
  const a = c.currentAssessment!;
  return {
    slug: c.slug,
    title: c.title,
    briefHref: caseBriefHref(c.slug),
    impactHref: `/events/${c.slug}/impact`,
    evidenceHref: `/events/${c.slug}/evidence`,
    question: a.question,
    view: a.view,
    interpretation: a.interpretation.strength,
    keyUncertainty: a.uncertainty[0].text,
    factsVerification: eventView(c.primaryEventId)?.verification.toLowerCase() ?? null,
    assessedAt: a.at,
    sourcesThrough: c.asOf,
    pricesThrough: pricesThrough().equity,
  };
}

export interface OtherEventCase {
  slug: string;
  title: string;
  question: string;
  briefHref: string;
  hasAssessment: boolean;
}

export function otherEventCases(): OtherEventCase[] {
  return RESEARCH_CASES.filter((c) => c.slug !== FEATURED_CASE_SLUG).map((c) => ({
    slug: c.slug,
    title: c.title,
    question: c.currentAssessment?.question ?? thesisViews().find((t) => t.replay.thesis.caseId === c.id)?.replay.thesis.question ?? c.dek,
    briefHref: caseBriefHref(c.slug),
    hasAssessment: !!c.currentAssessment,
  }));
}
