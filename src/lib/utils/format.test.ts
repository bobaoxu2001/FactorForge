import { describe, expect, it } from "vitest";
import { pct, pctPlain, num, usd, compact, signedText, signedTone } from "./format";

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

describe("signed tones", () => {
  it("never renders a loss in the gain tone", () => {
    expect(signedTone(0.12)).toBe("positive");
    expect(signedTone(0)).toBe("positive");
    expect(signedTone(-0.001)).toBe("negative");
    expect(signedText(0.12)).toBe("text-emerald-300");
    expect(signedText(-0.12)).toBe("text-rose-300");
  });

  it("falls back to neutral for degenerate values", () => {
    expect(signedTone(NaN)).toBe("default");
    expect(signedTone(Infinity)).toBe("default");
    expect(signedText(NaN)).toBe("text-ink");
    expect(signedText(undefined as unknown as number)).toBe("text-ink");
  });
});
