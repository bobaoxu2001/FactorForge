import Link from "next/link";
import StatusBadge from "@/components/badges/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import AiTransparencyNote from "@/components/research/AiTransparencyNote";
import { generateStrategyExplanation } from "@/lib/ai/strategyExplainer";
import { generateConcentrationNote } from "@/lib/ai/concentrationNote";
import { getResearchDataset } from "@/lib/research";
import { num, pct, pctPlain } from "@/lib/utils/format";

export const revalidate = 60 * 60;

export default async function ReportsPage() {
  const { radarCandidates, signalConcentration, metadata } = await getResearchDataset();
  const demotedCount = radarCandidates.filter((c) => c.redundancy?.demoted).length;
  const [cards, concentrationNote] = await Promise.all([
    Promise.all(
      radarCandidates.map(async (candidate) => ({
        candidate,
        explanation: await generateStrategyExplanation(candidate.result),
      })),
    ),
    generateConcentrationNote(signalConcentration, { demotedCount }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="L6 Reports"
        title="Automated Research Report Cards"
        subtitle="Reports pair deterministic backtest metrics with an LLM-written narrative (DeepSeek, when configured). Numbers come from the engine; only prose is generated."
        actions={
          <div className="rounded-xl border border-line bg-white/[0.03] px-3.5 py-2 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Dataset generated</div>
            <div className="num mt-0.5 text-[12.5px] text-ink">
              {new Date(metadata.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink-soft">Next-open execution · modeled costs</div>
          </div>
        }
      />

      <AiTransparencyNote />

      {concentrationNote && signalConcentration && (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Portfolio Concentration Note</div>
            <div className="flex items-center gap-2">
              <StatusBadge status={`${signalConcentration.level} overlap`} />
              <span className="text-[12px] text-ink-soft">{concentrationNote.source === "deepseek" ? "deepseek memo" : "template memo"}</span>
            </div>
          </div>
          <h2 className="mt-3 text-[18px] font-semibold text-ink">{concentrationNote.headline}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink">{concentrationNote.assessment}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-brand-blue">{concentrationNote.researchAction}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
            <Mini label="Screened" value={String(signalConcentration.strategyCount)} />
            <Mini label="Effective bets" value={num(signalConcentration.effectiveStrategies, 1)} />
            <Mini label="Avg correlation" value={pctPlain(signalConcentration.averagePairwiseCorrelation)} />
          </div>
          <Link href="/radar" className="mt-4 inline-flex text-[12px] text-ink-muted hover:text-ink">
            See the concentration gate on Radar →
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map(({ candidate, explanation }) => {
          const result = candidate.result;
          const annual = result.metrics.annualizedReturn;
          return (
            <article
              key={result.strategyId}
              className="card card-hover panel-glow relative flex flex-col overflow-hidden p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={candidate.status} />
                  <StatusBadge status={result.dataStatus.adjusted ? "adjusted prices" : "raw/demo prices"} />
                </div>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-soft">
                  {explanation.source === "deepseek" ? "DeepSeek memo" : "Template memo"}
                </span>
              </div>

              <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-white">
                {result.strategyName} <span className="text-ink-soft">·</span> <span className="num">{result.symbol}</span>
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">{explanation.summary}</p>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <Mini label="Annualized" value={pct(annual)} tone={annual >= 0 ? "pos" : "neg"} />
                <Mini label="Sharpe" value={num(result.metrics.sharpe)} />
                <Mini label="Max DD" value={pct(result.metrics.maxDrawdown)} tone="neg" />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  <span>Radar score</span>
                  <span className="num text-ink">{candidate.score}/100</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                    style={{ width: `${Math.max(4, Math.min(100, candidate.score))}%` }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Key risks</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{explanation.keyRisks}</p>
              </div>

              <Link
                href={`/strategies/${result.strategyId}`}
                className="mt-5 inline-flex w-fit items-center gap-1 text-[12px] font-medium text-cyan-200/90 transition-colors hover:text-cyan-100"
              >
                Open full backtest →
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "pos" | "neg" }) {
  const valueColor = tone === "pos" ? "text-emerald-300" : tone === "neg" ? "text-rose-300" : "text-ink";
  return (
    <div className="stat-tile !p-3">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{label}</div>
      <div className={`num mt-1 text-[16px] font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}
