import "server-only";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type DatabaseInstance = ReturnType<typeof Database>;

let dbInstance: DatabaseInstance | null = null;
let initFailed = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS backtest_cache (
  cache_key   TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backtest_cache_strategy ON backtest_cache(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_cache_created  ON backtest_cache(created_at);

CREATE TABLE IF NOT EXISTS metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_symbols (
  user_id   TEXT NOT NULL,
  symbol    TEXT NOT NULL,
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, symbol),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_symbols(user_id);

CREATE TABLE IF NOT EXISTS paper_ledger_positions (
  position_id       TEXT PRIMARY KEY,
  strategy_id       TEXT NOT NULL,
  symbol            TEXT NOT NULL,
  strategy_name     TEXT NOT NULL,
  status            TEXT NOT NULL,
  promoted_at       INTEGER NOT NULL,
  entry_date        TEXT NOT NULL,
  entry_price       REAL NOT NULL,
  current_date      TEXT NOT NULL,
  current_price     REAL NOT NULL,
  shares            REAL NOT NULL,
  allocated_capital REAL NOT NULL,
  radar_score       INTEGER NOT NULL,
  last_signal_date  TEXT,
  last_signal_type  TEXT,
  data_provider     TEXT NOT NULL,
  is_fallback       INTEGER NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  closed_at         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_paper_ledger_status ON paper_ledger_positions(status);
CREATE INDEX IF NOT EXISTS idx_paper_ledger_strategy_symbol ON paper_ledger_positions(strategy_id, symbol);
`;

function dbPath(): string {
  const cacheDir = path.join(process.cwd(), ".cache");
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "factorforge.db");
}

export function getDb(): DatabaseInstance | null {
  if (dbInstance) return dbInstance;
  if (initFailed) return null;
  try {
    const db = new Database(dbPath());
    db.pragma("journal_mode = WAL");
    // SQLite disables foreign-key enforcement per-connection by default, so the
    // ON DELETE CASCADE on watchlist_symbols would silently never fire. Turn it
    // on before applying the schema.
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
    dbInstance = db;
    return db;
  } catch (error) {
    initFailed = true;
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.warn("[persistence] SQLite unavailable, running without cache:", error instanceof Error ? error.message : error);
    }
    return null;
  }
}

/**
 * True when the SQLite layer can be opened in this deployment. False on
 * read-only/ephemeral hosts (e.g. Vercel's serverless filesystem) where the
 * native binding can't open a writable database. Account creation, sign-in, and
 * watchlists depend on this; the UI uses it to show a friendly demo-mode notice
 * instead of a persistence error, and the research pages run uncached either way.
 */
export function isPersistenceAvailable(): boolean {
  return getDb() !== null;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
