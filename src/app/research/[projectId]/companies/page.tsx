import { notFound } from "next/navigation";
import CompanyComparison, { type CompanyComparisonRow } from "@/components/intel/CompanyComparison";
import ResearchBrief from "@/components/intel/ResearchBrief";
import { EvidenceLinks, Note, Panel } from "@/components/intel/ui";
import { getResearchProject } from "@/lib/intel/project";
import { findCommonQuarter, quarterEvidenceId } from "@/lib/intel/comparability";
import type { CompanyView, QuarterRow } from "@/lib/intel/companies";

export const revalidate = 3600;
export const metadata = { title: "Competitive intelligence" };

export default async function CompaniesPage({ params: paramsPromise }: { params: Promise<{ projectId: string }> }) {
  const params = await paramsPromise;
  const view = getResearchProject(params.projectId);
  if (!view) notFound();
  const pid = view.config.id;
  const rows = view.companies;
  const common = findCommonQuarter(rows);
  const known = new Set(view.evidence.map((item) => item.id));
  const comparisonRow = (company: CompanyView, selected?: QuarterRow): CompanyComparisonRow => {
    const latest = selected ?? company.latest;
    const ttm = selected ?? company.latestTtm;
    const netDebt = ttm?.debt && ttm.cash !== null ? ttm.debt.total - ttm.cash : null;
    const ebitda = ttm?.ttmEbitda;
    return {
      ticker: company.ticker,
      name: company.name,
      businessModel: company.coverage.businessModel,
      focus: company.coverage.focus,
      quarter: latest?.label ?? null,
      ttmQuarter: ttm?.label ?? null,
      evidenceIds: Object.fromEntries(([['revenueYoY', 'REV'], ['operatingMargin', 'OM'], ['marginChange', 'OM'], ['fuelShare', 'FUEL']] as const).flatMap(([metric, key]) => {
        const id = selected ? quarterEvidenceId(company.ticker, key, selected.end) : `EV-${company.ticker}-${key}`;
        return known.has(id) ? [[metric, id]] : [];
      })),
      metrics: {
        revenueYoY: latest?.revenueYoY ?? null,
        operatingMargin: latest?.operatingMargin ?? null,
        marginChange: latest?.operatingMarginYoYChange ?? null,
        fuelShare: latest?.fuelShare ?? null,
        freeCashFlow: ttm?.ttmFreeCashFlow ?? null,
        capexIntensity: ttm?.ttmCapex != null && ttm.ttmRevenue ? ttm.ttmCapex / ttm.ttmRevenue : null,
        leverage: netDebt !== null && ebitda != null && ebitda > 0 ? netDebt / ebitda : null,
        roic: company.roicApprox?.value ?? null,
        evToEbitda: company.valuation?.current.evToEbitda ?? null,
        historicalPercentile: company.valuation?.percentiles.evToEbitda ?? null,
        pe: company.valuation?.current.pe ?? null,
        relativeReturn6m: company.priceStats?.relativeReturn6m ?? null,
        volatility1y: company.priceStats?.volatility1y ?? null,
        maxDrawdown1y: company.priceStats?.maxDrawdown1y ?? null,
      },
    };
  };
  const comparisonRows = rows.map((company) => comparisonRow(company));
  const concentration = (ticker: string) => view.config.excerptClaims.find((c) => c.ticker === ticker && c.subject === "Customer concentration");

  return (
    <div className="space-y-5">
      <details className="rounded-md border border-line bg-paper p-4">
        <summary className="cursor-pointer text-[13px] font-medium text-ink">Case-study context and working view</summary>
        <div className="mt-4"><ResearchBrief view={view} /></div>
      </details>
      <Panel eyebrow="Stage 04 · Competitive intelligence" title="Peer comparison: operating results, valuation and risk" source="SEC EDGAR XBRL company facts; Yahoo Finance prices; FactorForge calculation.">
        <p className="mb-3 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
          Figures come from SEC XBRL filings and Yahoo prices. Start with operating performance, then test valuation and risk. Business models differ: compare margin <em>changes</em> and matching reporting periods before interpreting relative performance. There is no composite competitive score.
        </p>
        <CompanyComparison projectId={pid} companies={comparisonRows} commonQuarter={common ? { label: common.label, companies: common.rows.map(({ company, row }) => comparisonRow(company, row)) } : undefined} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Business-model differences" title="How each model converts the cycle">
          <ul className="space-y-2 text-[12px] leading-relaxed text-ink-muted">
            {rows.map((c) => {
              const claim = view.config.excerptClaims.find((x) => x.ticker === c.ticker && (x.subject === "Business model" || x.subject === "Capacity sourcing"));
              return (
                <li key={c.ticker} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2">
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
                <li key={c.ticker} className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2">
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
