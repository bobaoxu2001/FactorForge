import Link from "next/link";
import { GitPullRequest, ListChecks, Milestone, ShieldCheck } from "lucide-react";
import MethodologyCallout from "@/components/research/MethodologyCallout";

export const metadata = {
  title: "OSS & Maintainers",
};

const contributionAreas = [
  "Backtest edge-case tests for next-open execution, fees, stops, and uneven calendars.",
  "Provider fallback tests for Yahoo, Polygon, Alpha Vantage, and deterministic fallback data.",
  "Documentation drift fixes between the UI, README, environment examples, and release notes.",
  "Accessibility and keyboard navigation improvements for dense research pages.",
  "Portfolio export options and clearer reporting around benchmark assumptions.",
  "Route-level search, command palette, and discoverability improvements.",
];

const codexUses = [
  "Generate edge-case tests for backtest math.",
  "Review PRs touching quant logic, auth/session handling, provider fallback, and environment validation.",
  "Draft release notes from merged changes.",
  "Create issue triage and reproduction checklists.",
  "Identify documentation drift between UI, README, and code.",
  "Help maintain provider adapter tests.",
  "Support security review for headers, session handling, rate limits, and secrets.",
];

export default function OssPage() {
  return (
    <div className="space-y-8">
      <header>
        <div className="section-label">Open source</div>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink">OSS & Maintainers</h1>
        <p className="mt-2 max-w-4xl text-[14px] leading-relaxed text-ink-muted">
          FactorForge is maintained as a reusable research workbench: deterministic quant engines, visible data provenance,
          safe public demo defaults, and contributor workflows that make review, testing, release notes, and security checks easier.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SignalCard icon={ShieldCheck} title="Safe demo" detail="No broker connection, no live trading, no required market-data or LLM key." />
        <SignalCard icon={ListChecks} title="Reviewable engines" detail="Numbers come from code paths covered by tests; prose is labeled as template or LLM." />
        <SignalCard icon={GitPullRequest} title="Contributor path" detail="Issue templates, PR checklist, contributing guide, roadmap, and maintainer backlog." />
        <SignalCard icon={Milestone} title="Release hygiene" detail="Manual release checklist, changelog expectations, and CI gates before tagging." />
      </section>

      <section className="card p-5">
        <div className="section-label">Why this project exists</div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          The project turns the common quant-research workflow into an inspectable app: data source status, factor definitions,
          strategy rules, cost-aware backtests, portfolio risk, paper observation, and generated research memos sit in one place.
          It is intentionally research software, not a trading system.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Who can contribute" items={[
          "Quant researchers who can improve assumptions, fixtures, edge-case tests, and methodology notes.",
          "Frontend contributors who can improve dense dashboards, search, accessibility, and mobile ergonomics.",
          "Documentation contributors who can keep setup, Vercel deployment, security notes, and release checklists current.",
          "Security-minded reviewers who can inspect auth/session boundaries, env validation, rate limits, and logging.",
        ]} />
        <Panel title="Good first contribution areas" items={contributionAreas} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Maintainer workflow" items={[
          "CI runs lint, typecheck, and tests on pushes and pull requests targeting main.",
          "PR review starts with deterministic metric integrity, then data provenance labels, fallback disclosure, tests, and docs drift.",
          "Issue triage asks for route, provider/fallback status, reproduction steps, expected/actual behavior, and redacted env context.",
          "Releases are manual: update changelog, run the release checklist, verify Vercel-safe env behavior, then tag.",
        ]} />
        <Panel title="Where Codex helps" items={codexUses} />
      </section>

      <MethodologyCallout
        title="Security and safety boundaries"
        items={[
          "No brokerage credentials should be added because the app has no broker connector.",
          "No live trading, order routing, real-money account state, or financial-advice workflow is in scope.",
          "Security-sensitive reviews cover auth/session handling, bcrypt validation, rate limits, CSP, provider keys, LLM payloads, and secret logging.",
          "Optional provider and LLM keys must stay server-side; do not prefix them with NEXT_PUBLIC_.",
          "Public demo account features are limited to saved research preferences and watchlists.",
          "Fallback/demo data and template memos must remain labeled wherever they appear.",
        ]}
      />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-label">Roadmap</div>
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              Current work focuses on better extension points, provider test coverage, release automation, export options, route-level search, accessibility, and more strategy edge-case tests. The backlog is scoped as future maintainer issues, not adoption claims.
            </p>
          </div>
          <Link href="https://github.com/bobaoxu2001/FactorForge" className="rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink-muted hover:text-ink">
            GitHub repository
          </Link>
        </div>
      </section>
    </div>
  );
}

function SignalCard({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="card p-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
        <Icon className="h-5 w-5 text-cyan-200" />
      </div>
      <h2 className="mt-4 text-[15px] font-semibold text-white">{title}</h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{detail}</p>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card p-5">
      <div className="panel-title">{title}</div>
      <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}
