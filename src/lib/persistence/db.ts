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

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
