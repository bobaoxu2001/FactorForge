import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  module?: string;
  ts: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return env in LEVEL_ORDER ? env : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel()];
}

function emit(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;
  // In tests we don't want noisy stdout. NODE_ENV is "test" under vitest.
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, extra: Record<string, unknown> = {}) =>
      emit({ level: "debug", msg, module, ts: new Date().toISOString(), ...extra }),
    info: (msg: string, extra: Record<string, unknown> = {}) =>
      emit({ level: "info", msg, module, ts: new Date().toISOString(), ...extra }),
    warn: (msg: string, extra: Record<string, unknown> = {}) =>
      emit({ level: "warn", msg, module, ts: new Date().toISOString(), ...extra }),
    error: (msg: string, extra: Record<string, unknown> = {}) =>
      emit({ level: "error", msg, module, ts: new Date().toISOString(), ...extra }),
  };
}
