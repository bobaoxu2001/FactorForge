#!/usr/bin/env node
/**
 * Build the committed, provenance-tagged research snapshot for a research
 * project (currently: U.S. freight). Network-free CI and the public demo read
 * these files; nothing in them is synthetic.
 *
 * Sources (all public, all attributable):
 *   - FRED series CSV + series metadata page (units, frequency, source agency,
 *     release, last-updated timestamp, licence). Series whose FRED licence says
 *     "pre-approval required" are NOT redistributed — they are recorded as
 *     excluded with the reason.
 *   - SEC EDGAR XBRL companyfacts (reported financial statement facts with
 *     accession number + filing date → point-in-time) and submissions (filing
 *     index: 10-K / 10-Q / 8-K Item 2.02 earnings releases).
 *   - The latest 10-K primary document per company, from which short business-
 *     description excerpts are extracted with an approximate Item location, so
 *     value-chain relationships can cite a real sentence instead of a summary.
 *   - Yahoo Finance chart API daily OHLCV + split events (prices, valuation).
 *
 * SEC fair-access policy requires a descriptive User-Agent with a contact
 * address. Supply it via SEC_EDGAR_USER_AGENT ("Org Name contact@example.com").
 * The value is never written to the output files.
 *
 * Run:
 *   SEC_EDGAR_USER_AGENT="FactorForge research you@example.com" npm run research:refresh
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ID = "freight";
const OUT_DIR = path.join(process.cwd(), "src", "__fixtures__", "research", PROJECT_ID);
const OBS_START = "2015-01-01";
const FACT_START = "2018-01-01";
const FILINGS_START = "2021-01-01";

const SEC_UA = process.env.SEC_EDGAR_USER_AGENT?.trim();
if (!SEC_UA || !/@/.test(SEC_UA)) {
  console.error(
    "[research] SEC_EDGAR_USER_AGENT must be set to a descriptive User-Agent with a contact email " +
      '(e.g. "FactorForge research you@example.com"). SEC rejects anonymous requests.',
  );
  process.exit(1);
}

// Same proxy handling as scripts/build-fixture.mjs.
const proxyUrl = process.env.https_proxy ?? process.env.HTTPS_PROXY ?? null;
const dispatcher = proxyUrl ? new (await import("undici")).ProxyAgent(proxyUrl) : undefined;

/** Coverage universe. CIKs from https://www.sec.gov/files/company_tickers.json. */
const COMPANIES = [
  { ticker: "KNX", cik: 1492691 },
  { ticker: "JBHT", cik: 728535 },
  { ticker: "CHRW", cik: 1043277 },
  { ticker: "ODFL", cik: 878927 },
  { ticker: "SNDR", cik: 1692063 },
  { ticker: "WERN", cik: 793074 },
  { ticker: "LSTR", cik: 853816 },
];

/** FRED series. Metadata is scraped from the FRED series page, never hand-typed. */
const FRED_SERIES = [
  "TRUCKD11",
  "FRGSHPUSM649NCIS",
  "FRGEXPUSM649NCIS",
  "TSIFRGHT",
  "PCU484121484121",
  "PCU484122484122",
  "GASDESW",
  "CES4348400001",
  "RAILFRTCARLOADSD11",
  "IPMAN",
  "ISRATIO",
  "RSXFS",
];

const PRICE_SYMBOLS = [...COMPANIES.map((c) => c.ticker), "SPY", "IYT"];

/**
 * XBRL metrics → candidate us-gaap concepts. For each company ONE concept is
 * chosen per metric (the one with the most recent period; ties broken by list
 * order) and used for the whole history, so periods never silently mix line
 * items. The chosen concept is recorded next to the data.
 */
