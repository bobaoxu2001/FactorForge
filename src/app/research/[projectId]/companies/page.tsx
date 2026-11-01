import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceLinks, fmt, Note, Panel, textTone } from "@/components/intel/ui";
import { ordinal } from "@/lib/intel/companies";
import { getResearchProject } from "@/lib/intel/project";

export const revalidate = 3600;
export const metadata = { title: "Competitive intelligence" };

export default function CompaniesPage({ params }: { params: { projectId: string } }) {
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const pid = view.config.id;
  const rows = view.companies;
  const concentration = (ticker: string) => view.config.excerptClaims.find((c) => c.ticker === ticker && c.subject === "Customer concentration");

  return (
    <div className="space-y-5">
      <Panel eyebrow="Stage 04 · Competitive intelligence" title="Peer comparison: same metrics, same definitions">
        <p className="mb-3 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          Every figure is computed from SEC XBRL filings (first-reported, point-in-time) and Yahoo prices. Business models differ, so compare margin <em>changes</em> rather than levels across groups. There is no composite &ldquo;competitive score&rdquo;: rankings would need a weighting nobody can justify from this data.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Latest Q</th>
                <th className="py-2 pr-3 text-right">Rev YoY</th>
                <th className="py-2 pr-3 text-right">Op. margin</th>
                <th className="py-2 pr-3 text-right">Δ YoY</th>
                <th className="py-2 pr-3 text-right">Fuel / rev</th>
                <th className="py-2 pr-3 text-right">TTM FCF</th>
                <th className="py-2 pr-3 text-right">Capex / rev</th>
                <th className="py-2 pr-3 text-right">Net debt / EBITDA</th>
                <th className="py-2 pr-3 text-right">ROIC*</th>
                <th className="py-2 pr-3 text-right">EV/EBITDA</th>
                <th className="py-2 pr-3 text-right">Hist. pct</th>
                <th className="py-2 pr-3 text-right">P/E</th>
                <th className="py-2 pr-3 text-right">6m vs SPY</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {rows.map((c) => {
                const l = c.latest;
                const t = c.latestTtm;
                const netDebt = t?.debt && t.cash !== null ? t.debt.total - t.cash : null;
                const leverage = netDebt !== null && t?.ttmEbitda ? netDebt / t.ttmEbitda : null;
                return (
                  <tr key={c.ticker} className="table-row">
                    <td className="py-2 pr-3">
                      <Link href={`/research/${pid}/companies/${c.ticker}`} className="font-medium text-ink hover:text-cyan-200">{c.ticker}</Link>
                      <div className="text-[10.5px] text-ink-soft">{c.coverage.businessModel}{c.coverage.focus ? " · focus" : ""}</div>
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{l?.label}</td>
                    <td className={`py-2 pr-3 text-right ${textTone(l?.revenueYoY)}`}>{fmt.pct(l?.revenueYoY)}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{fmt.pctPlain(l?.operatingMargin)}</td>
                    <td className={`py-2 pr-3 text-right ${textTone(l?.operatingMarginYoYChange)}`}>{fmt.pp(l?.operatingMarginYoYChange)}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{l?.fuelShare === null ? "n/t" : fmt.pctPlain(l?.fuelShare)}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{fmt.usdM(t?.ttmFreeCashFlow)}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{fmt.pctPlain(c.capexIntensity)}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{leverage === null ? "n/a" : `${leverage.toFixed(1)}×`}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{fmt.pctPlain(c.roicApprox?.value)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{fmt.x(c.valuation?.current.evToEbitda)}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{c.valuation?.percentiles.evToEbitda != null ? ordinal(c.valuation.percentiles.evToEbitda * 100) : "—"}</td>
                    <td className="py-2 pr-3 text-right text-ink-muted">{fmt.x(c.valuation?.current.pe)}</td>
                    <td className={`py-2 pr-3 text-right ${textTone(c.priceStats?.relativeReturn6m)}`}>{fmt.pp(c.priceStats?.relativeReturn6m)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
          n/t = not tagged in XBRL (brokers report purchased transportation, not fuel). n/m = not meaningful (negative or missing denominator). *ROIC ≈ TTM operating income × (1 − tax) ÷ (debt + equity − cash); goodwill-heavy balance sheets depress it. Hist. pct = current EV/EBITDA&apos;s percentile within the company&apos;s own 5-year month-end, point-in-time history.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Business-model differences" title="How each model converts the cycle">
          <ul className="space-y-2 text-[12px] leading-relaxed text-ink-muted">
            {rows.map((c) => {
              const claim = view.config.excerptClaims.find((x) => x.ticker === c.ticker && (x.subject === "Business model" || x.subject === "Capacity sourcing"));
              return (
                <li key={c.ticker} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                  <span className="font-medium text-ink">{c.ticker}</span>: {claim?.claim ?? c.coverage.businessModel} {claim && <EvidenceLinks ids={[`EV-10K-${claim.id}`]} projectId={pid} />}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel eyebrow="Customer concentration & pricing power" title="What the filings disclose">
          <ul className="space-y-2 text-[12px] leading-relaxed text-ink-muted">
            {rows.map((c) => {
              const conc = concentration(c.ticker);
              const pricing = view.config.excerptClaims.find((x) => x.ticker === c.ticker && (x.subject === "Fuel pass-through" || x.subject === "Contract pricing"));
              return (
                <li key={c.ticker} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                  <span className="font-medium text-ink">{c.ticker}</span>: {conc ? <>{conc.claim} <EvidenceLinks ids={[`EV-10K-${conc.id}`]} projectId={pid} /></> : <span className="text-ink-soft">No concentration figure extracted.</span>}
                  {pricing && <div className="mt-0.5">{pricing.claim} <EvidenceLinks ids={[`EV-10K-${pricing.id}`]} projectId={pid} /></div>}
                </li>
              );
            })}
          </ul>
          <div className="mt-2"><Note>Pricing power is described from disclosures (surcharge recovery, contract terms) rather than scored. Testing it properly needs rate data by customer, which is not public.</Note></div>
        </Panel>
      </div>
    </div>
  );
}
