import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unlinkSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// Use a per-test database so writes don't pollute the dev cache.
const TEST_DB = path.join(process.cwd(), ".cache", "factorforge-users-test.db");
const BCRYPT_TEST_TIMEOUT_MS = 15000;

describe("users + watchlist persistence", () => {
  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (!existsSync(path.dirname(TEST_DB))) mkdirSync(path.dirname(TEST_DB), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  // We can't easily redirect the db path without refactoring; instead these
  // tests share the production .cache db. To keep them deterministic, each
  // user uses a unique randomly suffixed username.

  it("hashes passwords with bcrypt and rejects wrong password", async () => {
    const { createUser, verifyCredentials, AuthError } = await import("./users");
    const username = `t_${Math.random().toString(36).slice(2, 10)}`;
    const user = await createUser(username, "correct-horse-staple");
    expect(user.username).toBe(username.toLowerCase());

    // Correct password verifies
    const ok = await verifyCredentials(username, "correct-horse-staple");
    expect(ok.id).toBe(user.id);

    // Wrong password throws invalid_credentials
    await expect(verifyCredentials(username, "wrong-password")).rejects.toThrow(AuthError);
  }, BCRYPT_TEST_TIMEOUT_MS);

  it("rejects username collisions", async () => {
    const { createUser, AuthError } = await import("./users");
    const username = `t_${Math.random().toString(36).slice(2, 10)}`;
    await createUser(username, "password123");
    await expect(createUser(username, "another-password")).rejects.toMatchObject({
      code: "username_taken",
    });
    await expect(createUser(username, "another-password")).rejects.toBeInstanceOf(AuthError);
  }, BCRYPT_TEST_TIMEOUT_MS);

  it("rejects weak passwords", async () => {
    const { createUser } = await import("./users");
    const username = `t_${Math.random().toString(36).slice(2, 10)}`;
    await expect(createUser(username, "short")).rejects.toMatchObject({ code: "weak_password" });
  });

  it("rejects passwords beyond the bcrypt 72-byte limit", async () => {
    const { createUser } = await import("./users");
    const username = `t_${Math.random().toString(36).slice(2, 10)}`;
    await expect(createUser(username, "a".repeat(73))).rejects.toMatchObject({ code: "weak_password" });
  });

  it("rejects too-short usernames with invalid_username (not username_taken)", async () => {
    const { createUser } = await import("./users");
    await expect(createUser("ab", "password123")).rejects.toMatchObject({ code: "invalid_username" });
  });

  it("rejects usernames with illegal characters", async () => {
    const { createUser } = await import("./users");
    await expect(createUser("bad name!", "password123")).rejects.toMatchObject({
      code: "invalid_username",
    });
    await expect(createUser("inject';--", "password123")).rejects.toMatchObject({
      code: "invalid_username",
    });
  });

  it("accepts usernames with allowed separators", async () => {
    const { createUser } = await import("./users");
    const username = `ok.user-name_${Math.random().toString(36).slice(2, 6)}`;
    const user = await createUser(username, "password123");
    expect(user.username).toBe(username.toLowerCase());
  }, BCRYPT_TEST_TIMEOUT_MS);

  it("adds, lists, and removes watchlist symbols per user", async () => {
    const { createUser } = await import("./users");
    const { addSymbolToWatchlist, getWatchlistFor, removeSymbolFromWatchlist } = await import(
      "@/lib/persistence/watchlist"
    );
    const username = `t_${Math.random().toString(36).slice(2, 10)}`;
    const user = await createUser(username, "password123");

    expect(getWatchlistFor(user.id)).toEqual([]);

    expect(addSymbolToWatchlist(user.id, "aapl").ok).toBe(true);
    expect(addSymbolToWatchlist(user.id, "msft").ok).toBe(true);

    const list = getWatchlistFor(user.id);
    expect(list.map((row) => row.symbol).sort()).toEqual(["AAPL", "MSFT"]);

    // Duplicate add is a silent no-op (INSERT OR IGNORE)
    expect(addSymbolToWatchlist(user.id, "AAPL").ok).toBe(true);
    expect(getWatchlistFor(user.id)).toHaveLength(2);

    // Bad symbol format rejected
    expect(addSymbolToWatchlist(user.id, "this is way too long")).toEqual({
      ok: false,
      reason: "Symbol must be 1–8 alphanumeric characters",
    });

    removeSymbolFromWatchlist(user.id, "AAPL");
    expect(getWatchlistFor(user.id).map((row) => row.symbol)).toEqual(["MSFT"]);
  }, BCRYPT_TEST_TIMEOUT_MS);

  it("user A cannot see user B's watchlist", async () => {
    const { createUser } = await import("./users");
    const { addSymbolToWatchlist, getWatchlistFor } = await import("@/lib/persistence/watchlist");
    const userA = await createUser(`a_${Math.random().toString(36).slice(2, 10)}`, "password123");
    const userB = await createUser(`b_${Math.random().toString(36).slice(2, 10)}`, "password123");
    addSymbolToWatchlist(userA.id, "NVDA");
    addSymbolToWatchlist(userB.id, "TSLA");
    const aList = getWatchlistFor(userA.id).map((r) => r.symbol);
    const bList = getWatchlistFor(userB.id).map((r) => r.symbol);
    expect(aList).toContain("NVDA");
    expect(aList).not.toContain("TSLA");
    expect(bList).toContain("TSLA");
    expect(bList).not.toContain("NVDA");
  }, BCRYPT_TEST_TIMEOUT_MS);
});
