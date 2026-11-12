import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimitStore } from "./memoryStore";
import { UpstashRateLimitStore } from "./upstashStore";
import { __setRateLimitStore, getRateLimitStore, isDistributedRateLimitConfigured } from ".";

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

describe("rate-limit credential selection", () => {
  beforeEach(() => {
    __setRateLimitStore(null);
    for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) vi.stubEnv(key, "");
  });
  afterEach(() => {
    __setRateLimitStore(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses in-memory throttling for mismatched provider credentials", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    expect(isDistributedRateLimitConfigured()).toBe(false);
    expect(getRateLimitStore().backend).toBe("memory");
  });

  it("sends the KV token only to the KV URL when Upstash is incomplete", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://wrong.upstash.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", " ");
    vi.stubEnv("KV_REST_API_URL", " https://kv.example ");
    vi.stubEnv("KV_REST_API_TOKEN", " kv-token ");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 1000 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(isDistributedRateLimitConfigured()).toBe(true);
    await getRateLimitStore().hit("test", 5, 1000);
    expect(fetchMock).toHaveBeenCalledWith("https://kv.example/pipeline", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer kv-token" }) }));
  });

  it("prefers the complete Upstash pair when both providers are configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 1000 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getRateLimitStore().hit("test", 5, 1000);
    expect(fetchMock).toHaveBeenCalledWith("https://upstash.example/pipeline", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer upstash-token" }) }));
  });
});
