"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { AuthError, createUser, verifyCredentials, normalizeUsername } from "./users";
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

function safeInternalRedirect(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/my-watchlist";
  }
  return raw;
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
  const result = await checkRateLimit(key, AUTH_LIMIT, AUTH_WINDOW_MS);
  if (result.allowed) return null;
  return `Too many attempts. Try again in ${result.retryAfterSeconds}s.`;
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
    if (error instanceof AuthError) return { error: error.message };
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
    if (error instanceof AuthError) return { error: error.message };
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
    // Surface the validation reason instead of silently dropping the input.
    return { error: result.reason };
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
