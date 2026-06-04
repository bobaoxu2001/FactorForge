"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchItems } from "@/lib/search";

export default function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchItems(query, 8), [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-w-[280px] max-w-2xl flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-left text-[13px] text-ink-soft transition-colors hover:border-cyan-300/25 hover:text-ink md:flex"
        aria-label="Search FactorForge"
      >
        <Search className="h-4 w-4" />
        <span>Search symbols, strategies, factors, reports...</span>
        <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px]">⌘ K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70 px-4 py-20 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search FactorForge">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-line bg-[#050a14] shadow-card">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search className="h-4 w-4 text-cyan-200" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search symbols, strategies, factors, reports, glossary, and routes"
                className="h-10 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-soft"
              />
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-muted hover:text-ink" aria-label="Close search">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {results.map((item) => (
                <Link
                  key={`${item.href}-${item.title}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl border border-transparent px-3 py-3 hover:border-line hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold text-ink">{item.title}</span>
                    <span className="chip border-line bg-white/[0.035] text-ink-soft">{item.category}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{item.description}</p>
                </Link>
              ))}
              {results.length === 0 && (
                <div className="px-3 py-8 text-center text-[13px] text-ink-muted">
                  No results found. Try a symbol, route, strategy name, or glossary term.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
