import Link from "next/link";
import StatusBadge from "@/components/badges/StatusBadge";
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
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">L6 Reports</div>
        <h1 className="mt-1 text-[28px] font-semibold text-ink">Automated Research Report Cards</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Reports pair deterministic backtest metrics with an LLM-written narrative (DeepSeek, when configured). Numbers come from the engine; only prose is generated.
        </p>
        <p className="mt-2 text-[12px] text-ink-soft">
          Dataset generated {new Date(metadata.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}; backtests use next-open execution with modeled costs.
        </p>
      </header>

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
          <p className="mt-2 text-[13px] leading-relaxed text-brand-blue">{concentrationNote.recommendation}</p>
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
          return (
            <article key={result.strategyId} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={candidate.status} />
                <StatusBadge status={result.dataStatus.adjusted ? "adjusted prices" : "raw/demo prices"} />
                <span className="text-[12px] text-ink-soft">{explanation.source === "deepseek" ? "deepseek memo" : "template memo"}</span>
              </div>
              <h2 className="mt-3 text-[18px] font-semibold text-ink">{result.strategyName} · {result.symbol}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">{explanation.summary}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
                <Mini label="Annual" value={pct(result.metrics.annualizedReturn)} />
                <Mini label="Sharpe" value={num(result.metrics.sharpe)} />
                <Mini label="Score" value={String(candidate.score)} />
              </div>
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wider text-ink-soft">Key risks</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{explanation.keyRisks}</p>
              </div>
              <Link href={`/strategies/${result.strategyId}`} className="mt-4 inline-flex text-[12px] text-ink-muted hover:text-ink">
                Open full backtest →
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="num mt-0.5 text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}
