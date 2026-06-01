import "server-only";
import { createLogger } from "@/lib/observability/logger";
import type { RateLimitResult, RateLimitStore } from "./types";
import { InMemoryRateLimitStore } from "./memoryStore";
import { UpstashRateLimitStore } from "./upstashStore";

export type { RateLimitResult, RateLimitStore } from "./types";

const log = createLogger("ratelimit");

let store: RateLimitStore | null = null;

/**
 * Read the Upstash/Vercel-KV REST credentials. Accepts either provider's env
 * var names so the same code runs on Upstash or Vercel KV unchanged.
 */
function upstashCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

/** True when a distributed (multi-instance-safe) rate-limit backend is configured. */
export function isDistributedRateLimitConfigured(): boolean {
  return upstashCredentials() !== null;
}

/**
 * Lazily build the rate-limit store. Prefers the distributed Upstash backend
 * when credentials are present; otherwise falls back to the per-process
 * in-memory store. Singleton so the in-memory Map persists across calls.
 */
export function getRateLimitStore(): RateLimitStore {
  if (store) return store;
  const creds = upstashCredentials();
  if (creds) {
    store = new UpstashRateLimitStore(creds.url, creds.token);
    log.info("rate-limit backend selected", { backend: "upstash" });
  } else {
    store = new InMemoryRateLimitStore();
    log.info("rate-limit backend selected", { backend: "memory" });
  }
  return store;
}

/** The active backend name, for /api/health. Does not allocate if already built. */
export function rateLimitBackend(): RateLimitStore["backend"] {
  return getRateLimitStore().backend;
}

/**
 * Register one hit against `key`. Thin async wrapper over the active store so
 * call sites don't need to know which backend is wired.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now?: number,
): Promise<RateLimitResult> {
  return getRateLimitStore().hit(key, limit, windowMs, now);
}

/** Test-only: reset the active store and drop the singleton so env changes re-select. */
export async function resetRateLimits(): Promise<void> {
  if (store?.reset) await store.reset();
  store = null;
}

/** Test-only: force a specific store (e.g. inject a fake Upstash). */
export function __setRateLimitStore(next: RateLimitStore | null): void {
  store = next;
}
