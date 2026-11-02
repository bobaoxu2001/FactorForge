import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DcfCalculator from "@/components/intel/DcfCalculator";
import ScenarioPanel from "@/components/intel/ScenarioPanel";
import { CompanyResearchBrief } from "@/components/intel/ResearchBrief";
import { TimeSeriesChart } from "@/components/intel/charts";
import { EvidenceLinks, fmt, KeyValues, Note, Panel, Stat, textTone, toneOf } from "@/components/intel/ui";
import { ordinal, scenarioBase, scenarioResults } from "@/lib/intel/companies";
import { getCompany, getResearchProject, getSnapshot, listProjectIds, PROJECT_CONFIGS } from "@/lib/intel/project";
import { buildQuantLens } from "@/lib/intel/quantLens";
import { sensitivityGrid } from "@/lib/intel/valuation";

export const revalidate = 3600;

// Every valid id is known at build time; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return listProjectIds().flatMap((projectId) => PROJECT_CONFIGS[projectId].companies.map((c) => ({ projectId, ticker: c.ticker })));
}

export function generateMetadata({ params }: { params: { projectId: string; ticker: string } }): Metadata {
  return { title: `${params.ticker.toUpperCase()} company research` };
}

const DERIVATION_MARK: Record<string, string> = { "ytd-difference": "†", "fy-minus-9m": "‡" };

