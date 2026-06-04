"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { AuthFormState } from "@/lib/auth/actions";
import ProtectedRouteExplainer from "./ProtectedRouteExplainer";

interface Props {
  mode: "sign-in" | "sign-up";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  nextPath?: string;
  protectedArea?: string;
}

const COPY = {
  "sign-in": {
    title: "Sign in",
    subtitle: "Access your personal watchlist and saved research preferences.",
    submit: "Sign in",
    altPrompt: "No account yet?",
    altHref: "/sign-up",
    altCta: "Create one",
  },
  "sign-up": {
    title: "Create an account",
    subtitle: "Your watchlist and saved preferences will be tied to your account, stored locally in the FactorForge SQLite database.",
    submit: "Create account",
    altPrompt: "Already have an account?",
    altHref: "/sign-in",
    altCta: "Sign in",
  },
} as const;

export default function AuthForm({ mode, action, nextPath, protectedArea }: Props) {
  const [state, formAction] = useFormState(action, {});
  const copy = COPY[mode];
  const safeNext = normalizeNext(nextPath);
  const altHref = `${copy.altHref}${safeNext !== "/my-watchlist" || protectedArea ? `?next=${encodeURIComponent(safeNext)}${protectedArea ? `&area=${encodeURIComponent(protectedArea)}` : ""}` : ""}`;

  return (
    <div className="grid min-h-[72vh] items-start gap-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:items-center">
      <ProtectedRouteExplainer area={protectedArea} />
      <div className="w-full max-w-md lg:justify-self-end">
        <div className="card p-6">
          <div className="section-label">{copy.title}</div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{copy.subtitle}</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
            Accounts here are only for saved research preferences. FactorForge does not connect to brokers or place trades.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={safeNext} />
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Username</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                className="mt-1 block w-full rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-blue-400/45 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Password</span>
              <input
                name="password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                required
                minLength={8}
                className="mt-1 block w-full rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-blue-400/45 focus:outline-none"
              />
            </label>

            {state.error && (
              <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-[12.5px] text-rose-100">
                {state.error}
              </div>
            )}

            <SubmitButton label={copy.submit} />
          </form>

          <div className="mt-6 text-[12.5px] text-ink-muted">
            {copy.altPrompt}{" "}
            <Link href={altHref} className="text-cyan-200 hover:text-cyan-100">
              {copy.altCta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/my-watchlist";
  return value;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 text-[13px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/20 disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}
