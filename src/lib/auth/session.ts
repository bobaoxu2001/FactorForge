import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  username?: string;
}

const COOKIE_NAME = "factorforge_session";

const DEV_SECRET = "factorforge-dev-secret-do-not-use-in-production-_______";

// Sessions expire after 7 days. iron-session re-derives the cookie maxAge from
// this, so an idle cookie stops being accepted instead of living forever.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function password(): string {
  const value = process.env.SESSION_PASSWORD;
  if (value && value.length >= 32) return value;

  // Iron-session refuses passwords shorter than 32 chars. Production must set
  // a long random SESSION_PASSWORD — booting with a publicly-known default
  // would mean any attacker could forge session cookies.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_PASSWORD must be set to a random string of at least 32 characters in production",
    );
  }
  return DEV_SECRET;
}

export function sessionOptions(): SessionOptions {
  return {
    password: password(),
    cookieName: COOKIE_NAME,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions());
}
