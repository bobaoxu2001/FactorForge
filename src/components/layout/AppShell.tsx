import Navigation from "./Navigation";
import PublicDemoNotice from "@/components/research/PublicDemoNotice";
import { isPersistenceAvailable } from "@/lib/persistence/db";

export default function AppShell({ children }: { children: React.ReactNode }) {
  // Server-evaluated: drives the sidebar's "disabled in public demo" hint so the
  // protected routes (My Watchlist / Cache) are labeled honestly.
  const persistenceAvailable = isPersistenceAvailable();
  return (
    <body className="bg-bg font-sans text-ink">
      {/* Keyboard/screen-reader users can jump past the nav straight to content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:border focus:border-accent/40 focus:bg-paper focus:px-3 focus:py-2 focus:text-[13px] focus:text-accent"
      >
        Skip to content
      </a>
      <Navigation persistenceAvailable={persistenceAvailable} />
      <main id="main-content" className="px-4 pb-10 pt-4 md:px-8 lg:ml-[256px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="public-demo-notice mb-6">
            <PublicDemoNotice />
          </div>
          {children}
        </div>
      </main>
      <footer className="app-footer border-t border-line lg:ml-[256px]">
        <div className="max-w-[80ch] px-4 py-6 md:px-8">
          <div className="text-[12.5px] font-medium text-ink-muted">
            FactorForge — AI-Native Equity Research &amp; Market Intelligence
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
            Research software only — for educational and research use, not investment advice. Independent project, not
            affiliated with any company, data provider or research firm it cites. The model portfolio is a
            simulated research portfolio, not a real-money trading account, and historical performance does not indicate
            future results. No live order execution and no live trading.
          </p>
        </div>
      </footer>
    </body>
  );
}
