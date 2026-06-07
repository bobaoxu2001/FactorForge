import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/layout/AppShell";

// Public origin for absolute metadata/OpenGraph URLs. Defaults to the live
// deployment so social cards resolve correctly even when SITE_URL is unset.
const SITE_URL = process.env.SITE_URL ?? "https://factor-forge-ashy.vercel.app";
const TITLE = "FactorForge — AI Quant Research Lab";
const DESCRIPTION =
  "AI-powered stock strategy research platform for factor discovery, backtesting, market stress analysis, hotspot monitoring, and simulated model-portfolio observation. Research only — not investment advice.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · FactorForge",
  },
  description: DESCRIPTION,
  applicationName: "FactorForge",
  authors: [{ name: "FactorForge" }],
  category: "finance",
  keywords: [
    "quant research",
    "factor discovery",
    "backtesting",
    "market stress analysis",
    "market hotspots",
    "model portfolio",
    "stock strategy research",
    "open source",
    "Next.js",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "FactorForge",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // favicon.ico, icon.svg, apple-icon.png and opengraph-image.png are picked up
  // automatically from src/app via Next.js file-based metadata conventions.
};

export const viewport: Viewport = {
  themeColor: "#02040b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <AppShell>{children}</AppShell>
    </html>
  );
}
