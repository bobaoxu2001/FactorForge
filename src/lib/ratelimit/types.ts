export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Pluggable backend for fixed-window rate limiting.
 *
 * Two implementations ship:
 *   - InMemoryRateLimitStore: per-process Map (default; correct for a single
 *     long-lived Node process, weak under multi-instance / serverless).
 *   - UpstashRateLimitStore: shared Redis over the Upstash/Vercel-KV REST API,
 *     so every instance throttles against the same counters.
 *
 * The interface is async because a distributed store is a network call. The
 * in-memory store satisfies it trivially (resolved promises).
 */
export interface RateLimitStore {
  /** Stable identifier surfaced by /api/health (e.g. "memory", "upstash"). */
  readonly backend: "memory" | "upstash";

  /**
   * Register one hit against `key` and report whether it is allowed.
   * `now` is accepted for deterministic testing; distributed stores that rely on
   * server-side TTL may ignore it.
   */
  hit(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;

  /** Test-only: clear all counters. Optional — not all backends support it. */
  reset?(): Promise<void> | void;
}
