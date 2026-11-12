"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { searchItems } from "@/lib/search";

export default function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  const results = useMemo(() => searchItems(query, 8), [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus !== document.body && previousFocus.isConnected) previousFocus.focus();
      else trigger?.focus();
    };
  }, [open]);

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    const links = Array.from(resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!links.length) return;
      const current = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next = current === -1
        ? (event.key === "ArrowDown" ? 0 : links.length - 1)
        : (current + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links[next].focus();
    } else if (event.key === "Enter" && event.target === inputRef.current && links.length) {
      event.preventDefault();
      links[0].click();
    } else if (event.key === "Tab") {
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("input, button, a[href]") ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-line bg-ink/[0.04] px-2.5 text-left text-[13px] text-ink-soft transition-colors hover:border-accent/25 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:min-w-[280px] md:max-w-2xl md:flex-1 md:px-3"
        aria-label="Search FactorForge"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search research, companies, evidence...</span>
        <span className="md:hidden">Search</span>
        <span className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] md:inline">⌘ K</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink/30 px-3 py-6 backdrop-blur-sm md:px-4 md:py-20" role="dialog" aria-modal="true" aria-label="Search FactorForge" onKeyDown={handleDialogKeyDown} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div ref={panelRef} className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-line bg-paper shadow-card">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search className="h-4 w-4 text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search research, companies and evidence"
                aria-controls={resultsId}
                placeholder="Search research, companies, evidence..."
                className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-soft md:text-[14px]"
              />
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-muted hover:text-ink" aria-label="Close search">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-[11.5px] text-ink-soft">
              <span role="status">{query.trim() ? `${results.length} result${results.length === 1 ? "" : "s"}${results.length === 8 ? " shown" : ""}` : "Suggested starting points"}</span>
              <span aria-hidden="true">↑ ↓ navigate · Enter open · Esc close</span>
            </div>
            <div ref={resultsRef} id={resultsId} className="max-h-[min(420px,60dvh)] overflow-y-auto p-2">
              {results.map((item) => (
                <Link
                  key={`${item.href}-${item.title}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md border border-transparent px-3 py-3 hover:border-line hover:bg-ink/[0.04] focus:border-accent/40 focus:bg-accent/[0.06] focus:outline-none"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold text-ink">{item.title}</span>
                    <span className="chip border-line bg-ink/[0.035] text-ink-soft">{item.category}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{item.description}</p>
                </Link>
              ))}
              {results.length === 0 && (
                <div className="px-3 py-8 text-center text-[13px] text-ink-muted">
                  No results found. Try a company ticker, “freight brief”, “Binance evidence” or fewer words.
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
