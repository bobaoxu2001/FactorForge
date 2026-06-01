import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimitStore } from "./memoryStore";
import { UpstashRateLimitStore } from "./upstashStore";

describe("InMemoryRateLimitStore", () => {
  it("allows up to the limit then blocks, with a positive retry-after", async () => {
    const store = new InMemoryRateLimitStore();
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect((await store.hit("k", 3, 1000, now)).allowed).toBe(true);
    }
    const blocked = await store.hit("k", 3, 1000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it("rolls the window over once it elapses", async () => {
    const store = new InMemoryRateLimitStore();
    expect((await store.hit("k", 1, 1000, 0)).allowed).toBe(true);
    expect((await store.hit("k", 1, 1000, 500)).allowed).toBe(false);
    expect((await store.hit("k", 1, 1000, 1500)).allowed).toBe(true);
  });

  it("reports the memory backend and clears on reset", async () => {
    const store = new InMemoryRateLimitStore();
    expect(store.backend).toBe("memory");
    await store.hit("k", 1, 1000, 0);
    store.reset();
    expect((await store.hit("k", 1, 1000, 0)).allowed).toBe(true);
  });
});

describe("UpstashRateLimitStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockPipeline(values: Array<{ result?: unknown; error?: string }>) {
    return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(values), { status: 200, headers: { "content-type": "application/json" } }),
    );
  }

  it("allows when the post-increment count is within the limit", async () => {
    // INCR -> 3, PEXPIRE -> 1 (set), PTTL -> 240_000ms remaining
    const fetchMock = mockPipeline([{ result: 3 }, { result: 1 }, { result: 240_000 }]);
    vi.stubGlobal("fetch", fetchMock);
    const store = new UpstashRateLimitStore("https://example.upstash.io", "tok");
    const res = await store.hit("signin:alice", 5, 300_000);
    expect(res.allowed).toBe(true);
    expect(store.backend).toBe("upstash");
    // One pipelined REST round-trip, hitting the /pipeline endpoint with auth.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/pipeline");
    expect(init?.headers).toMatchObject({ authorization: "Bearer tok" });
  });

  it("blocks and derives retry-after from the remaining TTL once over the limit", async () => {
    // INCR -> 6 (> limit 5), PTTL -> 120_000ms -> 120s retry-after
    const fetchMock = mockPipeline([{ result: 6 }, { result: 0 }, { result: 120_000 }]);
    vi.stubGlobal("fetch", fetchMock);
    const store = new UpstashRateLimitStore("https://example.upstash.io", "tok");
    const res = await store.hit("signin:alice", 5, 300_000);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBe(120);
  });

  it("fails OPEN when the store is unreachable (never locks out auth on infra blips)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = new UpstashRateLimitStore("https://example.upstash.io", "tok");
    const res = await store.hit("signin:alice", 5, 300_000);
    expect(res.allowed).toBe(true);
  });

  it("fails OPEN on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = new UpstashRateLimitStore("https://example.upstash.io", "tok");
    const res = await store.hit("signin:alice", 5, 300_000);
    expect(res.allowed).toBe(true);
  });
});
