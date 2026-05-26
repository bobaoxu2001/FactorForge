"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BrainCircuit,
  Database,
  FileText,
  Gauge,
  LineChart,
  Menu,
  Network,
  Search,
  Settings,
  Target,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";

const items = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/data", label: "Data", icon: Database },
  { href: "/factors", label: "Factors", icon: Network },
  { href: "/strategies", label: "Strategies", icon: LineChart },
  { href: "/radar", label: "Radar", icon: Target },
  { href: "/ai-market", label: "AI Market", icon: BrainCircuit },
  { href: "/paper-trading", label: "Paper", icon: WalletCards },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[236px] border-r border-line bg-[#030914]/95 px-4 py-5 backdrop-blur-xl lg:block">
        <Brand />
        <nav className="mt-8 space-y-1.5">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex h-11 items-center gap-3 rounded-lg border px-3 text-[13px] transition-all ${
                  active
                    ? "border-blue-500/45 bg-blue-500/14 text-white shadow-[inset_3px_0_0_rgba(59,130,246,0.95)]"
                    : "border-transparent text-ink-muted hover:border-line hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-blue-300" : "text-ink-soft group-hover:text-blue-300"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4">
          <button className="flex h-11 w-full items-center justify-between rounded-lg border border-line bg-white/[0.035] px-3 text-[13px] text-ink-muted">
            <span className="inline-flex items-center gap-3"><Settings className="h-4 w-4" /> System</span>
            <span>›</span>
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-[#030914]/88 backdrop-blur-xl lg:ml-[236px]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white/[0.04] text-ink lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="hidden min-w-[280px] max-w-xl flex-1 items-center gap-2 rounded-lg border border-line bg-white/[0.035] px-3 py-2 text-[13px] text-ink-soft md:flex">
            <Search className="h-4 w-4" />
            <span>Search strategies, factors, symbols...</span>
            <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px]">⌘ K</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden rounded-lg border border-line bg-white/[0.035] px-3 py-2 text-[12px] text-ink-muted sm:block">
              Live research mode
            </div>
            <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-line bg-white/[0.04] text-ink-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-400" />
            </button>
            <div className="hidden items-center gap-3 md:flex">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-line bg-gradient-to-br from-blue-500/45 to-emerald-400/25 text-[12px] font-semibold text-white">
                QR
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink">Researcher</div>
                <div className="text-[11px] text-ink-soft">Quant Lab</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[280px] border-r border-line bg-[#030914] p-5">
            <div className="flex items-center justify-between">
              <Brand />
              <button className="text-ink-muted" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 space-y-1.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] text-ink-muted">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-400/35 bg-blue-500/10">
        <BarChart3 className="h-5 w-5 text-blue-300" />
      </div>
      <div>
        <div className="text-[15px] font-semibold tracking-tight text-white">Quant Lab</div>
        <div className="text-[11px] text-ink-soft">AI Strategy Research</div>
      </div>
    </Link>
  );
}
