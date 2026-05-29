import { describe, expect, it } from "vitest";
import { pct, pctPlain, num, usd, compact } from "./format";

describe("format helpers", () => {
  it("formats finite numbers as expected", () => {
    expect(pct(0.1234)).toBe("+12.3%");
    expect(pct(-0.05)).toBe("-5.0%");
    expect(pctPlain(0.5)).toBe("50.0%");
    expect(num(1234.5)).toBe("1,234.50");
    expect(usd(1000)).toBe("$1,000");
    expect(compact(1_500_000)).toBe("1.5M");
  });

  it("returns a dash instead of NaN/Infinity", () => {
    for (const fn of [pct, pctPlain, num, usd, compact]) {
      expect(fn(NaN)).toBe("—");
      expect(fn(Infinity)).toBe("—");
      expect(fn(-Infinity)).toBe("—");
    }
  });

  it("tolerates nullish input without throwing", () => {
    // Upstream data occasionally hands us null/undefined; guard rather than crash.
    expect(num(undefined as unknown as number)).toBe("—");
    expect(usd(null as unknown as number)).toBe("—");
  });
});
