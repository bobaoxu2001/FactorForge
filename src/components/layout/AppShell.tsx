import Navigation from "./Navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <body className="lab-grid">
      <Navigation />
      <main className="px-4 py-6 md:px-6 lg:ml-[236px]">{children}</main>
      <footer className="border-t border-line lg:ml-[236px]">
        <div className="px-4 py-5 text-center text-[11.5px] leading-relaxed text-ink-soft md:px-6">
          This platform is for research and simulated trading demonstration only. It does not constitute investment advice. Historical backtests do not represent future returns.
        </div>
      </footer>
    </body>
  );
}
