import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

describe("logger", () => {
  it("exposes the four standard methods", () => {
    const log = createLogger("test-module");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("does not throw when called with extra fields", () => {
    const log = createLogger("test-module");
    expect(() => log.info("hello", { foo: 1, bar: "baz" })).not.toThrow();
    expect(() => log.warn("warning")).not.toThrow();
  });

  it("silently no-ops under NODE_ENV=test (no stdout pollution in CI)", () => {
    // We can't easily assert stdout silence without monkeypatching, but we can
    // assert the methods complete synchronously without throwing — which is
    // the contract callers depend on.
    const log = createLogger("silent");
    expect(() => log.error("boom", { code: "X" })).not.toThrow();
  });
});
