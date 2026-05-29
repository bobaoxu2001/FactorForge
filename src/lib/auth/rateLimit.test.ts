import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rateLimit";

describe("checkRateLimit — fixed-window throttle", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows up to the limit then blocks within the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("k", 3, 1000, now).allowed).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 1000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets once the window elapses", () => {
    const start = 5_000_000;
    expect(checkRateLimit("k", 1, 1000, start).allowed).toBe(true);
    expect(checkRateLimit("k", 1, 1000, start + 500).allowed).toBe(false);
    // After the window, the bucket is fresh again.
    expect(checkRateLimit("k", 1, 1000, start + 1500).allowed).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const now = 9_000_000;
    expect(checkRateLimit("a", 1, 1000, now).allowed).toBe(true);
    expect(checkRateLimit("a", 1, 1000, now).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 1000, now).allowed).toBe(true);
  });
});
