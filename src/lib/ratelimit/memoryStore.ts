import type { RateLimitResult, RateLimitStore } from "./types";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Per-process fixed-window store. State lives in a module-scoped Map, so it is
 * correct for one long-lived Node process but does NOT coordinate across
 * instances — under serverless / horizontally-scaled deployments each instance
 * keeps its own counters. Use {@link UpstashRateLimitStore} there.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  readonly backend = "memory" as const;

  private buckets = new Map<string, Bucket>();

  // Once the map crosses this many keys we sweep expired buckets on the next
  // hit. Without it a flood of distinct keys (random usernames) would grow the
  // map unboundedly, since entries are otherwise replaced but never removed.
  private static readonly SWEEP_THRESHOLD = 10_000;

  private sweepExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }

  async hit(key: string, limit: number, windowMs: number, now: number = Date.now()): Promise<RateLimitResult> {
    if (this.buckets.size >= InMemoryRateLimitStore.SWEEP_THRESHOLD) this.sweepExpired(now);
    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (existing.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
    }
    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }
}
