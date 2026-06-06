import type { StressInsightCard } from "@/lib/quant/marketStress";
import { stressToneCard, stressToneDot } from "./stressStyles";

const dataQualityLabel: Record<StressInsightCard["dataQuality"], string> = {
  real: "Real data",
  mixed: "Mixed data",
  fallback: "Fallback data",
};

/**
 * AI-style market-intelligence cards explaining selloff/regime conditions. Each
 * card carries a short explanation, confidence score, data-quality indicator,
 * and a suggested research action — never a buy/sell instruction.
 */
export default function StressInsightGrid({ cards }: { cards: StressInsightCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.title} className={`rounded-2xl border p-4 ${stressToneCard[card.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${stressToneDot[card.tone]}`} />
                <span className="text-[10px] uppercase tracking-[0.16em] opacity-75">{card.title}</span>
              </div>
              <div className="mt-1.5 text-[15px] font-semibold text-white">{card.state}</div>
            </div>
            <div className="text-right">
              <div className="num text-[20px] font-semibold leading-none text-white">{card.confidence}</div>
              <div className="text-[9px] uppercase tracking-[0.14em] opacity-70">confidence</div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{card.explanation}</p>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <div className="text-[9.5px] uppercase tracking-[0.16em] text-ink-soft">Suggested research action</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink">{card.researchAction}</p>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <span>{dataQualityLabel[card.dataQuality]}</span>
            <span>Research only</span>
          </div>
        </div>
      ))}
    </div>
  );
}
