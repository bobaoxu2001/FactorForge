import { describe, expect, it } from "vitest";
import { validateEnv, assertProductionEnv, MIN_SESSION_PASSWORD_LENGTH } from "./env";

const longSecret = "x".repeat(MIN_SESSION_PASSWORD_LENGTH);

describe("validateEnv", () => {
  it("errors in production when SESSION_PASSWORD is missing or too short", () => {
    const result = validateEnv({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/SESSION_PASSWORD/);
    expect(result.features.sessionConfigured).toBe(false);
  });

  it("passes in production when a long SESSION_PASSWORD is set", () => {
    const result = validateEnv({ NODE_ENV: "production", SESSION_PASSWORD: longSecret });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.features.sessionConfigured).toBe(true);
  });

  it("treats a missing session secret in development as a warning, not an error", () => {
    const result = validateEnv({ NODE_ENV: "development" });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/SESSION_PASSWORD/);
  });

  it("reflects optional provider + LLM keys in features", () => {
    const result = validateEnv({
      NODE_ENV: "development",
      SESSION_PASSWORD: longSecret,
      DEEPSEEK_API_KEY: "k",
      POLYGON_API_KEY: "k",
      ALPHA_VANTAGE_API_KEY: "k",
      ALPACA_PAPER_API_KEY_ID: "paper-key",
      ALPACA_PAPER_API_SECRET: "paper-secret",
    });
    expect(result.features).toMatchObject({ llm: true, polygon: true, alphaVantage: true, alpacaPaper: true });
    // No degraded-mode warnings when everything is wired.
    expect(result.warnings.join(" ")).not.toMatch(/DEEPSEEK_API_KEY/);
    expect(result.warnings.join(" ")).not.toMatch(/secondary data provider/);
  });

  it("detects a distributed rate-limit store from Upstash or Vercel-KV env vars", () => {
    expect(validateEnv({ NODE_ENV: "development", SESSION_PASSWORD: longSecret }).features.distributedRateLimit).toBe(false);

    const upstash = validateEnv({
      NODE_ENV: "development",
      SESSION_PASSWORD: longSecret,
      UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "tok",
    });
    expect(upstash.features.distributedRateLimit).toBe(true);

    const vercelKv = validateEnv({
      NODE_ENV: "development",
      SESSION_PASSWORD: longSecret,
      KV_REST_API_URL: "https://x.kv.vercel-storage.com",
      KV_REST_API_TOKEN: "tok",
    });
    expect(vercelKv.features.distributedRateLimit).toBe(true);
  });

  it("warns in production when no shared rate-limit store is configured", () => {
    const result = validateEnv({ NODE_ENV: "production", SESSION_PASSWORD: longSecret });
    // Still ok (single-instance prod is legitimate) but flagged.
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/shared rate-limit store/);
  });

  it("does not warn about rate limiting when a shared store is configured in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      SESSION_PASSWORD: longSecret,
      UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "tok",
    });
    expect(result.warnings.join(" ")).not.toMatch(/shared rate-limit store/);
  });

  it("warns on an invalid LOG_LEVEL", () => {
    const result = validateEnv({ NODE_ENV: "development", SESSION_PASSWORD: longSecret, LOG_LEVEL: "verbose" });
    expect(result.warnings.join(" ")).toMatch(/LOG_LEVEL/);
  });

  it("warns when no secondary data provider key is present", () => {
    const result = validateEnv({ NODE_ENV: "development", SESSION_PASSWORD: longSecret });
    expect(result.warnings.join(" ")).toMatch(/secondary data provider/);
  });

  it("warns when Alpaca paper sync is only partially configured", () => {
    const result = validateEnv({
      NODE_ENV: "development",
      SESSION_PASSWORD: longSecret,
      ALPACA_PAPER_API_KEY_ID: "paper-key",
    });
    expect(result.features.alpacaPaper).toBe(false);
    expect(result.warnings.join(" ")).toMatch(/Alpaca paper sync/);
  });
});

describe("assertProductionEnv", () => {
  it("throws when production env is invalid", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production" })).toThrow(/Invalid production environment/);
  });

  it("does not throw when production env is valid", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production", SESSION_PASSWORD: longSecret })).not.toThrow();
  });
});
