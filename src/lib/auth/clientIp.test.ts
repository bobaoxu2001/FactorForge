import { describe, it, expect } from "vitest";
import { clientIpFromHeaders } from "./clientIp";

describe("clientIpFromHeaders", () => {
  it("takes the left-most entry of x-forwarded-for (the originating client)", () => {
    expect(clientIpFromHeaders("203.0.113.7, 70.41.3.18, 150.172.238.178")).toBe("203.0.113.7");
  });

  it("trims surrounding whitespace", () => {
    expect(clientIpFromHeaders("  203.0.113.7  ")).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when forwarded-for is absent", () => {
    expect(clientIpFromHeaders(null, "198.51.100.5")).toBe("198.51.100.5");
  });

  it("prefers forwarded-for over real-ip", () => {
    expect(clientIpFromHeaders("203.0.113.7", "198.51.100.5")).toBe("203.0.113.7");
  });

  it("returns null when no usable proxy header is present", () => {
    expect(clientIpFromHeaders(null)).toBeNull();
    expect(clientIpFromHeaders(undefined, null)).toBeNull();
    expect(clientIpFromHeaders("")).toBeNull();
    expect(clientIpFromHeaders("   ")).toBeNull();
    expect(clientIpFromHeaders(", , ")).toBeNull();
  });
});
