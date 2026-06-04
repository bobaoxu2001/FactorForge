import Navigation from "./Navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <body className="lab-grid">
      {/* Keyboard/screen-reader users can jump past the nav straight to content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:border focus:border-blue-300/40 focus:bg-[#030914] focus:px-3 focus:py-2 focus:text-[13px] focus:text-blue-100"
      >
        Skip to content
      </a>
      <Navigation />
      <main id="main-content" className="px-4 py-6 md:px-6 lg:ml-[256px]">
        {children}
      </main>
      <footer className="border-t border-line lg:ml-[256px]">
        <div className="px-4 py-5 text-center text-[11.5px] leading-relaxed text-ink-soft md:px-6">
          Research software only. No financial advice. No broker connection. No live trading.
        </div>
      </footer>
    </body>
  );
}
