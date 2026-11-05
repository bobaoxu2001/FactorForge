"use client";

import Link from "next/link";
import { useState } from "react";
import { fmt, textTone } from "./ui";

type MetricKey =
  | "revenueYoY" | "operatingMargin" | "marginChange" | "fuelShare"
  | "freeCashFlow" | "capexIntensity" | "leverage" | "roic"
  | "evToEbitda" | "historicalPercentile" | "pe" | "relativeReturn6m"
  | "volatility1y" | "maxDrawdown1y";

/** Only the displayed, serializable figures cross the server/client boundary. */
export interface CompanyComparisonRow {
  ticker: string;
  name: string;
  businessModel: string;
  focus: boolean;
  quarter: string | null;
  ttmQuarter: string | null;
  metrics: Record<MetricKey, number | null>;
  evidenceIds?: Partial<Record<MetricKey, string>>;
}

type View = "operating" | "valuation" | "risk";
type SortKey = "ticker" | MetricKey;
type Column = { key: MetricKey; label: string; format: (value: number | null) => string; signed?: boolean };

const COLUMNS: Record<View, Column[]> = {
  operating: [
    { key: "revenueYoY", label: "Revenue YoY", format: fmt.pct, signed: true },
    { key: "operatingMargin", label: "Op. margin", format: fmt.pctPlain },
    { key: "marginChange", label: "Margin Δ YoY", format: fmt.pp, signed: true },
    { key: "freeCashFlow", label: "TTM FCF", format: fmt.usdM },
  ],
  valuation: [
    { key: "evToEbitda", label: "EV/EBITDA", format: fmt.x },
    { key: "historicalPercentile", label: "Hist. percentile", format: (v) => v === null ? "—" : `${(v * 100).toFixed(0)} / 100` },
    { key: "pe", label: "P/E (TTM)", format: fmt.x },
    { key: "roic", label: "ROIC (approx.)", format: fmt.pctPlain },
    { key: "relativeReturn6m", label: "6m excess vs SPY", format: fmt.pp, signed: true },
  ],
  risk: [
    { key: "leverage", label: "Net debt / EBITDA", format: (v) => v === null ? "n/m" : fmt.x(v) },
    { key: "fuelShare", label: "Fuel / revenue", format: (v) => v === null ? "n/t" : fmt.pctPlain(v) },
    { key: "capexIntensity", label: "TTM capex / rev.", format: fmt.pctPlain },
    { key: "volatility1y", label: "1y volatility", format: fmt.pctPlain },
    { key: "maxDrawdown1y", label: "1y max drawdown", format: fmt.pctPlain },
  ],
};

const VIEWS: Array<{ id: View; label: string; question: string }> = [
  { id: "operating", label: "Operating performance", question: "Is revenue growth converting into margin and cash flow?" },
  { id: "valuation", label: "Valuation & returns", question: "How much does the market pay for the reported fundamentals?" },
  { id: "risk", label: "Balance sheet & risk", question: "Where are the capital, fuel and market-risk exposures?" },
];

