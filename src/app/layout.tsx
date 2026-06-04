import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/layout/AppShell";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "An open-source AI-assisted quantitative research workbench for factor signals, backtests, portfolio diagnostics, and clearly labeled research memos.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FactorForge — OSS Quant Research Workbench",
    template: "%s · FactorForge",
  },
  description: DESCRIPTION,
  applicationName: "FactorForge",
  authors: [{ name: "FactorForge" }],
  keywords: ["quant research", "backtest", "factor signals", "portfolio diagnostics", "open source", "Next.js"],
  openGraph: {
    type: "website",
    siteName: "FactorForge",
    title: "FactorForge — OSS Quant Research Workbench",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: "FactorForge — OSS Quant Research Workbench", description: DESCRIPTION },
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
