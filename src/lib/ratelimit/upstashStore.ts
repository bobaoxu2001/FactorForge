import { createLogger } from "@/lib/observability/logger";
import type { RateLimitResult, RateLimitStore } from "./types";

const log = createLogger("ratelimit-upstash");

/**
 * Distributed fixed-window rate limiter backed by Upstash Redis (or Vercel KV,
 * which exposes the same REST API). Every app instance increments the SAME
 * counter, so the limit holds across a horizontally-scaled / serverless fleet —
 * unlike the per-process in-memory store.
 *
 * Algorithm (atomic, standard fixed-window-on-Redis):
 *   count = INCR key
 *   if count == 1: PEXPIRE key windowMs   // first hit in the window sets TTL
 *   ttl = PTTL key
 * Pipelined into a single REST round-trip. Server-side TTL means we never need
 * client clocks to agree — `now` from the interface is ignored here.
 *
 * Failure policy: FAIL-OPEN. If Redis is unreachable we log and allow the
 * request rather than locking every user out of auth on an infra blip. A
 * stricter deployment could flip this to fail-closed.
 *
 * No SDK dependency — talks the documented REST protocol over fetch.
 */
export class UpstashRateLimitStore implements RateLimitStore {
  readonly backend = "upstash" as const;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly timeoutMs = 1_500,
    private readonly keyPrefix = "rl:",
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `${this.keyPrefix}${key}`;
    try {
      // Pipeline: INCR, (conditional) PEXPIRE, PTTL. We always send PEXPIRE with
      // NX so the TTL is only set on the first hit of a window, not refreshed on
      // every request (which would turn fixed-window into a never-expiring key).
      const commands = [
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs), "NX"],
        ["PTTL", redisKey],
      ];
      const res = await this.pipeline(commands);
      // res is an array of { result } | { error } in command order.
      const count = Number(res[0]?.result ?? 0);
      const pttl = Number(res[2]?.result ?? windowMs);
      const retryAfterSeconds = pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(windowMs / 1000);

      if (count > limit) {
        return { allowed: false, retryAfterSeconds };
      }
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (error) {
      // Fail open — never let a rate-limit infra failure block legitimate auth.
      log.warn("upstash rate-limit unavailable, failing open", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  private async pipeline(commands: string[][]): Promise<Array<{ result?: unknown; error?: string }>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.url}/pipeline`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`upstash HTTP ${response.status}`);
      }
      return (await response.json()) as Array<{ result?: unknown; error?: string }>;
    } finally {
      clearTimeout(timer);
    }
  }
}