export default function CompanyComparison({ projectId, companies, commonQuarter }: { projectId: string; companies: CompanyComparisonRow[]; commonQuarter?: { label: string; companies: CompanyComparisonRow[] } }) {
  const [view, setView] = useState<View>("operating");
  const [period, setPeriod] = useState<"common" | "latest">(commonQuarter ? "common" : "latest");
  const [model, setModel] = useState("all");
  const [focusOnly, setFocusOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("ticker");
  const [descending, setDescending] = useState(false);
  const columns = COLUMNS[view];
  const matched = view === "operating" && period === "common" && commonQuarter;
  const sourceRows = matched ? matched.companies : companies;
  const models = Array.from(new Set(companies.map((c) => c.businessModel))).sort();
  const rows = sourceRows
    .filter((c) => (model === "all" || c.businessModel === model) && (!focusOnly || c.focus))
    .sort((a, b) => {
      if (sort === "ticker") return (descending ? -1 : 1) * a.ticker.localeCompare(b.ticker);
      const av = a.metrics[sort];
      const bv = b.metrics[sort];
      // Missing values stay last in either direction; ties remain deterministic.
      if (av === null) return bv === null ? a.ticker.localeCompare(b.ticker) : 1;
      if (bv === null) return -1;
      return (descending ? bv - av : av - bv) || a.ticker.localeCompare(b.ticker);
    });

  function selectView(next: View) {
    setView(next);
    setSort("ticker");
    setDescending(false);
  }

  function sortColumn(key: SortKey) {
    if (sort === key) setDescending(!descending);
    else { setSort(key); setDescending(key !== "ticker"); }
  }

  function metricValue(company: CompanyComparisonRow, column: Column) {
    const value = column.format(company.metrics[column.key]);
    const id = company.evidenceIds?.[column.key];
    return id ? <Link href={`/research/${projectId}/evidence?id=${encodeURIComponent(id)}`} className="underline decoration-current/25 underline-offset-4 hover:decoration-current" title={`Source evidence for ${company.quarter}`}>{value}</Link> : value;
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">Comparison view</legend>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => selectView(item.id)} className={`rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${view === item.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper text-ink-muted hover:border-accent/40"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="text-[14px] font-medium text-ink">{VIEWS.find((item) => item.id === view)?.question}</p>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-md border border-line bg-panel2 p-3">
        {view === "operating" && <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-muted">
          Reporting period
          <select value={period} onChange={(event) => setPeriod(event.target.value as "common" | "latest")} className="w-full max-w-[290px] rounded border border-line bg-paper px-2 py-2 text-[13px] text-ink">
            {commonQuarter && <option value="common">Common quarter · {commonQuarter.label}</option>}
            <option value="latest">Latest filed · periods may differ</option>
          </select>
        </label>}
        <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-muted">
          Business model
          <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full max-w-[250px] rounded border border-line bg-paper px-2 py-2 text-[13px] text-ink">
            <option value="all">All business models</option>
            {models.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-muted">
          Sort by
          <select value={sort} onChange={(event) => { setSort(event.target.value as SortKey); setDescending(event.target.value !== "ticker"); }} className="w-full max-w-[230px] rounded border border-line bg-paper px-2 py-2 text-[13px] text-ink">
            <option value="ticker">Company</option>
            {columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setDescending(!descending)} className="rounded border border-line bg-paper px-3 py-2 text-[13px] text-ink" aria-label={`Sort ${descending ? "ascending" : "descending"}`}>
          {sort === "ticker" ? descending ? "Z → A" : "A → Z" : descending ? "High → low" : "Low → high"}
        </button>
        <label className="flex min-h-[38px] items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={focusOnly} onChange={(event) => setFocusOnly(event.target.checked)} className="h-4 w-4 accent-accent" />
          Focus companies only
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-soft">
        <p role="status">Showing {rows.length} of {companies.length} companies{matched ? ` · common ${matched.label}` : " · latest filed"}</p>
        <p className="hidden md:block">Select a column heading to sort · company column stays visible</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-5 text-[14px] text-ink-muted">
          <p>No companies match these filters.</p>
          <button type="button" onClick={() => { setModel("all"); setFocusOnly(false); }} className="mt-2 font-medium text-accent hover:underline">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-md border border-line md:block" role="region" aria-label={`${view} company comparison, horizontally scrollable`} tabIndex={0}>
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <caption className="sr-only">{VIEWS.find((item) => item.id === view)?.label}. {matched ? `All companies use common ${matched.label}, allowing 52/53-week period ends within 14 days.` : "Each row uses the company's latest filed quarter; periods can differ."}</caption>
              <thead className="bg-panel2 text-[12px] text-ink-muted">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-[180px] border-r border-line bg-panel2 px-3 py-3" aria-sort={sort === "ticker" ? descending ? "descending" : "ascending" : "none"}>
                    <button type="button" onClick={() => sortColumn("ticker")} className="font-semibold">Company {sort === "ticker" ? descending ? "↓" : "↑" : "↕"}</button>
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3">{matched ? "Common quarter" : "Latest quarter"}</th>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className="px-3 py-3 text-right" aria-sort={sort === column.key ? descending ? "descending" : "ascending" : "none"}>
                      <button type="button" onClick={() => sortColumn(column.key)} className="font-semibold">{column.label} {sort === column.key ? descending ? "↓" : "↑" : "↕"}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((company) => (
                  <tr key={company.ticker} className="table-row">
                    <th scope="row" className="sticky left-0 z-10 border-r border-line bg-paper px-3 py-3 font-normal">
                      <Link href={`/research/${projectId}/companies/${company.ticker}`} className="font-semibold text-accent hover:underline">{company.ticker}</Link>
                      {company.focus && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">focus</span>}
                      <div className="mt-0.5 max-w-[180px] text-[11px] text-ink-soft">{company.businessModel}</div>
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{company.quarter ?? "—"}<span className="mt-0.5 block text-[10.5px] text-ink-soft">TTM to {company.ttmQuarter ?? "n/a"}</span></td>
                    {columns.map((column) => <td key={column.key} className={`num whitespace-nowrap px-3 py-3 text-right ${column.signed ? textTone(company.metrics[column.key]) : "text-ink"}`}>{metricValue(company, column)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden" aria-label="Company comparison cards">
            {rows.map((company) => (
              <li key={company.ticker} className="rounded-md border border-line bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/research/${projectId}/companies/${company.ticker}`} className="font-semibold text-accent hover:underline">{company.ticker} <span className="font-normal text-ink">· {company.name}</span></Link>
                  {company.focus && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">focus</span>}
                </div>
                <p className="mt-1 text-[12px] text-ink-soft">{company.businessModel}</p>
                <p className="mt-1 text-[12px] text-ink-muted">{matched ? "Common" : "Latest"} {company.quarter ?? "unavailable"} · TTM to {company.ttmQuarter ?? "n/a"}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {columns.map((column) => <div key={column.key}><dt className="text-[12px] text-ink-soft">{column.label}</dt><dd className={`num mt-0.5 text-[15px] font-semibold ${column.signed ? textTone(company.metrics[column.key]) : "text-ink"}`}>{metricValue(company, column)}</dd></div>)}
                </dl>
                <Link href={`/research/${projectId}/companies/${company.ticker}`} className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">Read company research →</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="space-y-1.5 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted">
        <p><strong className="font-medium text-ink">Comparability:</strong> {matched ? `Operating results use common ${matched.label} across the full coverage universe, with quarter ends within 14 days. Filters preserve that period. Underlined figures link to that quarter's evidence.` : "Rows use each company's latest filed quarter, so Q2 and Q3 may appear together. Use the operating view's common-quarter mode for peer comparisons."} FCF, capex intensity, leverage and ROIC use trailing twelve months.</p>
        {view !== "operating" && <p>Valuation and market-risk views use the latest available fundamentals and the dated price snapshot; the operating-view quarter selection does not change these views.</p>}
        {view === "valuation" && <p>Historical percentile compares EV/EBITDA with that company&apos;s own month-end history. A high percentile means a higher multiple relative to its past, not a forecast or a quality score. ROIC is approximate: TTM operating income × (1 − tax) ÷ (debt + equity − cash); goodwill-heavy balance sheets depress it.</p>}
        {view === "risk" && <p>n/t = no matching fuel tag in XBRL; brokers report purchased transportation instead. Leverage is n/m when EBITDA is zero, negative or unavailable. Negative leverage indicates net cash.</p>}
        <p>n/m = not meaningful or unavailable. Figures are company-reported or calculated from the dated research snapshot; sorting does not imply an investment ranking.</p>
      </div>
    </div>
  );
}
