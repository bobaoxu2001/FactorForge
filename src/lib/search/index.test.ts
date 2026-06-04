import { describe, expect, it } from "vitest";
import { searchItems } from ".";

describe("searchItems", () => {
  it("finds symbols and links to filtered strategy results", () => {
    const [result] = searchItems("NVDA");
    expect(result.title).toBe("NVDA");
    expect(result.href).toBe("/strategies?symbol=NVDA");
  });

  it("finds maintainer workflow route", () => {
    const result = searchItems("codex maintainer")[0];
    expect(result.title).toBe("OSS & Maintainers");
    expect(result.href).toBe("/oss");
  });

  it("returns no results for unrelated queries", () => {
    expect(searchItems("zzzz-no-match")).toEqual([]);
  });
});
