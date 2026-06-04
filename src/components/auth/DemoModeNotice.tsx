import Link from "next/link";

// Local-setup docs. Account features (saved watchlists/preferences) require a
// writable persistence backend, which the public demo intentionally omits.
const SETUP_DOCS_URL = "https://github.com/bobaoxu2001/FactorForge#run-locally";

type Mode = "sign-in" | "sign-up";

interface LinkSpec {
  label: string;
  href: string;
  external?: boolean;
  primary?: boolean;
}

const COPY: Record<
  Mode,
  { title: string; lines: string[]; links: LinkSpec[] }
> = {
  "sign-up": {
    title: "Account creation is disabled in the public demo.",
    lines: [
      "Saved watchlists and preferences require a local or configured database deployment.",
      "You can still explore all public research pages without signing in.",
      "FactorForge does not connect to brokers, place trades, or store brokerage credentials.",
    ],
    links: [
      { label: "Continue exploring public demo", href: "/", primary: true },
      { label: "View OSS & Maintainers", href: "/oss" },
      { label: "Read local setup docs", href: SETUP_DOCS_URL, external: true },
    ],
  },
  "sign-in": {
    title: "Sign-in is disabled in the public demo.",
    lines: [
      "Accounts are only for saved research preferences and watchlists in local or configured deployments.",
      "You can still use Overview, Data, Factors, Strategies, Radar, Consensus, Portfolio, AI Market, Paper Trading, and Reports without signing in.",
      "FactorForge does not connect to brokers, place trades, or store brokerage credentials.",
    ],
    links: [
      { label: "Continue exploring public demo", href: "/", primary: true },
      { label: "Reports", href: "/reports" },
      { label: "View OSS & Maintainers", href: "/oss" },
      { label: "Read local setup docs", href: SETUP_DOCS_URL, external: true },
    ],
  },
};

function areaLabel(area: string | undefined): string {
  if (area === "cache") return "admin cache controls";
  if (area === "watchlist") return "personal watchlists";
  return "saved account features";
}

/**
 * Shown on the sign-in / sign-up routes when the persistence layer is
 * unavailable (public demo). Replaces the credential form with an honest,
 * non-scary explanation and links back into the read-only research surface.
 * Never surfaces the raw "Persistence layer unavailable" engine string.
 */
export default function DemoModeNotice({ mode, area }: { mode: Mode; area?: string }) {
  const copy = COPY[mode];
  return (
    <div className="grid min-h-[60vh] place-items-center py-8">
      <section className="card w-full max-w-xl p-6">
        <div className="section-label">Public demo mode</div>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{copy.title}</h1>

        <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink-muted">
          {copy.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        {area && (
          <div className="mt-4 rounded-xl border border-line bg-white/[0.035] p-4 text-[12.5px] leading-relaxed text-ink-muted">
            <p>
              This page requires saved-preference storage ({areaLabel(area)}), which is disabled in the public demo.
            </p>
            <p className="mt-1">Use local setup with SQLite or a configured persistence backend to enable it.</p>
            <p className="mt-1">Public demo remains read-only for safety.</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {copy.links.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className={linkClass(link.primary)}
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={linkClass(link.primary)}>
                {link.label}
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function linkClass(primary?: boolean): string {
  return primary
    ? "inline-flex rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-[13px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/20"
    : "chip border-line bg-white/[0.04] text-ink-muted hover:text-ink";
}
