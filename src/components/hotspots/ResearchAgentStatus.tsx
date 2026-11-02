import { CheckCircle2, CircleDashed, PlugZap } from "lucide-react";
import type { AgentStep, HotspotAgentReport } from "@/lib/agents/types";

const STATUS_META: Record<AgentStep["status"], { label: string; chip: string; Icon: typeof CheckCircle2 }> = {
  complete: { label: "Live data", chip: "border-emerald-600/35 bg-emerald-500/12 text-emerald-700", Icon: CheckCircle2 },
  demo: { label: "Template", chip: "border-accent/30 bg-accent/[0.08] text-accent", Icon: CircleDashed },
  "not-connected": { label: "Not connected", chip: "border-amber-600/35 bg-amber-400/10 text-amber-800", Icon: PlugZap },
};

/**
 * Research Agent Status — shows the deterministic agent workflow and honest
 * data-source labeling (demo catalyst engine, news API not connected).
 */
export default function ResearchAgentStatus({ report }: { report: HotspotAgentReport }) {
  const { agentSteps, dataSource } = report;
  return (
    <section className="card relative overflow-hidden p-6 panel-glow">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-label">Research Agent Status</div>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
            A deterministic, auditable workflow. Each step shows whether it ran on live market data, a configured
            template, or needs an external API to go live.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip border-amber-600/35 bg-amber-400/10 text-amber-800">{dataSource.engine}</span>
          <span className="chip border-line bg-ink/[0.04] text-ink-soft">
            News API: {dataSource.newsConnected ? "connected" : "not connected"}
          </span>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {agentSteps.map((step, i) => {
          const meta = STATUS_META[step.status];
          const Icon = meta.Icon;
          return (
            <li key={step.id} className="rounded-lg border border-line bg-ink/[0.025] p-3.5">
              <div className="flex items-center justify-between">
                <span className="num text-[11px] font-semibold text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                <span className={`chip ${meta.chip}`}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 text-[13px] font-semibold text-ink">{step.label}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{step.detail}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-muted md:grid-cols-2">
        <p>
          <span className="font-medium text-ink">Catalyst engine. </span>
          {dataSource.note}
        </p>
        <p>
          <span className="font-medium text-ink">Market data. </span>
          {dataSource.marketDataNote}
        </p>
      </div>
    </section>
  );
}
