"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addWatchlistSymbolAction, type WatchlistFormState } from "@/lib/auth/actions";

export default function AddSymbolForm({ entryCount }: { entryCount: number }) {
  const [state, formAction] = useFormState<WatchlistFormState, FormData>(addWatchlistSymbolAction, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCount = useRef(entryCount);
  // Hide stale add feedback once the list changes for a reason unrelated to this
  // form (e.g. removing a row), so a leftover error/success doesn't linger.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Clear the field after a successful add so the next symbol can be typed.
    if (state.added && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [state.added]);

  // A fresh submit (add attempt) should always surface its own result.
  useEffect(() => {
    setDismissed(false);
  }, [state]);

  // A drop in entry count means a removal happened elsewhere — clear stale feedback.
  useEffect(() => {
    if (entryCount < prevCount.current) setDismissed(true);
    prevCount.current = entryCount;
  }, [entryCount]);

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
          className="h-10 w-40 rounded-md border border-line bg-ink/[0.04] px-3 text-[13px] text-ink focus:border-accent/45 focus:outline-none"
        />
        <SubmitButton />
        <span className="text-[11.5px] text-ink-soft">
          1–8 alphanumeric characters. Duplicate adds are ignored.
        </span>
      </form>
      {!dismissed && state.error && (
        <div className="mt-3 rounded-md border border-rose-600/35 bg-rose-400/10 px-3 py-2 text-[12.5px] text-rose-800">
          {state.error}
        </div>
      )}
      {!dismissed && state.added && (
        <div className="mt-3 rounded-md border border-emerald-600/30 bg-emerald-400/10 px-3 py-2 text-[12.5px] text-emerald-800">
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
      className="h-10 rounded-md border border-accent/35 bg-accent/10 px-4 text-[13px] font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}
