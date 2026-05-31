import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/persistence/db";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("users");
const SALT_ROUNDS = 10;

// bcrypt only consumes the first 72 bytes of the input; anything longer is
// silently truncated, so two long passwords sharing a 72-byte prefix would be
// interchangeable. Reject over-long input rather than hash a truncated secret.
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 8;

// A dummy hash compared against when a username doesn't exist, so a missing
// account costs the same time as a wrong password. Without it, response timing
// leaks which usernames are registered (enumeration). Computed once, lazily.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash("timing-equalizer-not-a-real-password", SALT_ROUNDS);
  }
  return dummyHashPromise;
}

export interface User {
  id: string;
  username: string;
  createdAt: number;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

export class AuthError extends Error {
  constructor(
    public code:
      | "username_taken"
      | "invalid_username"
      | "weak_password"
      | "invalid_credentials"
      | "db_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// Lowercase letters, digits, and a few safe separators. Anchored, so the whole
// string must match. Length is checked separately for a clearer error message.
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function assertValidUsername(username: string): void {
  if (username.length < 3 || username.length > 32) {
    throw new AuthError("invalid_username", "Username must be 3-32 characters");
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError(
      "invalid_username",
      "Username may only contain letters, digits, dot, underscore, and hyphen",
    );
  }
}

export async function createUser(usernameRaw: string, passwordRaw: string): Promise<User> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", "Persistence layer unavailable");
  const username = normalizeUsername(usernameRaw);
  assertValidUsername(username);
  if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError("weak_password", `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (Buffer.byteLength(passwordRaw, "utf8") > MAX_PASSWORD_BYTES) {
    throw new AuthError("weak_password", `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer`);
  }
  const existing = db
    .prepare<[string], { id: string }>("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) throw new AuthError("username_taken", "Username is already taken");

  const id = randomUUID();
  const password_hash = await bcrypt.hash(passwordRaw, SALT_ROUNDS);
  const createdAt = Date.now();
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    username,
    password_hash,
    createdAt,
  );
  log.info("user created", { id, username });
  return { id, username, createdAt };
}

export async function verifyCredentials(usernameRaw: string, passwordRaw: string): Promise<User> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", "Persistence layer unavailable");
  const username = normalizeUsername(usernameRaw);
  const row = db
    .prepare<[string], UserRow>("SELECT id, username, password_hash, created_at FROM users WHERE username = ?")
    .get(username);
  if (!row) {
    // Equalize timing with the wrong-password path to avoid username enumeration.
    await bcrypt.compare(passwordRaw, await getDummyHash());
    throw new AuthError("invalid_credentials", "Invalid username or password");
  }
  const ok = await bcrypt.compare(passwordRaw, row.password_hash);
  if (!ok) throw new AuthError("invalid_credentials", "Invalid username or password");
  return { id: row.id, username: row.username, createdAt: row.created_at };
}

export function findUserById(id: string): User | null {
  const db = getDb();
  if (!db) return null;
  const row = db
    .prepare<[string], UserRow>("SELECT id, username, password_hash, created_at FROM users WHERE id = ?")
    .get(id);
  if (!row) return null;
  return { id: row.id, username: row.username, createdAt: row.created_at };
}
