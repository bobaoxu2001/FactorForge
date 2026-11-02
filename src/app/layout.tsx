import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { SITE_URL } from "@/lib/config/site";

// Self-hosted at build time by next/font, so the CSP's font-src 'self' still holds.
const sans = Public_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Next 14.2 ships no fallback metrics for Newsreader, so the fallback is declared rather than auto-adjusted.
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif", display: "swap", adjustFontFallback: false, fallback: ["Georgia", "serif"] });

const TITLE = "FactorForge — AI-Native Equity Research & Market Intelligence";
const DESCRIPTION =
  "Research-first workspace for industry mapping, SEC-sourced fundamentals, KPI tracking, evidence-graded theses, primary-research planning, research memos and quantitative factor analysis. Research only, not investment advice.";

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
    "equity research",
    "market intelligence",
    "industry mapping",
    "channel checks",
    "research memo",
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
  themeColor: "#eef0f3",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <AppShell>{children}</AppShell>
    </html>
  );
}
