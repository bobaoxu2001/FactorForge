import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rateLimit";

// Back-compat surface: the shim still exposes checkRateLimit/resetRateLimits,
// now async. Behavior must match the original fixed-window semantics.
describe("checkRateLimit — fixed-window throttle (via back-compat shim)", () => {
  beforeEach(async () => {
    await resetRateLimits();
  });

  it("allows up to the limit then blocks within the window", async () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect((await checkRateLimit("k", 3, 1000, now)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit("k", 3, 1000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets once the window elapses", async () => {
    const start = 5_000_000;
    expect((await checkRateLimit("k", 1, 1000, start)).allowed).toBe(true);
    expect((await checkRateLimit("k", 1, 1000, start + 500)).allowed).toBe(false);
    // After the window, the bucket is fresh again.
    expect((await checkRateLimit("k", 1, 1000, start + 1500)).allowed).toBe(true);
  });

  it("tracks distinct keys independently", async () => {
    const now = 9_000_000;
    expect((await checkRateLimit("a", 1, 1000, now)).allowed).toBe(true);
    expect((await checkRateLimit("a", 1, 1000, now)).allowed).toBe(false);
    expect((await checkRateLimit("b", 1, 1000, now)).allowed).toBe(true);
  });
});