export default function CompanyPage({ params }: { params: { projectId: string; ticker: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const c = getCompany(view, params.ticker);
  if (!c) notFound();
  const pid = view.config.id;
  const snapshot = getSnapshot(pid)!;
  const prices = snapshot.prices.prices;
  const lens = prices[c.ticker] && prices.SPY ? buildQuantLens(prices[c.ticker], prices.SPY) : null;
  const attribution = view.attribution[c.ticker];
  const rows = c.quarters.slice(-8);
  const chartRows = c.quarters.filter((q) => q.end >= "2021-01-01").map((q) => ({ date: q.label, revenue: q.revenue, margin: q.operatingMargin }));
  const valuation = c.valuation;
  const scenarios = scenarioResults(c);
  const base = scenarioBase(c);
  const stats = valuation?.stats.evToEbitda;
  const margins = c.latestTtm?.ttmOperatingMargin != null ? [-0.02, -0.01, 0, 0.01, 0.02].map((d) => (c.latestTtm!.ttmOperatingMargin as number) + d) : [];
  const multiples = stats ? [stats.p25, stats.median, stats.p75].map((m) => Math.round(m * 10) / 10) : [];
  const grid = base && margins.length && multiples.length ? sensitivityGrid({ ...base, revenueGrowth: c.latestTtm?.ttmRevenueYoY ?? 0 }, margins, multiples) : null;
  const t = c.latestTtm;
  const dcfDefaults =
    t && base
      ? {
          baseRevenue: base.ttmRevenue,
          initialGrowth: Math.max(-0.1, Math.min(0.15, t.ttmRevenueYoY ?? 0.03)),
          terminalGrowth: 0.02,
          years: 5,
          ebitMargin: t.ttmOperatingMargin ?? 0.05,
          taxRate: c.roicApprox?.taxRate ?? 0.21,
          reinvestmentRate: Math.max(0, ((t.ttmCapex ?? 0) - (t.ttmDA ?? 0)) / base.ttmRevenue),
          wacc: 0.09,
          netDebt: base.netDebt,
          shares: base.shares,
        }
      : null;
  const topics = [...new Set(c.excerpts.map((e) => e.topic))];
  const ps = c.priceStats;

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="lab-eyebrow"><Link href={`/research/${pid}/companies`} className="hover:text-ink">Competitive intel</Link> / {c.coverage.businessModel}</div>
            <h2 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">{c.ticker} · {c.name}</h2>
            <div className="mt-1 text-[12px] text-ink-soft">SEC registrant: {c.legalName} · CIK {c.cik} · {c.sicDescription} · FYE {c.fiscalYearEnd}</div>
            <p className="mt-2 max-w-3xl text-[12.5px] text-ink-muted">Research angle: {c.coverage.researchAngle}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11.5px]">
            <a className="rounded-lg border border-line px-2.5 py-1.5 text-accent hover:border-accent/40" href={c.sources.browse} target="_blank" rel="noopener noreferrer">EDGAR filings ↗</a>
            {c.annualReport && <a className="rounded-lg border border-line px-2.5 py-1.5 text-accent hover:border-accent/40" href={c.annualReport.url} target="_blank" rel="noopener noreferrer">Latest 10-K ({c.annualReport.filed}) ↗</a>}
            <a className="rounded-lg border border-line px-2.5 py-1.5 text-accent hover:border-accent/40" href={c.sources.companyFacts} target="_blank" rel="noopener noreferrer">XBRL facts ↗</a>
          </div>
        </div>
        {ps && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label={`Close ${ps.lastDate}`} value={fmt.usd(ps.lastClose)} />
            <Stat label="6m total return" value={fmt.pct(ps.return6m)} tone={toneOf(ps.return6m)} hint={`SPY ${fmt.pct(ps.marketReturn6m)} · IYT ${fmt.pct(ps.sectorReturn6m)}`} />
            <Stat label="1y total return" value={fmt.pct(ps.return1y)} tone={toneOf(ps.return1y)} />
            <Stat label="1y volatility" value={fmt.pctPlain(ps.volatility1y, 0)} />
            <Stat label="1y max drawdown" value={fmt.pctPlain(ps.maxDrawdown1y, 0)} tone="negative" />
            <Stat label="Avg $ volume (3m)" value={fmt.usdM(ps.avgDollarVolume3m)} hint="liquidity" />
          </div>
        )}
      </Panel>

      <CompanyResearchBrief company={c} view={view} />

      <Panel eyebrow="Company overview" title="Business context from the latest 10-K">
        <details>
          <summary className="cursor-pointer text-[13px] font-medium text-accent">Read {Math.min(topics.length, 10)} source excerpts · filed {c.annualReport?.filed}</summary>
        <div className="grid gap-2 md:grid-cols-2">
          {topics.slice(0, 10).map((topic) => {
            const e = c.excerpts.find((x) => x.topic === topic)!;
            return (
              <blockquote key={topic} className="rounded-md border border-line bg-ink/[0.02] px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
                <div className="mb-0.5 text-[10px] text-ink-soft">{topic.replace(/([A-Z])/g, " $1")} · {e.section} (approx.)</div>
                &ldquo;{e.text}&rdquo;
              </blockquote>
            );
          })}
        </div>
        </details>
        <p className="mt-2 text-[11px] text-ink-soft">Short excerpts from {c.annualReport?.form} filed {c.annualReport?.filed}, selected by keyword to orient the reader. Read the full filing for context.</p>
      </Panel>

      <Panel eyebrow="Financial analysis" title="Quarterly results (as first reported)" source={`SEC EDGAR XBRL company facts (CIK ${c.cik}); values as first filed.`} actions={<EvidenceLinks ids={[`EV-${c.ticker}-REV`, `EV-${c.ticker}-OM`, `EV-${c.ticker}-FUEL`].filter((id) => view.evidence.some((e) => e.id === id))} projectId={pid} />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-[12px]">
            <thead className="text-[10px] text-ink-soft">
              <tr><th className="py-2 pr-3 text-left">Quarter</th><th className="pr-3">Revenue</th><th className="pr-3">YoY</th><th className="pr-3">Op. income</th><th className="pr-3">Op. margin</th><th className="pr-3">Op. ratio</th><th className="pr-3">Fuel / rev</th><th className="pr-3">EBITDA</th><th className="pr-3">OCF</th><th className="pr-3">Capex</th><th className="pr-3">FCF</th><th className="text-left">Filed</th></tr>
            </thead>
            <tbody className="divide-soft text-ink-muted">
              {rows.map((r) => (
                <tr key={r.end} className="table-row">
                  <td className="py-1.5 pr-3 text-left text-ink">{r.label}{r.revised && <span title="Restated in a later filing" className="ml-1 text-amber-700">*</span>}</td>
                  <td className="pr-3">{fmt.usdM(r.revenue)}{DERIVATION_MARK[r.derivations.revenue ?? ""] ?? ""}</td>
                  <td className={`pr-3 ${textTone(r.revenueYoY)}`}>{fmt.pct(r.revenueYoY)}</td>
                  <td className="pr-3">{fmt.usdM(r.operatingIncome)}</td>
                  <td className="pr-3">{fmt.pctPlain(r.operatingMargin)}</td>
                  <td className="pr-3">{fmt.pctPlain(r.operatingRatio)}</td>
                  <td className="pr-3">{r.fuelShare === null ? "n/t" : fmt.pctPlain(r.fuelShare)}</td>
                  <td className="pr-3">{fmt.usdM(r.ebitda)}</td>
                  <td className="pr-3">{fmt.usdM(r.operatingCashFlow)}{DERIVATION_MARK[r.derivations.operatingCashFlow ?? ""] ?? ""}</td>
                  <td className="pr-3">{fmt.usdM(r.capex)}</td>
                  <td className="pr-3">{fmt.usdM(r.freeCashFlow)}</td>
                  <td className="text-left text-[11px]">{r.availableFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
          † derived as YTD difference (10-Qs report cash flows year-to-date). ‡ derived as annual minus nine months (no standalone Q4 filing). * value later restated; the first-reported figure is shown for point-in-time integrity.
          Concepts: revenue = {c.metrics.revenue.concept}; D&amp;A = {c.metrics.depreciationAmortization.concept ?? "n/a"}; capex = {c.metrics.capex.concept ?? "n/a"}. Operating ratio = 1 − operating margin (trucking convention).
        </p>
        <div className="mt-4">
          <TimeSeriesChart data={chartRows} series={[{ key: "revenue", label: "Revenue", color: "rgba(29,79,145,0.6)", kind: "bar" }, { key: "margin", label: "Operating margin", color: "#1d4f91", axis: "right" }]} leftFormat="usdM" rightFormat="pct" height={240} />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Cash flow, balance sheet & returns" title={`Trailing twelve months through ${t?.label ?? "—"}`}>
          <KeyValues
            rows={[
              ["TTM revenue", `${fmt.usdB(t?.ttmRevenue)} (${fmt.pct(t?.ttmRevenueYoY)} YoY)`],
              ["TTM operating margin", fmt.pctPlain(t?.ttmOperatingMargin)],
              ["TTM EBITDA", fmt.usdM(t?.ttmEbitda)],
              ["TTM free cash flow", `${fmt.usdM(t?.ttmFreeCashFlow)} (OCF ${fmt.usdM(t?.ttmOperatingCashFlow)} − capex ${fmt.usdM(t?.ttmCapex)})`],
              ["Cash conversion (OCF / net income)", c.cashConversion === null ? "n/m" : `${c.cashConversion.toFixed(2)}×`],
              ["Capex intensity", fmt.pctPlain(c.capexIntensity)],
              ["Interest coverage (EBIT / interest)", c.interestCoverage === null ? "n/a (no tagged interest expense)" : c.interestCoverage > 100 ? ">100×" : `${c.interestCoverage.toFixed(1)}×`],
              ["ROIC (approx.)", c.roicApprox ? `${fmt.pctPlain(c.roicApprox.value)} at ${fmt.pctPlain(c.roicApprox.taxRate, 0)} ${c.roicApprox.taxRateSource} tax` : "n/a"],
              ["Diluted share count YoY", fmt.pct(c.shareChangeYoY)],
              ["Cash", fmt.usdM(t?.cash)],
              [
                "Debt (components)",
                t?.debt ? (
                  <span key="d">{fmt.usdM(t.debt.total)}: {t.debt.components.map((d) => `${d.concept} ${fmt.usdM(d.value)}`).join(" + ")}<span className="block text-[11px] text-ink-soft">{t.debt.notes.join(" ")}</span></span>
                ) : "not tagged",
              ],
              ["Net debt", fmt.usdM(t?.debt && t.cash !== null ? t.debt.total - t.cash : null)],
            ]}
          />
        </Panel>
        <Panel eyebrow="Valuation" title="Where the price sits versus its own history" source="SEC EDGAR fundamentals known on each date; Yahoo Finance daily prices; FactorForge calculation." actions={<EvidenceLinks ids={[`EV-${c.ticker}-VAL`].filter((id) => view.evidence.some((e) => e.id === id))} projectId={pid} />}>
          {valuation ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="EV/EBITDA" value={fmt.x(valuation.current.evToEbitda)} hint={valuation.percentiles.evToEbitda != null ? `${ordinal(valuation.percentiles.evToEbitda * 100)} pct of 5y` : "n/a"} />
                <Stat label="P/E (TTM)" value={fmt.x(valuation.current.pe)} hint={valuation.percentiles.pe != null ? `${ordinal(valuation.percentiles.pe * 100)} pct` : "n/m"} />
                <Stat label="EV/Sales" value={fmt.x(valuation.current.evToSales, 2)} />
                <Stat label="FCF yield" value={fmt.pctPlain(valuation.current.fcfYield)} />
              </div>
              <div className="mt-3">
                <TimeSeriesChart
                  data={valuation.history.map((h) => ({ date: h.date.slice(0, 7), evToEbitda: h.evToEbitda, pe: h.pe !== null && h.pe < 150 ? h.pe : null }))}
                  series={[{ key: "evToEbitda", label: "EV/EBITDA", color: "#1d4f91" }, { key: "pe", label: "P/E (capped at 150×)", color: "#8a93a3", axis: "right", dashed: true }]}
                  leftFormat="x"
                  rightFormat="x"
                  height={200}
                  caption={`Month-end multiples using only fundamentals filed by each date (point-in-time). Market cap = raw price × ${valuation.sharesSource === "cover-page" ? "cover-page shares outstanding" : "weighted diluted shares (cover count not tagged)"} as of ${valuation.sharesAsOf}. 5-year EV/EBITDA range ${stats ? `${stats.min.toFixed(1)}–${stats.max.toFixed(1)}× (median ${stats.median.toFixed(1)}×)` : "n/a"}.`}
                />
              </div>
            </>
          ) : (
            <Note tone="warn">Valuation unavailable. See data gaps below.</Note>
          )}
        </Panel>
      </div>

      {scenarios.length > 0 && valuation && (
        <Panel eyebrow="Scenario analysis" title="Bull / base / bear, anchored to the company's own history">
          <ScenarioPanel ticker={c.ticker} scenarios={scenarios} price={valuation.rawPrice} />
          {grid && (
            <div className="mt-4 overflow-x-auto">
              <div className="mb-1 text-[11px] text-ink-soft">Sensitivity: implied value per share (rows: NTM operating margin; columns: EV/EBITDA at the 25th / 50th / 75th historical percentile)</div>
              <table className="w-full min-w-[480px] text-right text-[12px]">
                <thead className="text-[10.5px] text-ink-soft"><tr><th className="py-1 text-left">Margin</th>{multiples.map((m) => <th key={m}>{m.toFixed(1)}×</th>)}</tr></thead>
                <tbody className="divide-soft">
                  {margins.map((m, i) => (
                    <tr key={m}>
                      <td className="py-1 text-left text-ink-muted">{fmt.pctPlain(m)}</td>
                      {grid[i].map((v, j) => <td key={j} className={v !== null && v >= valuation.rawPrice ? "text-emerald-700" : "text-rose-700"}>{v === null ? "n/m" : fmt.usd(v, 0)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {dcfDefaults && valuation && (
        <Panel eyebrow="Intrinsic value framing" title="DCF (free cash flow to the firm)">
          <p className="mb-4 max-w-[100ch] text-[12.5px] leading-relaxed text-ink-muted">Use the gap between models to examine assumptions. The scenarios above apply a historical multiple to next-year EBITDA; this simplified DCF discounts after-tax EBIT less net reinvestment over an explicit forecast and terminal period. Working-capital changes are excluded. Margin, reinvestment and WACC assumptions can therefore produce very different values; neither output is a validated price target.</p>
          <DcfCalculator defaults={dcfDefaults} price={valuation.rawPrice} />
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Earnings & catalysts" title="Filings and expected dates">
          {c.nextEarningsEstimate && <Note>Next results: around <span className="text-ink">{c.nextEarningsEstimate.date}</span>. {c.nextEarningsEstimate.basis}</Note>}
          <ul className="mt-2 space-y-1 text-[12px]">
            {c.filings.slice(0, 8).map((f) => (
              <li key={f.accession} className="flex items-center justify-between gap-2 border-b border-line/60 pb-1 last:border-0">
                <span className="num text-[11.5px] text-ink-muted">{f.filed}</span>
                <span className="flex-1 text-ink">{f.kind === "earnings-release" ? "Earnings release (8-K Item 2.02)" : f.form}{f.reportDate ? ` · period ${f.reportDate}` : ""}</span>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-ink">open ↗</a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-soft">Guidance and consensus expectations are not shown: guidance is not XBRL-tagged, and consensus needs a licensed provider. See the earnings releases above for management commentary.</p>
        </Panel>
        <Panel eyebrow="Risk & attribution" title="What explains the stock's returns?" source="Yahoo Finance daily total returns; OLS on SPY and IYT minus SPY over two years.">
          {attribution ? (
            <KeyValues
              rows={[
                ["Window", `${attribution.start} → ${attribution.end} (${attribution.n} daily obs.)`],
                ["Market beta (SPY)", `${attribution.marketBeta.toFixed(2)} (t ${attribution.marketT.toFixed(1)})`],
                ["Sector beta (IYT − SPY)", `${attribution.sectorBeta.toFixed(2)} (t ${attribution.sectorT.toFixed(1)})`],
                ["Residual return (annualised)", `${fmt.pct(attribution.alphaAnnualized)} (t ${attribution.alphaT.toFixed(2)}): ${Math.abs(attribution.alphaT) < 2 ? "not statistically distinguishable from zero" : "statistically significant at ~95%"}`],
                ["R²", attribution.rSquared.toFixed(2)],
                ["Residual volatility", fmt.pctPlain(attribution.residualVolAnnualized, 0)],
              ]}
            />
          ) : (
            <Note tone="warn">Attribution unavailable (insufficient overlapping prices).</Note>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">OLS on daily total returns over two years. Most of a trucking stock&apos;s movement is market and transport-sector exposure; company-specific research has to explain the residual. See <Link href={`/research/${pid}/thesis`} className="text-accent">Thesis → outcome review</Link> to decompose returns since a thesis date.</p>
        </Panel>
      </div>

      {lens && (
        <Panel eyebrow="Quantitative lens (existing FactorForge engine)" title="Factor snapshot & rule-based backtests on this name">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label="20d momentum" value={fmt.pct(lens.factors.momentum20d)} tone={toneOf(lens.factors.momentum20d)} />
            <Stat label="60d momentum" value={fmt.pct(lens.factors.momentum60d)} tone={toneOf(lens.factors.momentum60d)} />
            <Stat label="20d volatility" value={fmt.pctPlain(lens.factors.volatility20d, 0)} />
            <Stat label="RSI(14)" value={lens.factors.rsi14 === null ? "—" : lens.factors.rsi14.toFixed(0)} />
            <Stat label="Above SMA200" value={lens.factors.aboveSma200 ? "yes" : "no"} />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] text-right text-[12px]">
              <thead className="text-[10px] text-ink-soft"><tr><th scope="col" className="py-2 text-left">Strategy (backtest)</th><th scope="col">Return</th><th scope="col">Excess vs SPY (pp)</th><th scope="col">Sharpe</th><th scope="col">Max DD</th><th scope="col">Trades</th><th scope="col">Win rate</th><th scope="col">Now</th></tr></thead>
              <tbody className="divide-soft text-ink-muted">
                {lens.runs.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="py-1.5 text-left text-ink">{r.name}<span className="ml-1 text-[10.5px] text-ink-soft">{r.type}</span></td>
                    <td className={textTone(r.totalReturn)}>{fmt.pct(r.totalReturn)}</td>
                    <td className={textTone(r.excessReturn)}>{fmt.pp(r.excessReturn)}</td>
                    <td>{r.sharpe.toFixed(2)}</td>
                    <td>{fmt.pctPlain(r.maxDrawdown, 0)}</td>
                    <td>{r.tradeCount}</td>
                    <td>{fmt.pctPlain(r.winRate, 0)}</td>
                    <td>{r.currentPosition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">Backtest window: {lens.period.start} → {lens.period.end}. Each row&apos;s excess return is its cumulative strategy return minus the SPY buy-and-hold return over that run&apos;s aligned dates; it is not annualised alpha.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="Best backtest Sharpe" value={lens.best ? lens.best.sharpe.toFixed(2) : "—"} hint={lens.best?.name} />
            <Stat label={`Luck-only max of ${lens.runs.length}`} value={lens.nullExpectedMaxSharpe.toFixed(2)} hint="expected max Sharpe under no skill" />
            <Stat label="Best after haircut" value={lens.bestSharpeAfterHaircut === null ? "—" : lens.bestSharpeAfterHaircut.toFixed(2)} tone={toneOf(lens.bestSharpeAfterHaircut)} hint={lens.bestSharpeAfterHaircut !== null && lens.bestSharpeAfterHaircut <= 0 ? "no evidence of a timing edge" : "positive, but in-sample"} />
          </div>
          <ul className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-ink-soft">{lens.notes.map((n) => <li key={n}>• {n}</li>)}</ul>
          <div className="mt-2 text-[11.5px]"><Link href="/strategies" className="text-accent hover:text-ink">Open the full Strategy Lab →</Link></div>
        </Panel>
      )}

      <Panel eyebrow="Data limitations" title="Gaps for this company">
        {c.dataGaps.length === 0 ? <p className="text-[12px] text-ink-muted">No structural data gaps detected for the metrics used here.</p> : (
          <ul className="space-y-1 text-[12px] text-ink-muted">{c.dataGaps.map((g) => <li key={g}>• {g}</li>)}</ul>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">Snapshot retrieved {c.retrievedAt.slice(0, 10)} from SEC EDGAR (company facts and submissions) and Yahoo Finance.</p>
      </Panel>
    </div>
  );
}
