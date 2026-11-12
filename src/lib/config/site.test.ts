import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, resolveSiteUrl } from "./site";

describe("public site origin", () => {
  it.each([undefined, "", " ", "\n\t"])("uses the stable production origin for blank %j", (value) => {
    expect(resolveSiteUrl(value)).toBe(DEFAULT_SITE_URL);
    expect(() => new URL(resolveSiteUrl(value))).not.toThrow();
  });

  it("normalizes surrounding whitespace and removes paths, queries and fragments", () => {
    expect(resolveSiteUrl(" https://preview.example.com/research/freight?token=private#memo ")).toBe("https://preview.example.com");
    expect(resolveSiteUrl("http://localhost:3210/")).toBe("http://localhost:3210");
  });

  it.each(["example.com", "/relative", "not a URL", "file:///tmp/index.html", "javascript:alert(1)", "https://user:secret@example.com"])("rejects an unusable or credential-bearing URL without exposing it: %s", (value) => {
    expect(() => resolveSiteUrl(value)).toThrow("SITE_URL must be an absolute HTTP(S) URL without credentials.");
  });
});
