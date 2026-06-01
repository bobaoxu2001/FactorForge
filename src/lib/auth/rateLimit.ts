/**
 * Back-compat shim. The rate limiter moved to `@/lib/ratelimit`, which adds a
 * pluggable store (in-memory by default, distributed Upstash/Vercel-KV when
 * configured) so the limit holds across a multi-instance deployment.
 *
 * Existing imports of `checkRateLimit` / `resetRateLimit` from here keep working;
 * note `checkRateLimit` is now async (returns a Promise).
 */
export {
  checkRateLimit,
  resetRateLimits,
  getRateLimitStore,
  rateLimitBackend,
  isDistributedRateLimitConfigured,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/ratelimit";
