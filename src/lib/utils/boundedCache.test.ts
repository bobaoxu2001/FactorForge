import { describe, expect, it } from "vitest";
import { boundedSet } from "./boundedCache";

describe("boundedSet", () => {
  it("evicts the oldest entry once the cap is reached", () => {
    const map = new Map<string, number>();
    boundedSet(map, "a", 1, 2);
    boundedSet(map, "b", 2, 2);
    boundedSet(map, "c", 3, 2); // should evict "a"

    expect(map.size).toBe(2);
    expect(map.has("a")).toBe(false);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
  });

  it("updating an existing key does not evict and does not grow", () => {
    const map = new Map<string, number>();
    boundedSet(map, "a", 1, 2);
    boundedSet(map, "b", 2, 2);
    boundedSet(map, "a", 99, 2); // refresh existing key

    expect(map.size).toBe(2);
    expect(map.get("a")).toBe(99);
    expect(map.get("b")).toBe(2);
  });

  it("never exceeds the cap under a flood of distinct keys", () => {
    const map = new Map<number, number>();
    for (let i = 0; i < 1000; i += 1) {
      boundedSet(map, i, i, 50);
    }
    expect(map.size).toBe(50);
    // Only the most recent 50 keys survive.
    expect(map.has(949)).toBe(false);
    expect(map.has(950)).toBe(true);
    expect(map.has(999)).toBe(true);
  });
});
