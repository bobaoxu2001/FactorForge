"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  BrainCircuit,
  CandlestickChart,
  Database,
  FileSearch,
  FileText,
  Gauge,
  GraduationCap,
  Layers,
  LibraryBig,
  LineChart,
  Flame,
  Menu,
  MessagesSquare,
  Network,
  PieChart,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Telescope,
  Trophy,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import SearchCommand from "./SearchCommand";

type NavItem = { href: string; label: string; icon: typeof Gauge; tag?: string };
type NavSection = { label: string; items: NavItem[] };

// Research-first information architecture. The quantitative lab is intact
// under its own group; every pre-existing route is still reachable.
const startItems: NavItem[] = [{ href: "/", label: "Research Home", icon: Telescope }];

const sections: NavSection[] = [
  {
    label: "Research",
    items: [
      { href: "/research/freight", label: "Freight case study", icon: Truck },
      { href: "/research/freight/companies", label: "Company research", icon: LibraryBig },
      { href: "/research/freight/evidence", label: "Evidence explorer", icon: FileSearch },
      { href: "/research/freight/memo", label: "Research memo", icon: FileText },
      { href: "/research/freight/copilot", label: "AI research copilot", icon: MessagesSquare },
      { href: "/research/frameworks", label: "KPI frameworks", icon: BookOpenCheck },
    ],
  },
  {
    label: "Quantitative",
    items: [
      { href: "/quant", label: "Quant overview", icon: Gauge },
      { href: "/factors", label: "Factor research", icon: Network },
      { href: "/strategies", label: "Strategy lab", icon: LineChart },
      { href: "/radar", label: "Radar screening", icon: Target },
      { href: "/consensus", label: "Consensus", icon: Layers },
      { href: "/portfolio", label: "Portfolio & attribution", icon: PieChart },
      { href: "/picks", label: "Quant screen", icon: Sparkles },
      { href: "/ai-market", label: "Market stress", icon: BrainCircuit },
      { href: "/hotspots", label: "Thematic hypotheses", icon: Flame },
    ],
  },
  {
    label: "Portfolio & monitoring",
    items: [
      { href: "/research/freight/thesis", label: "Thesis monitor", icon: Target },
      { href: "/paper-trading", label: "Paper observation", icon: WalletCards },
      { href: "/simulator", label: "Trade simulator", icon: CandlestickChart },
      { href: "/track-record", label: "Track record", icon: Trophy },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/data", label: "Data sources", icon: Database },
      { href: "/reports", label: "Report cards", icon: FileText },
      { href: "/learn", label: "Learn (Stocks 101)", icon: GraduationCap },
      { href: "/oss", label: "OSS & Maintainers", icon: ShieldCheck },
      // Protected routes — tagged so it's clear they need a persistence backend.
      { href: "/my-watchlist", label: "My Watchlist", icon: Star, tag: "local" },
      { href: "/admin/cache", label: "Cache", icon: Server, tag: "admin" },
    ],
  },
];

const ALL_HREFS = [...startItems, ...sections.flatMap((s) => s.items)].map((i) => i.href);

/** The single nav item for a path: the longest href that equals it or is a parent of it. */
export function activeHref(pathname: string): string | null {
  const matches = ALL_HREFS.filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

export default function Navigation({ persistenceAvailable = true }: { persistenceAvailable?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("");

  // Cached server HTML and the visitor's browser can be on different days.
  // Fill the local date after hydration so the initial render stays consistent.
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  }, []);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[256px] flex-col border-r border-line bg-[#030914]/88 px-4 py-5 shadow-[18px_0_80px_-70px_rgba(96,165,250,0.9)] backdrop-blur-xl lg:flex">
        <Brand />
        <div className="mt-6 rounded-2xl border border-line bg-white/[0.035] p-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-soft">Workspace</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-white">Equity research</span>
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
          </div>
        </div>
        <nav className="mt-6 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {startItems.map((item) => (
            <DesktopNavLink key={item.href} item={item} pathname={pathname} />
          ))}
          {sections.map((section) => (
            <div key={section.label} className="pt-3">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-soft/80">
                {section.label}
              </div>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <DesktopNavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-4 shrink-0 space-y-3">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/60">Status</div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">Research software — places no trades, no live order execution. Your research notes stay in this browser.</div>
            {!persistenceAvailable && (
              <div className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
                Saved preferences and admin cache controls are disabled in public demo mode.
              </div>
            )}
          </div>
          <Link href="/admin/cache" className="flex h-11 w-full items-center justify-between rounded-xl border border-line bg-white/[0.035] px-3 text-[13px] text-ink-muted transition-colors hover:text-ink">
            <span className="inline-flex items-center gap-3"><Settings className="h-4 w-4" /> System</span>
            <span>›</span>
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-[#030914]/78 backdrop-blur-xl lg:ml-[256px]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white/[0.04] text-ink lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <SearchCommand />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden rounded-lg border border-line bg-white/[0.035] px-3 py-2 text-[12px] text-ink-muted sm:block">
              {currentDate || "\u00a0"}
            </div>
            <Link href="/reports" aria-label="Research reports" className="relative grid h-10 w-10 place-items-center rounded-lg border border-line bg-white/[0.04] text-ink-muted transition-colors hover:text-ink">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-400" />
            </Link>
            <Link href="/my-watchlist" aria-label="Account and watchlist" className="hidden items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.04] md:flex">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-line bg-gradient-to-br from-blue-500/45 to-emerald-400/25 text-[12px] font-semibold text-white">
                QR
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink">Account</div>
                <div className="text-[11px] text-ink-soft">Sign in · Watchlist</div>
              </div>
            </Link>
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
              {startItems.map((item) => (
                <MobileNavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
              ))}
              {sections.map((section) => (
                <div key={section.label} className="pt-3">
                  <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-soft/80">
                    {section.label}
                  </div>
                  <div className="space-y-1.5">
                    {section.items.map((item) => (
                      <MobileNavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = activeHref(pathname) === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex h-11 items-center gap-3 rounded-xl border px-3 text-[13px] transition-all ${
        active
          ? "border-blue-400/45 bg-blue-400/12 text-white shadow-[inset_3px_0_0_rgba(34,211,238,0.92)]"
          : "border-transparent text-ink-muted hover:border-line hover:bg-white/[0.045] hover:text-white"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-blue-300" : "text-ink-soft group-hover:text-blue-300"}`} />
      <span>{item.label}</span>
      {item.tag && (
        <span className="ml-auto rounded-md border border-line bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.14em] text-ink-soft">
          {item.tag}
        </span>
      )}
    </Link>
  );
}

function MobileNavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} className="flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] text-ink-muted">
      <Icon className="h-4 w-4" />
      {item.label}
      {item.tag && (
        <span className="ml-auto rounded-md border border-line bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.14em] text-ink-soft">
          {item.tag}
        </span>
      )}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/25 bg-white/[0.045] shadow-[0_0_34px_rgba(34,211,238,0.12)]">
        <div className="brand-mark" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => <span key={index} />)}
        </div>
      </div>
      <div>
        <div className="text-[16px] font-semibold tracking-[-0.02em] text-white">FactorForge</div>
        <div className="text-[11px] text-cyan-100/55">Equity Research Workbench</div>
      </div>
    </Link>
  );
}
