import type { Metadata } from "next";
import { caseBySlug } from "@/data/events";

/** Page title that names the case, so two cases' sections are told apart in tabs, history and search results. */
export async function caseMetadata(params: Promise<{ slug: string }>, section: string, description?: string): Promise<Metadata> {
  const { slug } = await params;
  const c = caseBySlug(slug);
  if (!c) return { title: section };
  return { title: `${section}: ${c.title}`, description: description ?? c.dek };
}