const METRICS = {
  revenue: { kind: "duration", unit: "USD", candidates: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax"] },
  operatingIncome: { kind: "duration", unit: "USD", candidates: ["OperatingIncomeLoss"] },
  netIncome: { kind: "duration", unit: "USD", candidates: ["NetIncomeLoss", "ProfitLoss"] },
  pretaxIncome: {
    kind: "duration",
    unit: "USD",
    candidates: [
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ],
  },
  incomeTax: { kind: "duration", unit: "USD", candidates: ["IncomeTaxExpenseBenefit"] },
  epsDiluted: { kind: "duration", unit: "USD/shares", candidates: ["EarningsPerShareDiluted"] },
  dilutedShares: { kind: "duration", unit: "shares", candidates: ["WeightedAverageNumberOfDilutedSharesOutstanding"] },
  depreciationAmortization: {
    kind: "duration",
    unit: "USD",
    candidates: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet", "Depreciation"],
  },
  fuelExpense: { kind: "duration", unit: "USD", candidates: ["FuelCosts"] },
  interestExpense: {
    kind: "duration",
    unit: "USD",
    candidates: ["InterestExpenseNonoperating", "InterestExpense", "InterestAndDebtExpense", "InterestExpenseDebt"],
  },
  operatingCashFlow: { kind: "duration", unit: "USD", candidates: ["NetCashProvidedByUsedInOperatingActivities"] },
  capex: {
    kind: "duration",
    unit: "USD",
    candidates: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PaymentsToAcquireMachineryAndEquipment"],
  },
  equipmentSaleProceeds: { kind: "duration", unit: "USD", candidates: ["ProceedsFromSaleOfPropertyPlantAndEquipment", "ProceedsFromSaleOfProductiveAssets"] },
  cash: { kind: "instant", unit: "USD", candidates: ["CashAndCashEquivalentsAtCarryingValue"] },
  totalAssets: { kind: "instant", unit: "USD", candidates: ["Assets"] },
  equity: { kind: "instant", unit: "USD", candidates: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"] },
  // Debt components are kept separately; src/lib/intel/financials.ts combines them
  // with an explicit, displayed rule (XBRL debt tagging differs across filers).
  debtCombined: { kind: "instant", unit: "USD", candidates: ["DebtLongtermAndShorttermCombinedAmount"] },
  longTermDebt: { kind: "instant", unit: "USD", candidates: ["LongTermDebt"] },
  longTermDebtNoncurrent: { kind: "instant", unit: "USD", candidates: ["LongTermDebtNoncurrent"] },
  longTermDebtCurrent: { kind: "instant", unit: "USD", candidates: ["LongTermDebtCurrent"] },
  convertibleDebt: { kind: "instant", unit: "USD", candidates: ["ConvertibleDebt"] },
  financeLease: { kind: "instant", unit: "USD", candidates: ["FinanceLeaseLiability"] },
  financeLeaseNoncurrent: { kind: "instant", unit: "USD", candidates: ["FinanceLeaseLiabilityNoncurrent"] },
  shortTermBorrowings: { kind: "instant", unit: "USD", candidates: ["ShortTermBorrowings", "CommercialPaper"] },
};

/** 10-K excerpt topics. Short sentences only; location is approximate (nearest preceding "Item" heading). */
const EXCERPT_TOPICS = {
  segments: /reportable segments?\b/i,
  nonAsset: /non-asset|asset-light|do not own (the )?(trucks|tractors|transportation equipment)/i,
  brokerage: /freight brokerage|truck brokerage|brokerage (services|operations|business)|third-party (transportation )?capacity/i,
  intermodal: /\bintermodal\b/i,
  rail: /\bBNSF\b|Burlington Northern|Union Pacific|Norfolk Southern|rail carriers?|railroads?\b/i,
  fuelSurcharge: /fuel surcharge/i,
  customerConcentration: /largest customer|top (ten|10|five|5|twenty|20) customers|accounted for (approximately )?\d+(\.\d+)?% of (our )?(total |consolidated )?(operating )?revenue/i,
  drivers: /driver (shortage|recruit|retention|turnover|pay|wages)|qualified (professional )?drivers/i,
  ownerOperators: /owner-operators?|independent contractors?|business capacity owners?/i,
  cyclicality: /cyclical|freight (market|environment|recession|cycle)|excess capacity|capacity (exceeds|exceeded|exiting|attrition)|soft freight/i,
  spotContract: /spot (market|rates?)|contractual (rates?|pricing)|contract rates?/i,
  ltl: /less-than-truckload/i,
  purchasedTransportation: /purchased transportation/i,
};
const MAX_EXCERPTS_PER_TOPIC = 2;
const MAX_EXCERPT_CHARS = 320;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retrievedAt = new Date().toISOString();

async function get(url, { headers = {}, as = "text" } = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers, dispatcher });
    if (response.ok) return as === "json" ? response.json() : response.text();
    if (response.status === 429 || response.status >= 500) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    throw new Error(`${url} → HTTP ${response.status}`);
  }
  throw new Error(`${url} → retries exhausted`);
}

