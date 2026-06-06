import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Sparkles } from "lucide-react";
import { glossaryByCategory, GLOSSARY, type GlossaryEntry } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Stocks 101",
  description:
    "Plain-English explanations of every term used on the platform — for colleagues who only sort-of know stocks.",
};

const STARTER_PATH = ["stock", "benchmark", "return", "drawdown", "sharpe", "backtest", "diversification"];

export default function LearnPage() {
  const groups = glossaryByCategory();
  const starterEntries = STARTER_PATH
    .map((id) => GLOSSARY.find((e) => e.id === id))
    .filter((e): e is GlossaryEntry => Boolean(e));

  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <header className="hero-shell p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
          <GraduationCap className="h-3.5 w-3.5" />
          Stocks 101
        </div>
        <h1 className="mt-4 max-w-3xl text-[34px] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[46px]">
          Every term on this platform, in plain English.
        </h1>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-7 text-ink-muted">
          The rest of FactorForge is built for quant researchers, so it&apos;s full of jargon. This page is the opposite:
          no math, no assumptions. If a word anywhere on the site looks intimidating, it&apos;s explained here — and
          you&apos;ll see the same dotted <span className="border-b border-dotted border-cyan-300/60 text-ink">underlined terms</span> across
          the app that you can hover for a one-line reminder.
        </p>
      </header>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-200" />
          <div className="panel-title">New to this? Start with these seven</div>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-soft">Understand these and the dashboards stop looking scary.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {starterEntries.map((entry, index) => (
            <li key={entry.id}>
              <a href={`#${entry.id}`} className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.025] p-3 transition-colors hover:border-cyan-300/30 hover:bg-white/[0.04]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-[11px] font-semibold text-cyan-100">
                  {index + 1}
                </span>
                <span>
                  <span className="text-[13px] font-semibold text-white">{entry.term}</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">{entry.plain}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">{group.category}</h2>
            <span className="text-[11px] uppercase tracking-wider text-ink-soft">{group.entries.length} terms</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {group.entries.map((entry) => (
              <article key={entry.id} id={entry.id} className="card scroll-mt-24 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-white">{entry.term}</h3>
                  <span className="chip border-cyan-300/25 bg-cyan-300/[0.08] text-[9.5px] text-cyan-100">
                    {entry.level === "starter" ? "basics" : "intermediate"}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{entry.plain}</p>
                {entry.why && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-cyan-100/80">
                    <span className="font-medium text-cyan-200">Why it matters: </span>
                    {entry.why}
                  </p>
                )}
                {entry.example && (
                  <p className="mt-2 rounded-lg border border-line bg-white/[0.025] px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
                    <span className="font-medium text-ink-muted">Example: </span>
                    {entry.example}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="card p-5">
        <div className="panel-title">Ready to look around?</div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          Now that the words make sense, explore the real thing. Every metric you meet has a hover explanation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="rounded-xl border border-blue-300/30 bg-blue-300/10 px-3 py-1.5 text-[13px] text-blue-100 hover:shadow-cardHover">
            Go to the overview
          </Link>
          <Link href="/strategies" className="rounded-xl border border-line bg-white/[0.04] px-3 py-1.5 text-[13px] text-ink-muted hover:text-ink">
            Browse strategies
          </Link>
          <Link href="/portfolio" className="rounded-xl border border-line bg-white/[0.04] px-3 py-1.5 text-[13px] text-ink-muted hover:text-ink">
            See a portfolio
          </Link>
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-soft">
          Reminder: this platform is a research and learning demo only — no broker connection, no real orders, and past
          backtests do not imply future results.
        </p>
      </section>
    </div>
  );
}
