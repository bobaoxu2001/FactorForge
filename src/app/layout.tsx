import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/layout/AppShell";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "An AI quant research lab: real market data into factor signals, cost-aware backtests, score-weighted portfolios, and LLM-written research memos.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FactorForge — AI Quant Research Lab",
    template: "%s · FactorForge",
  },
  description: DESCRIPTION,
  applicationName: "FactorForge",
  authors: [{ name: "FactorForge" }],
  keywords: ["quant", "backtest", "factor investing", "research", "trading", "Next.js"],
  openGraph: {
    type: "website",
    siteName: "FactorForge",
    title: "FactorForge — AI Quant Research Lab",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: "FactorForge — AI Quant Research Lab", description: DESCRIPTION },
  icons: { icon: "/favicon.ico" },
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