const secGet = async (url, as = "json") => {
  // SEC fair access: ≤10 req/s. Stay well under it.
  await sleep(220);
  return get(url, { headers: { "user-agent": SEC_UA, "accept-encoding": "gzip, deflate" }, as });
};

// ── FRED ────────────────────────────────────────────────────────────────────

function decodeEntities(text) {
  return text
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

const FRED_LABELS = ["Units:", "Frequency:", "Source:", "Release:", "Notes:", "Updated:", "Next Release Date:", "Suggested Citation:", "Observation:", "Observations", "Fullscreen", "Share Graph"];

function fredField(text, label) {
  const start = text.indexOf(label);
  if (start < 0) return null;
  let value = text.slice(start + label.length, start + label.length + 900);
  let cut = value.length;
  for (const other of FRED_LABELS) {
    if (other === label) continue;
    const at = value.indexOf(other);
    if (at >= 0 && at < cut) cut = at;
  }
  value = value.slice(0, cut).trim();
  return value.length > 0 ? value : null;
}

function parseFredPage(html) {
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let ldJson = {};
  try {
    ldJson = ld ? JSON.parse(ld[1]) : {};
  } catch {
    ldJson = {};
  }
  const text = htmlToText(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " "));
  const unitsRaw = fredField(text, "Units:");
  const [units, seasonalAdjustment] = (unitsRaw ?? "").split(/\s*,\s*(?=(Not )?Seasonally|Seasonally)/).filter(Boolean);
  const notes = fredField(text, "Notes:");
  const licenseLabel =
    text.match(/(Public Domain: Citation Requested|Copyrighted: Citation Required|Copyrighted: Pre-Approval Required|Copyrighted: Pre-approval required)/i)?.[1] ??
    null;
  return {
    title: typeof ldJson.name === "string" ? ldJson.name : text.match(/^(.*?)\s*\|\s*FRED/)?.[1] ?? null,
    units: units?.trim() ?? null,
    seasonalAdjustment: unitsRaw?.match(/(Not Seasonally Adjusted|Seasonally Adjusted Annual Rate|Seasonally Adjusted)/i)?.[1] ?? seasonalAdjustment ?? null,
    frequency: fredField(text, "Frequency:"),
    source: fredField(text, "Source:"),
    release: fredField(text, "Release:"),
    updated: fredField(text, "Updated:"),
    nextRelease: fredField(text, "Next Release Date:"),
    notes: notes ? notes.slice(0, 600) : null,
    licenseUrl: typeof ldJson.license === "string" ? ldJson.license : null,
    licenseLabel,
    dateModified: typeof ldJson.dateModified === "string" ? ldJson.dateModified : null,
  };
}

async function fetchFredSeries(id) {
  const pageUrl = `https://fred.stlouisfed.org/series/${id}`;
  const csvUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
  const meta = parseFredPage(await get(pageUrl));
  const preApproval = /pre-approval/i.test(meta.licenseLabel ?? "");
  if (preApproval) {
    return { id, url: pageUrl, csvUrl, retrievedAt, ...meta, excluded: "FRED licence requires pre-approval from the copyright holder; not redistributed.", observations: [] };
  }
  const csv = await get(csvUrl);
  const observations = csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","))
    .filter(([date, value]) => date >= OBS_START && value !== "" && value !== "." && Number.isFinite(Number(value)))
    .map(([date, value]) => [date, Number(value)]);
  if (observations.length < 12) throw new Error(`${id}: only ${observations.length} observations`);
  return { id, url: pageUrl, csvUrl, retrievedAt, ...meta, excluded: null, observations };
}

