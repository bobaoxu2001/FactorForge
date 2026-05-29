import "server-only";

/**
 * Minimal in-memory fixed-window rate limiter for auth endpoints.
 *
 * Scope note: state lives in a module-level Map, so it is per-process. Under a
 * multi-instance / serverless deployment each instance keeps its own counters,
 * which weakens (but does not remove) the protection. For a single long-lived
 * Node process — the default for this project — it correctly throttles brute
 * force against a given key. A production hardening step would move this to a
 * shared store (Redis, Upstash) keyed the same way.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Once the map crosses this many keys we sweep out expired buckets on the next
// check. Without this, a flood of distinct keys (e.g. random usernames) would
// grow the map unboundedly since entries are otherwise only replaced, never removed.
const SWEEP_THRESHOLD = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size >= SWEEP_THRESHOLD) sweepExpired(now);
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test-only: drop all tracked buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
