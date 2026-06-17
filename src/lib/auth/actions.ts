"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "./session";
import { AuthError, createUser, verifyCredentials, normalizeUsername } from "./users";
import { clientIpFromHeaders } from "./clientIp";
import { checkRateLimit } from "@/lib/ratelimit";
import { addSymbolToWatchlist, removeSymbolFromWatchlist } from "@/lib/persistence/watchlist";

export interface AuthFormState {
  error?: string;
}

export interface WatchlistFormState {
  error?: string;
  added?: string;
}

// 5 credential attempts per username per 5 minutes.
const AUTH_LIMIT = 5;
const AUTH_WINDOW_MS = 5 * 60 * 1000;
// Per-IP ceiling across *all* usernames in the same window. The per-username
// limit alone doesn't stop a spray that tries one attempt against many
// usernames from one host; this caps the total. Tune up if a deployment sits
// behind a large shared NAT. Best-effort — fails open when the IP is unknown.
const AUTH_IP_LIMIT = 30;

// User-facing copy for the no-database case. The sign-in/up pages render a full
// DemoModeNotice instead of the form when persistence is down, so this is a
// defensive fallback for any residual submit — never leak the raw engine string
// ("Persistence layer unavailable") to the UI.
const NO_PERSISTENCE_MESSAGE =
  "Account features are disabled in this demo — saved watchlists and sign-in need a local or configured database.";

function userFacingAuthError(error: AuthError): string {
  return error.code === "db_unavailable" ? NO_PERSISTENCE_MESSAGE : error.message;
}

function safeInternalRedirect(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/my-watchlist";
  }
  return raw;
}

function currentClientIp(): string | null {
  try {
    const h = headers();
    return clientIpFromHeaders(h.get("x-forwarded-for"), h.get("x-real-ip"));
  } catch {
    return null;
  }
}

async function rateLimitMessage(action: string, username: string): Promise<string | null> {
  // Bucket by action + best-effort normalized username so a typo'd username
  // doesn't share a bucket with the real one but brute force on one is throttled.
  let key: string;
  try {
    key = `${action}:${normalizeUsername(username)}`;
  } catch {
    key = `${action}:${username.trim().toLowerCase()}`;
  }
  const byUser = await checkRateLimit(key, AUTH_LIMIT, AUTH_WINDOW_MS);
  if (!byUser.allowed) return `Too many attempts. Try again in ${byUser.retryAfterSeconds}s.`;

  // Per-IP ceiling across all usernames, so a username-spray that stays under
  // the per-username cap is still bounded. Skip (fail open) when the IP is
  // unknown rather than collapse every client into one shared bucket.
  const ip = currentClientIp();
  if (ip) {
    const byIp = await checkRateLimit(`${action}:ip:${ip}`, AUTH_IP_LIMIT, AUTH_WINDOW_MS);
    if (!byIp.allowed) return `Too many attempts. Try again in ${byIp.retryAfterSeconds}s.`;
  }
  return null;
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeInternalRedirect(formData.get("next"));
  const limited = await rateLimitMessage("signin", username);
  if (limited) return { error: limited };
  try {
    const user = await verifyCredentials(username, password);
    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    await session.save();
  } catch (error) {
    if (error instanceof AuthError) return { error: userFacingAuthError(error) };
    return { error: "Sign-in failed. Try again." };
  }
  redirect(next);
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeInternalRedirect(formData.get("next"));
  const limited = await rateLimitMessage("signup", username);
  if (limited) return { error: limited };
  try {
    const user = await createUser(username, password);
    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    await session.save();
  } catch (error) {
    if (error instanceof AuthError) return { error: userFacingAuthError(error) };
    return { error: "Sign-up failed. Try again." };
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/sign-in");
}

export async function addWatchlistSymbolAction(
  _prev: WatchlistFormState,
  formData: FormData,
): Promise<WatchlistFormState> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/sign-in?next=/my-watchlist&area=watchlist");
  }
  const symbol = String(formData.get("symbol") ?? "");
  const result = addSymbolToWatchlist(session.userId!, symbol);
  if (!result.ok) {
    // Surface the validation reason instead of silently dropping the input, but
    // never leak the raw persistence string to the UI.
    const reason = result.reason === "Persistence layer unavailable" ? NO_PERSISTENCE_MESSAGE : result.reason;
    return { error: reason };
  }
  revalidatePath("/my-watchlist");
  return { added: symbol.trim().toUpperCase() };
}

export async function removeWatchlistSymbolAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/sign-in");
  }
  const symbol = String(formData.get("symbol") ?? "");
  removeSymbolFromWatchlist(session.userId!, symbol);
  revalidatePath("/my-watchlist");
}
