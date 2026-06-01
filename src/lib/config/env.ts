/**
 * Centralized environment validation.
 *
 * `validateEnv` is a pure function over an env-like object so it can be unit
 * tested without mutating `process.env`. It distinguishes:
 *   - errors:   misconfiguration that is unsafe in production (fail fast)
 *   - warnings: degraded-but-functional states (e.g. no LLM key → template mode)
 *   - features: which optional capabilities are wired, for the /api/health probe
 *
 * The health endpoint surfaces this; `assertProductionEnv` lets a server entry
 * point refuse to boot a misconfigured production process.
 */

const VALID_LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export interface EnvFeatures {
  /** DeepSeek LLM memos enabled (else deterministic template). */
  llm: boolean;
  /** Polygon.io second-tier real-data provider configured. */
  polygon: boolean;
  /** Alpha Vantage third-tier real-data provider configured. */
  alphaVantage: boolean;
  /** A non-default, sufficiently long session signing key is set. */
  sessionConfigured: boolean;
  /** A shared (multi-instance-safe) rate-limit store is configured. */
  distributedRateLimit: boolean;
}

export interface EnvValidation {
  ok: boolean;
  nodeEnv: string;
  errors: string[];
  warnings: string[];
  features: EnvFeatures;
}

type EnvLike = Record<string, string | undefined>;

export const MIN_SESSION_PASSWORD_LENGTH = 32;

export function validateEnv(env: EnvLike = process.env): EnvValidation {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const sessionPassword = env.SESSION_PASSWORD ?? "";
  const sessionConfigured = sessionPassword.length >= MIN_SESSION_PASSWORD_LENGTH;
  if (isProduction && !sessionConfigured) {
    errors.push(
      `SESSION_PASSWORD must be set to a random string of at least ${MIN_SESSION_PASSWORD_LENGTH} characters in production`,
    );
  } else if (!sessionConfigured) {
    warnings.push("SESSION_PASSWORD unset — using the insecure dev default. Set it before deploying.");
  }

  const logLevel = env.LOG_LEVEL?.toLowerCase();
  if (logLevel && !VALID_LOG_LEVELS.includes(logLevel as (typeof VALID_LOG_LEVELS)[number])) {
    warnings.push(`LOG_LEVEL "${env.LOG_LEVEL}" is not one of ${VALID_LOG_LEVELS.join(" | ")}; defaulting to info.`);
  }

  // A shared rate-limit store needs both a REST URL and token. Accept either the
  // Upstash or the Vercel-KV env-var names (same REST protocol).
  const distributedRateLimit = Boolean(
    (env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL) &&
      (env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN),
  );

  const features: EnvFeatures = {
    llm: Boolean(env.DEEPSEEK_API_KEY),
    polygon: Boolean(env.POLYGON_API_KEY),
    alphaVantage: Boolean(env.ALPHA_VANTAGE_API_KEY),
    sessionConfigured,
    distributedRateLimit,
  };

  if (!features.llm) {
    warnings.push("DEEPSEEK_API_KEY unset — AI memos use the deterministic template.");
  }
  if (!features.polygon && !features.alphaVantage) {
    warnings.push("No secondary data provider key — relying on Yahoo with synthetic fallback only.");
  }
  // In production the per-process limiter is a real weakness: under multiple
  // instances an attacker gets N× the auth attempts. Warn (don't hard-fail —
  // a single-instance prod deploy is still legitimately protected).
  if (isProduction && !distributedRateLimit) {
    warnings.push(
      "No shared rate-limit store (UPSTASH_REDIS_REST_URL/TOKEN) — auth throttling is per-process and will not hold across multiple instances.",
    );
  }

  return { ok: errors.length === 0, nodeEnv, errors, warnings, features };
}

/** Throw if the environment is unsafe for production. No-op otherwise. */
export function assertProductionEnv(env: EnvLike = process.env): void {
  const result = validateEnv(env);
  if (!result.ok) {
    throw new Error(`Invalid production environment:\n - ${result.errors.join("\n - ")}`);
  }
}
