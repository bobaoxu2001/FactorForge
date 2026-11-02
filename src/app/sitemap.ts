import type { MetadataRoute } from "next";
import { STRATEGY_CATALOG } from "@/data/strategyCatalog";
import { RESEARCH_PROJECTS } from "@/data/research/projects";
import { SITE_URL } from "@/lib/config/site";

/**
 * Public, crawlable routes. Strategy detail pages are derived from the
 * catalog so a new strategy is indexed automatically. Auth pages, the
 * sign-in-gated watchlist, and the protected admin route are deliberately
 * excluded — robots.ts disallows them as well.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/quant",
  "/research/frameworks",
  "/learn",
  "/data",
  "/factors",
  "/strategies",
  "/radar",
  "/consensus",
  "/portfolio",
  "/ai-market",
  "/picks",
  "/hotspots",
  "/paper-trading",
  "/simulator",
  "/track-record",
  "/reports",
  "/oss",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
  const strategies = STRATEGY_CATALOG.map((definition) => ({
    url: `${SITE_URL}/strategies/${definition.id}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
  const research = RESEARCH_PROJECTS.flatMap((project) => [
    ...["", "/industry", "/evidence", "/kpis", "/companies", "/primary", "/thesis", "/memo", "/copilot"].map((stage) => ({
      url: `${SITE_URL}/research/${project.id}${stage}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: stage === "" ? 0.9 : 0.7,
    })),
    ...project.companies.map((c) => ({
      url: `${SITE_URL}/research/${project.id}/companies/${c.ticker}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]);
  return [...routes, ...strategies, ...research];
}
