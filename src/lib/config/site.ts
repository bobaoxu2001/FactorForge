/**
 * Public origin for absolute URLs (metadata, OpenGraph, sitemap, robots).
 * Defaults to the live deployment so social cards and crawler files resolve
 * correctly even when SITE_URL is unset or blank. Shared by the root layout, sitemap,
 * and robots so the origin can never drift between them.
 */
export const DEFAULT_SITE_URL = "https://factor-forge-ashy.vercel.app";

/** Keep metadata and crawl URLs on one origin; never carry a path, query or credentials. */
export function resolveSiteUrl(value?: string): string {
  const configured = value?.trim();
  if (!configured) return DEFAULT_SITE_URL;
  try {
    const url = new URL(configured);
    if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) throw new Error();
    return url.origin;
  } catch {
    // Do not echo a misconfigured URL: it may contain credentials or query secrets.
    throw new Error("SITE_URL must be an absolute HTTP(S) URL without credentials.");
  }
}

export const SITE_URL = resolveSiteUrl(process.env.SITE_URL);
