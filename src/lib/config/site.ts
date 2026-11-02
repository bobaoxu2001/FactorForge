/**
 * Public origin for absolute URLs (metadata, OpenGraph, sitemap, robots).
 * Defaults to the live deployment so social cards and crawler files resolve
 * correctly even when SITE_URL is unset. Shared by the root layout, sitemap,
 * and robots so the origin can never drift between them.
 */
export const SITE_URL = process.env.SITE_URL ?? "https://factor-forge-ashy.vercel.app";
