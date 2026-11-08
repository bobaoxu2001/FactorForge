"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpenCheck,
  BrainCircuit,
  CandlestickChart,
  ClipboardCheck,
  Database,
  FileSearch,
  FileText,
  Gauge,
  GraduationCap,
  History,
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
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Telescope,
  Trophy,
  Truck,
  WalletCards,
  X,
  Zap,
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
      { href: "/research/freight/sample", label: "One-page research brief", icon: FileText },
      { href: "/research/freight/companies", label: "Company research", icon: LibraryBig },
      { href: "/research/freight/evidence", label: "Evidence explorer", icon: FileSearch },
      { href: "/research/freight/memo", label: "Research memo", icon: FileText },
      { href: "/research/freight/copilot", label: "AI research copilot", icon: MessagesSquare },
      { href: "/research/frameworks", label: "KPI frameworks", icon: BookOpenCheck },
    ],
  },
  {
    label: "Event intelligence",
    items: [
      { href: "/events", label: "Event radar", icon: Activity },
      { href: "/events/ai-datacenter-shock", label: "AI data-center shock", icon: Zap },
      { href: "/events/binance-breach", label: "Binance breach", icon: ShieldAlert },
      { href: "/theses", label: "Thesis tracker", icon: History },
      { href: "/forecasts", label: "Forecast scorecard", icon: ClipboardCheck },
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
  const researchPage = pathname.startsWith("/research/");

  // Cached server HTML and the visitor's browser can be on different days.
  // Fill the local date after hydration so the initial render stays consistent.
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  }, []);

  return (
    <>
      <aside className="app-navigation fixed inset-y-0 left-0 z-50 hidden w-[256px] flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
        <Brand />
        <nav className="mt-7 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {startItems.map((item) => (
            <DesktopNavLink key={item.href} item={item} pathname={pathname} />
          ))}
          {sections.map((section) => section.label === "Research" ? (
            <div key={section.label} className="pt-5"><div className="px-3 pb-1.5 text-[12px] font-semibold text-ink-soft">{section.label}</div><div className="space-y-0.5">{section.items.map((item) => <DesktopNavLink key={item.href} item={item} pathname={pathname} />)}</div></div>
          ) : (
            <details key={section.label} open={!researchPage} className="pt-4"><summary className="cursor-pointer px-3 py-1.5 text-[12px] font-semibold text-ink-soft">{section.label}</summary><div className="mt-1 space-y-0.5">{section.items.map((item) => <DesktopNavLink key={item.href} item={item} pathname={pathname} />)}</div></details>
          ))}
        </nav>
        <div className="mt-4 shrink-0 border-t border-line pt-4">
          <p className="px-3 text-[12px] leading-relaxed text-ink-soft">
            Research software. Places no trades; your notes stay in this browser.
            {!persistenceAvailable && " Saved preferences and cache controls are off in the public demo."}
          </p>
          <Link href="/admin/cache" className="mt-2 flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] text-ink-muted transition-colors hover:bg-ink/[0.04] hover:text-ink">
            <Settings className="h-4 w-4" /> System
          </Link>
        </div>
      </aside>

      <header className="app-navigation sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur lg:ml-[256px]">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-8">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-md border border-line text-ink lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <SearchCommand />

          <div className="ml-auto flex items-center gap-3">
            <div className="num hidden text-[12.5px] text-ink-soft sm:block">
              {currentDate || "\u00a0"}
            </div>
            <Link href="/reports" aria-label="Research reports" className="grid h-9 w-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink">
              <Bell className="h-4 w-4" />
            </Link>
            <Link href="/my-watchlist" className="hidden h-9 items-center rounded-md border border-line px-3 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.04] md:flex">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/30 lg:hidden">
          <div className="h-full w-[280px] border-r border-line bg-paper p-5">
            <div className="flex items-center justify-between">
              <Brand />
              <button className="text-ink-muted" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 max-h-[calc(100dvh-100px)] space-y-0.5 overflow-y-auto">
              {startItems.map((item) => (
                <MobileNavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
              ))}
              {sections.map((section) => section.label === "Research" ? (
                <div key={section.label} className="pt-5"><div className="px-3 pb-1.5 text-[12px] font-semibold text-ink-soft">{section.label}</div>{section.items.map((item) => <MobileNavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />)}</div>
              ) : (
                <details key={section.label} open={!researchPage} className="pt-4"><summary className="cursor-pointer px-3 py-1.5 text-[12px] font-semibold text-ink-soft">{section.label}</summary>{section.items.map((item) => <MobileNavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />)}</details>
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
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] transition-colors ${
        active
          ? "bg-accent-soft font-medium text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
          : "text-ink-muted hover:bg-ink/[0.04] hover:text-ink"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-ink-soft group-hover:text-ink"}`} />
      <span>{item.label}</span>
      {item.tag && (
        <span className="ml-auto rounded-md border border-line bg-ink/[0.05] px-1.5 py-0.5 text-[9.5px] text-ink-soft">
          {item.tag}
        </span>
      )}
    </Link>
  );
}

function MobileNavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} className="flex h-10 items-center gap-3 rounded-md px-3 text-[14px] text-ink-muted">
      <Icon className="h-4 w-4" />
      {item.label}
      {item.tag && (
        <span className="ml-auto rounded-md border border-line bg-ink/[0.05] px-1.5 py-0.5 text-[9.5px] text-ink-soft">
          {item.tag}
        </span>
      )}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-3">
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <div className="font-serif text-[20px] font-semibold leading-none tracking-[-0.01em] text-ink">FactorForge</div>
        <div className="mt-1 text-[12px] text-ink-soft">Equity research workbench</div>
      </div>
    </Link>
  );
}
