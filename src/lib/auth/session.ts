import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  username?: string;
}

const COOKIE_NAME = "factorforge_session";

function password(): string {
  const value = process.env.SESSION_PASSWORD;
  if (!value || value.length < 32) {
    // Iron-session refuses passwords shorter than 32 chars. In production, set
    // a long random SESSION_PASSWORD; in dev/tests, derive a deterministic
    // default so the app still boots and tests don't need a secret to run.
    return "factorforge-dev-secret-do-not-use-in-production-_______";
  }
  return value;
}

export function sessionOptions(): SessionOptions {
  return {
    password: password(),
    cookieName: COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions());
}
