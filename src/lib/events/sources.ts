import type { SourceRecord, SourceTier } from "./types";

/**
 * Source identity and independence.
 *
 * Ten outlets printing one wire story are one source. Independence is decided
 * by the *origin* of the content: follow `republishes` links to the root, then
 * group by the root's originator (or publisher). AMP and mobile copies of the
 * same article collapse by canonical URL first.
 */

/** Canonical form of a URL for duplicate detection. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|amp)\./, "");
    let pathname = u.pathname.replace(/\/amp\/?$/, "").replace(/\.amp$/, "").replace(/\/+$/, "");
    if (pathname === "") pathname = "/";
    return `${host}${pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Follow republication links to the originating source. Cycles stop at the first repeat. */
export function rootSource(source: SourceRecord, byId: Map<string, SourceRecord>): SourceRecord {
  let current = source;
  const seen = new Set<string>([source.id]);
  while (current.republishes && byId.has(current.republishes) && !seen.has(current.republishes)) {
    seen.add(current.republishes);
    current = byId.get(current.republishes)!;
  }
  return current;
}

/** Key that two sources share when they are not independent of each other. */
export function independenceKey(source: SourceRecord, byId: Map<string, SourceRecord>): string {
  const root = rootSource(source, byId);
  return (root.originator ?? root.publisher).trim().toLowerCase();
}

/** Collapse copies of the same article (same canonical URL), keeping the earliest. */
export function dedupeSources(sources: SourceRecord[]): { unique: SourceRecord[]; duplicates: Array<{ kept: string; dropped: string }> } {
  const byUrl = new Map<string, SourceRecord>();
  const duplicates: Array<{ kept: string; dropped: string }> = [];
  const sorted = [...sources].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  for (const s of sorted) {
    const key = canonicalUrl(s.url);
    const existing = byUrl.get(key);
    if (existing) duplicates.push({ kept: existing.id, dropped: s.id });
    else byUrl.set(key, s);
  }
  return { unique: [...byUrl.values()], duplicates };
}

/** Count independent origins among a set of sources. */
export function countIndependent(sources: SourceRecord[], all: SourceRecord[]): number {
  const byId = new Map(all.map((s) => [s.id, s]));
  const unique = dedupeSources(sources).unique;
  return new Set(unique.map((s) => independenceKey(s, byId))).size;
}

export const TIER_LABEL: Record<SourceTier, string> = {
  "primary-official": "Official primary source",
  "primary-company": "Company statement (interested party)",
  "primary-technical": "Original technical report",
  "market-data": "Market dataset",
  "independent-reporting": "Independent reporting",
  "secondary-aggregator": "Secondary / aggregator",
};

/** Rank used when sorting evidence: lower is stronger. */
export const TIER_RANK: Record<SourceTier, number> = {
  "primary-official": 0,
  "market-data": 1,
  "primary-technical": 2,
  "primary-company": 3,
  "independent-reporting": 4,
  "secondary-aggregator": 5,
};
