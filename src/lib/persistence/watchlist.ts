import "server-only";
import { getDb } from "./db";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("watchlist");

export interface WatchlistEntry {
  symbol: string;
  addedAt: number;
}

export function getWatchlistFor(userId: string): WatchlistEntry[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare<[string], { symbol: string; added_at: number }>(
        "SELECT symbol, added_at FROM watchlist_symbols WHERE user_id = ? ORDER BY added_at DESC",
      )
      .all(userId);
    return rows.map((row) => ({ symbol: row.symbol, addedAt: row.added_at }));
  } catch (error) {
    log.warn("watchlist read failed", { userId, error: errorMessage(error) });
    return [];
  }
}

export function addSymbolToWatchlist(userId: string, symbolRaw: string): { ok: true } | { ok: false; reason: string } {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return { ok: false, reason: "Symbol must be 1–8 alphanumeric characters" };
  const db = getDb();
  if (!db) return { ok: false, reason: "Persistence layer unavailable" };
  try {
    db.prepare(
      "INSERT OR IGNORE INTO watchlist_symbols (user_id, symbol, added_at) VALUES (?, ?, ?)",
    ).run(userId, symbol, Date.now());
    return { ok: true };
  } catch (error) {
    log.warn("watchlist add failed", { userId, symbol, error: errorMessage(error) });
    return { ok: false, reason: "Failed to persist watchlist entry" };
  }
}

export function removeSymbolFromWatchlist(userId: string, symbolRaw: string): void {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return;
  const db = getDb();
  if (!db) return;
  try {
    db.prepare("DELETE FROM watchlist_symbols WHERE user_id = ? AND symbol = ?").run(userId, symbol);
  } catch (error) {
    log.warn("watchlist remove failed", { userId, symbol, error: errorMessage(error) });
  }
}

function normalizeSymbol(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,8}$/.test(trimmed)) return null;
  return trimmed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
