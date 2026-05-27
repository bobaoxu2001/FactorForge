"use server";

import { redirect } from "next/navigation";
import { getSession } from "./session";
import { AuthError, createUser, verifyCredentials } from "./users";
import { addSymbolToWatchlist, removeSymbolFromWatchlist } from "@/lib/persistence/watchlist";

export interface AuthFormState {
  error?: string;
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
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
  redirect("/my-watchlist");
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
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
  redirect("/my-watchlist");
}

export async function signOutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/sign-in");
}

export async function addWatchlistSymbolAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/sign-in");
  }
  const symbol = String(formData.get("symbol") ?? "");
  addSymbolToWatchlist(session.userId!, symbol);
}

export async function removeWatchlistSymbolAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/sign-in");
  }
  const symbol = String(formData.get("symbol") ?? "");
  removeSymbolFromWatchlist(session.userId!, symbol);
}
