import Link from "next/link";
import PeerSensitivity from "@/components/intel/PeerSensitivity";
import { notFound } from "next/navigation";
import { EvidenceLinks, fmt, Note, OutcomeBadge, Panel, textTone, TriggerBadge } from "@/components/intel/ui";
import { dailyReturnMap, decomposeReturn, marketSectorAttribution } from "@/lib/intel/attribution";
import { adjCloses, scenarioResults } from "@/lib/intel/companies";
import { getResearchProject, getSnapshot } from "@/lib/intel/project";
import { pearsonPairs } from "@/lib/intel/series";

export const revalidate = 3600;
export const metadata = { title: "Thesis & decision support" };

function shiftMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function ThesisPage({ params, searchParams }: { params: { projectId: string }; searchParams: { since?: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const pid = view.config.id;
  const prices = getSnapshot(pid)!.prices.prices;
  const market = prices[view.config.marketBenchmark.symbol];
  const sector = prices[view.config.sectorBenchmark.symbol];
  const lastDate = market.rows.at(-1)![0];
  const since = searchParams.since && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.since) && searchParams.since < lastDate ? searchParams.since : shiftMonths(lastDate, -6);
  const illustrative = !searchParams.since;
  const focus = view.companies.filter((c) => c.coverage.focus);

  // Outcome review: betas estimated on the year BEFORE `since` (no look-ahead), applied after it.
  const review = view.companies.map((c) => {
    const stock = adjCloses(prices[c.ticker]);
    const betas = marketSectorAttribution(stock, adjCloses(market), adjCloses(sector), shiftMonths(since, -12), since);
    const d = betas ? decomposeReturn(stock, adjCloses(market), adjCloses(sector), betas, since) : null;
    return { c, betas, d };
  });

  // Portfolio context: 1-year daily-return correlations among focus names and benchmarks.
  const oneYearAgo = shiftMonths(lastDate, -12);
  const symbols = [...focus.map((c) => c.ticker), "IYT", "SPY"];
  const returns = Object.fromEntries(symbols.map((s) => [s, dailyReturnMap(adjCloses(prices[s]))]));
  const corr = (a: string, b: string) => {
    const pairs: Array<[number, number]> = [];
    for (const [date, r] of returns[a]) if (date > oneYearAgo && returns[b].has(date)) pairs.push([r, returns[b].get(date) as number]);
    return pearsonPairs(pairs);
  };
  const basketVol = (() => {
    const dates = [...returns[focus[0].ticker].keys()].filter((d) => d > oneYearAgo && focus.every((c) => returns[c.ticker].has(d)));
    const series = dates.map((d) => focus.reduce((s, c) => s + (returns[c.ticker].get(d) as number), 0) / focus.length);
    const m = series.reduce((s, v) => s + v, 0) / series.length;
    return Math.sqrt(series.reduce((s, v) => s + (v - m) ** 2, 0) / (series.length - 1)) * Math.sqrt(252);
  })();

  return (
    <div className="space-y-5">
      <Panel eyebrow="Stage 06 · Thesis & decision support" title="Competing hypotheses and what would invalidate them">
        <div className="space-y-3">
          {view.hypotheses.map((h) => (
            <article key={h.id} className="rounded-md border border-line bg-ink/[0.02] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{h.id} · {h.title} <span className="ml-1 text-[11px] font-normal text-ink-soft">{h.stance}</span></div>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{h.statement}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-soft">Narrative being tested: {h.marketNarrative}</p>
                </div>
                <OutcomeBadge outcome={h.overall} />
              </div>
              <ul className="mt-2 space-y-1 text-[12px]">
                {h.tests.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    {t.sensitivity || t.diagnosticOnly ? <span className="chip border-line text-ink-muted">{t.diagnosticOnly ? "diagnostic" : "mean rule"}: {t.outcome === "supports" ? "met" : t.outcome === "contradicts" ? "not met" : "unavailable"}</span> : <OutcomeBadge outcome={t.outcome} />}
                    <span className="text-ink-muted">{t.description}: <span className="text-ink">{t.detail}</span></span>
                    <EvidenceLinks ids={t.evidenceIds} projectId={pid} max={4} />
                    {t.sensitivity && <><PeerSensitivity test={t} /><EvidenceLinks ids={["EV-WERN-Q2-RECONCILIATION"]} projectId={pid} /></>}
                  </li>
                ))}
              </ul>
              {h.triggers.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-line/60 pt-2 text-[12px]">
                  {h.triggers.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-2">
                      <TriggerBadge state={t.state} />
                      <span className="text-ink-muted">Invalidates if: {t.description}. {t.detail}{t.lastChecked ? ` (data through ${t.lastChecked})` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 text-[11px] text-ink-soft">Missing evidence: {h.missingEvidence.join("; ")}</div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel eyebrow="Expected return & valuation" title="Scenario ranges for the focus names" source="FactorForge scenario model on SEC fundamentals and Yahoo Finance prices; probabilities only when you enter them.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-[12.5px]">
            <thead className="text-[10.5px] text-ink-soft"><tr><th className="py-2 text-left">Company</th><th>Price</th><th>Bear</th><th>Base</th><th>Bull</th><th>Upside / downside</th><th className="text-left pl-3">Probabilities</th></tr></thead>
            <tbody className="divide-soft">
              {focus.map((c) => {
                const s = scenarioResults(c);
                const get = (k: string) => s.find((x) => x.case === k)?.impliedReturn ?? null;
                const up = get("bull");
                const down = get("bear");
                return (
                  <tr key={c.ticker} className="table-row">
                    <td className="py-2 text-left"><Link href={`/research/${pid}/companies/${c.ticker}`} className="font-medium text-ink hover:text-accent">{c.ticker}</Link></td>
                    <td className="text-ink-muted">{fmt.usd(c.valuation?.rawPrice)}</td>
                    <td className={textTone(down)}>{fmt.pct(down)}</td>
                    <td className={textTone(get("base"))}>{fmt.pct(get("base"))}</td>
                    <td className={textTone(up)}>{fmt.pct(up)}</td>
                    <td className="text-ink">{up !== null && down !== null && down < 0 ? `${(up / Math.abs(down)).toFixed(2)}×` : "n/m"}</td>
                    <td className="pl-3 text-left text-[11.5px] text-ink-soft"><Link href={`/research/${pid}/companies/${c.ticker}`} className="text-accent">set with justification →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2"><Note>Ranges come from each company&apos;s own 5-year distribution of growth, margin and EV/EBITDA, not from forecasts. Probabilities are left blank by default: assigning them is an analyst judgement that must be written down with reasons on the company page.</Note></div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Portfolio context" title="Concentration, correlation & liquidity">
          <div className="overflow-x-auto">
            <table className="w-full text-center text-[12px]">
              <thead className="text-ink-soft"><tr><th className="py-1 text-left">1y corr.</th>{symbols.map((s) => <th key={s}>{s}</th>)}</tr></thead>
              <tbody>
                {symbols.map((a) => (
                  <tr key={a}>
                    <td className="py-1 text-left text-ink-muted">{a}</td>
                    {symbols.map((b) => {
                      const v = a === b ? 1 : corr(a, b);
                      return <td key={b} className="num" style={{ background: v === null ? undefined : `rgba(29,79,145,${Math.max(0, v) * 0.35})` }}>{v === null ? "—" : v.toFixed(2)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1 text-[12px] text-ink-muted">
            <li>• All focus names are U.S. transportation: one sector, highly correlated. An equal-weight basket of the three had {fmt.pctPlain(basketVol, 0)} annualised volatility over the past year, which is limited diversification within the theme.</li>
            {focus.map((c) => (
              <li key={c.ticker}>• {c.ticker}: market beta {view.attribution[c.ticker]?.marketBeta.toFixed(2) ?? "—"}, 1y vol {fmt.pctPlain(c.priceStats?.volatility1y, 0)}, 1y max drawdown {fmt.pctPlain(c.priceStats?.maxDrawdown1y, 0)}, average daily traded value {fmt.usdM(c.priceStats?.avgDollarVolume3m)}.</li>
            ))}
            <li>• Position sizing, transaction costs and cash allocation are a portfolio decision outside this research view. The Trade Simulator and Paper Observation pages model execution costs for simulated positions.</li>
          </ul>
        </Panel>
        <Panel eyebrow="Historical thesis review" title="Was the outcome research insight or market movement?">
          <form className="mb-3 flex flex-wrap items-end gap-2 text-[12px]" method="get">
            <label className="text-ink-soft">Thesis adopted on
              <input type="date" name="since" defaultValue={since} max={lastDate} className="ml-2 h-8 rounded-md border border-line bg-ink/[0.04] px-2 text-ink" />
            </label>
            <button className="h-8 rounded-md border border-accent/35 bg-accent/[0.08] px-3 text-accent">Review</button>
          </form>
          {illustrative && <div className="mb-2"><Note tone="warn">No thesis adoption date set. Showing the last six months to illustrate the method; this is not a review of a past call.</Note></div>}
          <table className="w-full text-right text-[12px]">
            <thead className="text-[10.5px] text-ink-soft"><tr><th className="py-1 text-left">Since {since}</th><th>Total</th><th>Market</th><th>Sector</th><th>Residual</th></tr></thead>
            <tbody className="divide-soft">
              {review.map(({ c, d }) => (
                <tr key={c.ticker}>
                  <td className="py-1 text-left text-ink">{c.ticker}</td>
                  {d ? (
                    <>
                      <td className={textTone(d.total)}>{fmt.pct(d.total)}</td>
                      <td className="text-ink-muted">{fmt.pct(d.market)}</td>
                      <td className="text-ink-muted">{fmt.pct(d.sector)}</td>
                      <td className={textTone(d.residual)}>{fmt.pct(d.residual)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="text-ink-soft">insufficient history before this date</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">Betas are estimated on the 12 months before the adoption date and applied afterwards, so the split uses no future information. Pieces are sums of daily returns (they add up exactly; compounding is approximate). A thesis &ldquo;worked&rdquo; only if the residual moved in its direction and the reason matches the evidence recorded at adoption.</p>
        </Panel>
      </div>

      <Panel eyebrow="Separation of performance types" title="Backtest vs simulated vs actual">
        <ul className="grid gap-2 text-[12px] text-ink-muted md:grid-cols-3">
          <li className="rounded-lg border border-line bg-ink/[0.02] p-3"><span className="font-medium text-ink">Backtested</span>: strategy runs on history (company quant lens, Strategy Lab). In-sample; shown with a multiple-testing haircut.</li>
          <li className="rounded-lg border border-line bg-ink/[0.02] p-3"><span className="font-medium text-ink">Simulated</span>: paper observation and the Trade Simulator. Forward but hypothetical; no orders are placed.</li>
          <li className="rounded-lg border border-line bg-ink/[0.02] p-3"><span className="font-medium text-ink">Actual trades</span>: not supported. FactorForge has no order execution and records no real-money positions.</li>
        </ul>
      </Panel>
    </div>
  );
}
