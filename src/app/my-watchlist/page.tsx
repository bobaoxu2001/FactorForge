import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import StatusBadge from "@/components/badges/StatusBadge";
import AddSymbolForm from "@/components/auth/AddSymbolForm";
import { removeWatchlistSymbolAction, signOutAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";
import { getWatchlistFor } from "@/lib/persistence/watchlist";
import { DEFAULT_SYMBOLS } from "@/data/watchlist";

export const dynamic = "force-dynamic";

export default async function MyWatchlistPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");
  const entries = getWatchlistFor(session.userId);
  const defaultSymbols = DEFAULT_SYMBOLS as readonly string[];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="section-label">Account</div>
          <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">My watchlist</h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
            Signed in as <span className="text-ink">{session.username}</span>. Your watchlist is stored locally in the FactorForge SQLite database — no third-party identity provider.
          </p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-[12.5px] text-ink-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </header>

      <section className="card p-5">
        <div className="panel-title">Add a symbol</div>
        <AddSymbolForm />
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft">
          {entries.length} symbol{entries.length === 1 ? "" : "s"} on watchlist
        </div>
        {entries.length === 0 ? (
          <div className="p-6 text-[13px] text-ink-muted">
            Empty list. The shared research dataset runs on the default universe ({defaultSymbols.join(", ")}). Symbols you save here are kept on your account; ones already in the default universe are fully researched across the platform, while custom additions are bookmarked for follow-up but not yet fed into the shared backtest run.
          </div>
        ) : (
          <table className="w-full min-w-[480px] text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-left">Added</th>
                <th className="px-4 py-3 text-right">Source</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-soft">
              {entries.map((entry) => {
                const isDefault = defaultSymbols.includes(entry.symbol);
                return (
                  <tr key={entry.symbol}>
                    <td className="px-4 py-3 font-medium text-ink">{entry.symbol}</td>
                    <td className="px-4 py-3 text-ink-muted">{new Date(entry.addedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={isDefault ? "in default watchlist" : "custom"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={removeWatchlistSymbolAction} className="inline-flex">
                        <input type="hidden" name="symbol" value={entry.symbol} />
                        <button
                          type="submit"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.04] text-ink-muted hover:text-rose-200"
                          aria-label={`Remove ${entry.symbol} from watchlist`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5">
        <div className="panel-title">How this works</div>
        <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
          <li>• Passwords are hashed with bcrypt (10 rounds) and stored in <code className="text-ink">.cache/factorforge.db</code>.</li>
          <li>• Sessions are signed iron-session cookies (httpOnly, lax samesite, secure in production).</li>
          <li>• Watchlist rows have a foreign-key cascade — deleting your account would drop the symbols too.</li>
          <li>• Set <code className="text-ink">SESSION_PASSWORD</code> (≥32 chars random) before deploying. The dev default is shipped for local convenience only.</li>
        </ul>
      </section>
    </div>
  );
}
