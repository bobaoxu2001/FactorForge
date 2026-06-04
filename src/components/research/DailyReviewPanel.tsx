import MetricCard from "@/components/cards/MetricCard";
import type { DailyReview } from "@/types/strategy";
import type { DailyReviewNote } from "@/lib/ai/dailyReviewNote";
import { pct, pctPlain } from "@/lib/utils/format";

interface Props {
  review: DailyReview;
  note: DailyReviewNote | null;
}

/**
 * Post-market Daily Review panel. Renders the deterministic
 * end-of-session blotter (book P&L tally, weakest leg, same-batch concentration,
 * today's simulated tape) with the AI/template narrative on top. Every number
 * comes from {@link buildDailyReview}; the note only adds prose.
 */
export default function DailyReviewPanel({ review, note }: Props) {
  const weakestTone = review.weakest && review.weakest.returnPct < 0 ? "negative" : "positive";

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Daily Review</div>
          <h2 className="mt-1 text-[20px] font-semibold text-ink">Post-market auto-review</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            An automatic end-of-session read of the simulated book: P&amp;L breadth, the weakest leg, how many
            observations came from the same scan, and today&rsquo;s tape. No broker, no real orders — every count is a
            paper observation.
          </p>
        </div>
        <div className="text-right text-[12px] text-ink-muted">
          As of<br />
          <span className="num text-ink">{review.asOf}</span>
          {note && (
            <div className="mt-1 text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">
              {note.source === "deepseek" ? "AI narrative" : "template narrative"}
            </div>
          )}
        </div>
      </div>

      {note && (
        <div className="mt-5 rounded-2xl border border-line bg-white/[0.035] p-4">
          <p className="text-[15px] font-medium leading-relaxed text-ink">{note.headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{note.body}</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Book P&L"
          value={`${review.winners}W / ${review.losers}L`}
          tone={review.losers === 0 ? "positive" : review.winners === 0 ? "negative" : "default"}
        />
        <MetricCard
          label="Weakest leg"
          value={review.weakest ? `${review.weakest.symbol} ${pct(review.weakest.returnPct)}` : "—"}
          tone={weakestTone}
          hint={review.weakest?.label}
        />
        <MetricCard
          label="Same-batch"
          value={review.largestBatch ? `${review.largestBatch.count} obs` : "—"}
          hint={review.largestBatch?.signalDate}
        />
        <MetricCard label="Deployed" value={pctPlain(review.deployedExposurePct)} tone="accent" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Entries today" value={String(review.tape.entries)} />
        <MetricCard label="Exits today" value={String(review.tape.exits)} />
        <MetricCard label="Skipped signals" value={String(review.tape.skipped)} />
        <MetricCard label="Gate rejections" value={String(review.tape.rejected)} tone={review.tape.rejected > 0 ? "negative" : "default"} />
      </div>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">Needs a look before next session</div>
        <ul className="mt-2 space-y-2">
          {review.watchItems.map((item) => (
            <li key={item} className="rounded-2xl border border-line bg-white/[0.035] p-3 text-[12px] leading-relaxed text-ink-muted">
              {item}
            </li>
          ))}
        </ul>
        {note?.watch && (
          <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
            <span className="uppercase tracking-wider">Desk note · </span>
            {note.watch}
          </p>
        )}
      </div>
    </section>
  );
}
