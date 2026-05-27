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
