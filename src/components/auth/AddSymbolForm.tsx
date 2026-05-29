"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addWatchlistSymbolAction, type WatchlistFormState } from "@/lib/auth/actions";

export default function AddSymbolForm() {
  const [state, formAction] = useFormState<WatchlistFormState, FormData>(addWatchlistSymbolAction, {});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Clear the field after a successful add so the next symbol can be typed.
    if (state.added && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [state.added]);

  return (
    <div>
      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          name="symbol"
          type="text"
          required
          maxLength={8}
          placeholder="e.g. AAPL"
          className="h-10 w-40 rounded-xl border border-line bg-white/[0.04] px-3 text-[13px] uppercase text-ink focus:border-blue-400/45 focus:outline-none"
        />
        <SubmitButton />
        <span className="text-[11.5px] text-ink-soft">
          1–8 alphanumeric characters. Duplicate adds are ignored.
        </span>
      </form>
      {state.error && (
        <div className="mt-3 rounded-xl border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-[12.5px] text-rose-100">
          {state.error}
        </div>
      )}
      {state.added && (
        <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-[12.5px] text-emerald-100">
          Added {state.added} to your watchlist.
        </div>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}
