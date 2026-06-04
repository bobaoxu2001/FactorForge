import Link from "next/link";

const PUBLIC_LINKS = [
  ["Overview", "/"],
  ["Data", "/data"],
  ["Strategies", "/strategies"],
  ["Radar", "/radar"],
  ["Reports", "/reports"],
  ["OSS & Maintainers", "/oss"],
] as const;

export default function ProtectedRouteExplainer({ area }: { area?: string }) {
  const label = area === "cache" ? "admin cache controls" : area === "watchlist" ? "personal watchlists" : "saved account features";
  return (
    <section className="card p-5">
      <div className="section-label">Protected demo area</div>
      <h2 className="mt-2 text-[18px] font-semibold text-ink">Sign-in is optional for the public research demo.</h2>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-muted">
        <p>This area is optional and requires local/demo account setup.</p>
        <p>The public demo keeps {label} protected. You can explore all research pages without signing in.</p>
        <p>Accounts here are only for saved research preferences. FactorForge does not connect to brokers or place trades.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {PUBLIC_LINKS.map(([label, href]) => (
          <Link key={href} href={href} className="chip border-line bg-white/[0.04] text-ink-muted hover:text-ink">
            {label}
          </Link>
        ))}
      </div>
      <Link
        href="/"
        className="mt-5 inline-flex rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-300/15"
      >
        Continue exploring public demo
      </Link>
    </section>
  );
}