// ── SEC EDGAR ───────────────────────────────────────────────────────────────

const pad = (cik) => String(cik).padStart(10, "0");

/**
 * Pick the candidate with the best recent coverage: most distinct period ends in
 * the last three years (so a concept filed only in 10-Ks loses to one filed
 * every quarter), then the most recent period, then list order.
 */
function chooseConcept(usGaap, candidates, unit) {
  const cutoff = `${new Date().getUTCFullYear() - 3}-01-01`;
  let best = null;
  candidates.forEach((concept, order) => {
    const facts = usGaap[concept]?.units?.[unit];
    if (!facts || facts.length === 0) return;
    const latest = facts.reduce((max, fact) => (fact.end > max ? fact.end : max), "");
    const coverage = new Set(facts.filter((f) => f.end >= cutoff).map((f) => f.end)).size;
    const better =
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage && latest > best.latest) ||
      (coverage === best.coverage && latest === best.latest && order < best.order);
    if (better) best = { concept, latest, coverage, order, facts, label: usGaap[concept].label ?? concept };
  });
  return best;
}

/**
 * Collapse every reported fact into one row per period with the value as
 * FIRST reported (point-in-time) and as LATEST reported (restatements). Facts
 * from 10-K/10-Q/8-K and their amendments are kept; others are ignored.
 */
function collapseFacts(facts, kind) {
  const byPeriod = new Map();
  for (const fact of facts) {
    if (fact.end < FACT_START) continue;
    if (!/^(10-K|10-Q|10-KT|10-QT|8-K)(\/A)?$/.test(fact.form ?? "")) continue;
    if (kind === "duration" && !fact.start) continue;
    const key = kind === "duration" ? `${fact.start}|${fact.end}` : fact.end;
    const row = byPeriod.get(key) ?? [];
    row.push(fact);
    byPeriod.set(key, row);
  }
  return [...byPeriod.values()]
    .map((rows) => {
      rows.sort((a, b) => a.filed.localeCompare(b.filed) || a.accn.localeCompare(b.accn));
      const first = rows[0];
      const latest = rows[rows.length - 1];
      return {
        start: first.start ?? null,
        end: first.end,
        value: first.val,
        filed: first.filed,
        form: first.form,
        accn: first.accn,
        fy: first.fy ?? null,
        fp: first.fp ?? null,
        latestValue: latest.val,
        latestFiled: latest.filed,
        latestAccn: latest.accn,
      };
    })
    .sort((a, b) => a.end.localeCompare(b.end) || (a.start ?? "").localeCompare(b.start ?? ""));
}

function buildFilingIndex(cik, submissions) {
  const recent = submissions.filings?.recent ?? {};
  const out = [];
  const n = recent.accessionNumber?.length ?? 0;
  for (let i = 0; i < n; i += 1) {
    const form = recent.form[i];
    const filed = recent.filingDate[i];
    if (filed < FILINGS_START) continue;
    const items = recent.items?.[i] ?? "";
    const isEarnings8K = form === "8-K" && /\b2\.02\b/.test(items);
    if (!["10-K", "10-Q", "10-K/A", "10-Q/A"].includes(form) && !isEarnings8K) continue;
    const accession = recent.accessionNumber[i];
    const doc = recent.primaryDocument[i];
    out.push({
      form,
      filed,
      reportDate: recent.reportDate[i] || null,
      accession,
      items: items || null,
      kind: isEarnings8K ? "earnings-release" : form.startsWith("10-K") ? "annual-report" : "quarterly-report",
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/${doc}`,
      indexUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/`,
    });
  }
  return out.sort((a, b) => b.filed.localeCompare(a.filed));
}

