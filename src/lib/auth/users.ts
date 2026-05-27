import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/persistence/db";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("users");
const SALT_ROUNDS = 10;

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
  constructor(public code: "username_taken" | "weak_password" | "invalid_credentials" | "db_unavailable", message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function normalize(username: string): string {
  return username.trim().toLowerCase();
}

export async function createUser(usernameRaw: string, passwordRaw: string): Promise<User> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", "Persistence layer unavailable");
  const username = normalize(usernameRaw);
  if (username.length < 3 || username.length > 32) {
    throw new AuthError("username_taken", "Username must be 3-32 characters");
  }
  if (passwordRaw.length < 8) {
    throw new AuthError("weak_password", "Password must be at least 8 characters");
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
  const username = normalize(usernameRaw);
  const row = db
    .prepare<[string], UserRow>("SELECT id, username, password_hash, created_at FROM users WHERE username = ?")
    .get(username);
  if (!row) throw new AuthError("invalid_credentials", "Invalid username or password");
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