function extractExcerpts(html) {
  const cleaned = html
    .replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, " \n ");
  const text = htmlToText(cleaned);
  const skip = Math.floor(text.length * 0.02); // cover page + table of contents
  const body = text.slice(skip);
  // Only real item headings ("Item 1A. Risk Factors"), not cross-references ("see Item 8").
  const headings = [
    ...body.matchAll(
      /\bITEM\s*(1A|1B|1C|1|2|3|5|6|7A|7|8)\s*[.:\u2014-]?\s*(Business|Risk Factors|Unresolved Staff Comments|Cybersecurity|Properties|Legal Proceedings|Market for|\[?Reserved\]?|Management['\u2019]s Discussion|Quantitative and Qualitative|Financial Statements)/gi,
    ),
  ].map((m) => ({ at: m.index ?? 0, item: m[1].toUpperCase() }));
  const sectionAt = (index) => {
    let current = null;
    for (const h of headings) {
      if (h.at > index) break;
      current = h.item;
    }
    return current ? `Item ${current}` : "unlabelled section";
  };
  // Protect abbreviation periods ("Inc.", "U.S.", "e.g.") so they do not end a sentence.
  const DOT = "\u2024";
  const protectedBody = body
    .replace(/\b(Inc|Corp|Co|Ltd|No|Nos|vs|etc|approx|Jan|Feb|Mar|Apr|Aug|Sept|Sep|Oct|Nov|Dec)\./g, `$1${DOT}`)
    .replace(/\b([A-Z])\.(?=[A-Z]\.)/g, `$1${DOT}`)
    .replace(/\b([A-Z]\u2024[A-Z])\.(?=\s+[a-z(])/g, `$1${DOT}`)
    .replace(/\b(e\.g|i\.e)\./g, (m) => m.replaceAll(".", DOT));
  const sentences = [];
  const re = /[^.!?]{40,}?[.!?](?=\s+[A-Z(“"]|\s*$)/g;
  let match;
  while ((match = re.exec(protectedBody)) !== null) {
    sentences.push({ text: match[0].trim().replaceAll(DOT, "."), at: match.index });
  }
  const excerpts = [];
  for (const [topic, pattern] of Object.entries(EXCERPT_TOPICS)) {
    let taken = 0;
    for (const sentence of sentences) {
      if (taken >= MAX_EXCERPTS_PER_TOPIC) break;
      if (sentence.text.length > MAX_EXCERPT_CHARS || sentence.text.length < 60) continue;
      if (!pattern.test(sentence.text)) continue;
      if (/forward-looking|table of contents|\|/i.test(sentence.text)) continue;
      excerpts.push({ topic, text: sentence.text, section: sectionAt(sentence.at) });
      taken += 1;
    }
  }
  return excerpts;
}

async function fetchCompany({ ticker, cik }) {
  const facts = await secGet(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`);
  const submissions = await secGet(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`);
  const usGaap = facts.facts?.["us-gaap"] ?? {};
  const metrics = {};
  for (const [key, spec] of Object.entries(METRICS)) {
    const chosen = chooseConcept(usGaap, spec.candidates, spec.unit);
    metrics[key] = chosen
      ? { concept: chosen.concept, label: chosen.label, unit: spec.unit, kind: spec.kind, points: collapseFacts(chosen.facts, spec.kind) }
      : { concept: null, label: null, unit: spec.unit, kind: spec.kind, points: [] };
  }
  const deiShares = facts.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [];
  metrics.sharesOutstandingCover = {
    concept: "dei:EntityCommonStockSharesOutstanding",
    label: "Shares outstanding (filing cover page)",
    unit: "shares",
    kind: "instant",
    points: collapseFacts(deiShares, "instant"),
  };
  const filings = buildFilingIndex(cik, submissions);
  const latest10K = filings.find((f) => f.form === "10-K");
  let annualReport = null;
  if (latest10K) {
    const html = await secGet(latest10K.url, "text");
    annualReport = { form: latest10K.form, filed: latest10K.filed, reportDate: latest10K.reportDate, url: latest10K.url, accession: latest10K.accession, excerpts: extractExcerpts(html) };
  }
  return {
    ticker,
    cik,
    name: submissions.name ?? facts.entityName,
    sic: submissions.sic ?? null,
    sicDescription: submissions.sicDescription ?? null,
    fiscalYearEnd: submissions.fiscalYearEnd ?? null,
    exchanges: submissions.exchanges ?? [],
    retrievedAt,
    sources: {
      companyFacts: `https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`,
      submissions: `https://data.sec.gov/submissions/CIK${pad(cik)}.json`,
      browse: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${pad(cik)}&type=10-&dateb=&owner=include&count=40`,
    },
    metrics,
    filings,
    annualReport,
  };
}

// ── Prices ──────────────────────────────────────────────────────────────────

async function fetchPrices(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const payload = await get(url, { headers: { "user-agent": "factorforge-research-snapshot/0.1" }, as: "json" });
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const adj = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const ts = result?.timestamp ?? [];
  if (!result || !quote || ts.length === 0) throw new Error(`${symbol}: empty chart`);
  const round = (value) => Number(value.toFixed(4));
  const rows = [];
  ts.forEach((t, i) => {
    const values = [quote.open?.[i], quote.high?.[i], quote.low?.[i], quote.close?.[i], adj[i], quote.volume?.[i]];
    if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) return;
    const [open, high, low, close, adjclose, volume] = values;
    rows.push([new Date(t * 1000).toISOString().slice(0, 10), round(open), round(high), round(low), round(close), round(adjclose), volume]);
  });
  const splits = Object.values(result.events?.splits ?? {})
    .map((s) => ({ date: new Date(s.date * 1000).toISOString().slice(0, 10), numerator: s.numerator, denominator: s.denominator }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    symbol,
    provider: "Yahoo Finance chart API",
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history`,
    retrievedAt,
    note: "OHLC are split-adjusted (Yahoo convention); adjclose is split- and dividend-adjusted. Raw prices are reconstructed from split events.",
    columns: ["date", "open", "high", "low", "close", "adjclose", "volume"],
    splits,
    rows,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`[research] FRED: ${FRED_SERIES.length} series`);
  const series = [];
  for (const id of FRED_SERIES) {
    const s = await fetchFredSeries(id);
    console.log(`  ${id}: ${s.excluded ? `EXCLUDED (${s.licenseLabel})` : `${s.observations.length} obs → ${s.observations.at(-1)?.[0]}`} · ${s.licenseLabel ?? "licence n/a"}`);
    series.push(s);
    await sleep(250);
  }

  console.log(`[research] SEC EDGAR: ${COMPANIES.length} companies`);
  const companies = {};
  for (const company of COMPANIES) {
    const data = await fetchCompany(company);
    const rev = data.metrics.revenue;
    console.log(`  ${company.ticker}: revenue via ${rev.concept} (${rev.points.length} periods), ${data.filings.length} filings, ${data.annualReport?.excerpts.length ?? 0} 10-K excerpts`);
    companies[company.ticker] = data;
  }

  console.log(`[research] Yahoo prices: ${PRICE_SYMBOLS.length} symbols`);
  const prices = {};
  for (const symbol of PRICE_SYMBOLS) {
    prices[symbol] = await fetchPrices(symbol);
    console.log(`  ${symbol}: ${prices[symbol].rows.length} bars → ${prices[symbol].rows.at(-1)[0]} · splits ${prices[symbol].splits.length}`);
    await sleep(250);
  }

  const manifest = {
    projectId: PROJECT_ID,
    builtAt: retrievedAt,
    builder: "scripts/build-research-snapshot.mjs",
    secUserAgent: "supplied via SEC_EDGAR_USER_AGENT (not recorded)",
    counts: {
      fredSeries: series.filter((s) => !s.excluded).length,
      fredExcluded: series.filter((s) => s.excluded).length,
      companies: Object.keys(companies).length,
      priceSymbols: Object.keys(prices).length,
    },
  };

  const write = async (name, data) => {
    const file = path.join(OUT_DIR, name);
    const body = JSON.stringify(data) + "\n";
    await writeFile(file, body);
    console.log(`[research] wrote ${path.relative(process.cwd(), file)} (${(body.length / 1024).toFixed(0)} KB)`);
  };
  await write("manifest.json", manifest);
  await write("macro.json", { retrievedAt, series });
  await write("companies.json", { retrievedAt, companies });
  await write("prices.json", { retrievedAt, prices });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
