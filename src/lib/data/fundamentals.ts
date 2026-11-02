import { UNIVERSE } from "@/data/watchlist";
import fundamentalsFixture from "@/__fixtures__/fundamentals-snapshot.json";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("fundamentals");

/**
 * Valuation / quality fundamentals for the single-name universe.
 *
 * Two tiers, same philosophy as the price pipeline:
 *   1. Yahoo quoteSummary (keyless, cookie+crumb handshake) — live values.
 *   2. The committed snapshot fixture — real data fetched by a maintainer via
 *      `node scripts/build-fundamentals-fixture.mjs`, always labeled
 *      `source: "snapshot"` with its as-of date, never passed off as live.
 *
 * The whole live fan-out runs under a wait budget; any failure or timeout
 * degrades to the snapshot for the remaining names. ETFs are excluded — the
 * fields don't apply to index wrappers.
 */

export interface FundamentalMetrics {
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  evToEbitda: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  returnOnEquity: number | null;
  revenueGrowthYoY: number | null;
  earningsGrowthYoY: number | null;
  dividendYield: number | null;
  marketCap: number | null;
}

export interface FundamentalSnapshot extends FundamentalMetrics {
  symbol: string;
  /** Date the values were observed (YYYY-MM-DD). */
  asOf: string;
  source: "yahoo" | "snapshot";
}

export type FundamentalsMap = Record<string, FundamentalSnapshot>;

const STOCK_SYMBOLS = UNIVERSE.filter((c) => c.kind === "stock").map((c) => c.symbol);
const UA = { "user-agent": "factorforge/0.1" };
const DEFAULT_WAIT_MS = 4_000;
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface CachedFundamentals {
  expiresAt: number;
  promise: Promise<FundamentalsMap>;
}

const cacheKey = "__factorforgeFundamentalsCache";
const globalCache = globalThis as typeof globalThis & { __factorforgeFundamentalsCache?: CachedFundamentals };

function waitBudgetMs(): number {
  const raw = Number(process.env.FUNDAMENTALS_WAIT_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return DEFAULT_WAIT_MS;
}

/** The committed snapshot, labeled as such. Safe to call offline. */
export function getSnapshotFundamentals(): FundamentalsMap {
  const fixture = fundamentalsFixture as Record<string, Omit<FundamentalSnapshot, "source">>;
  return Object.fromEntries(
    Object.entries(fixture).map(([symbol, row]) => [symbol, { ...row, source: "snapshot" as const }]),
  );
}

export async function getUniverseFundamentals(): Promise<FundamentalsMap> {
  const now = Date.now();
  const cached = globalCache[cacheKey];
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetchUniverseFundamentals();
  globalCache[cacheKey] = { expiresAt: now + CACHE_MAX_AGE_MS, promise };
  return promise;
}

async function fetchUniverseFundamentals(): Promise<FundamentalsMap> {
  const waitMs = waitBudgetMs();
  if (waitMs === 0) return getSnapshotFundamentals();

  try {
    const live = await Promise.race([
      fetchLiveFundamentals(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
    ]);
    if (live && Object.keys(live).length === STOCK_SYMBOLS.length) {
      log.info("live fundamentals ok", { symbols: Object.keys(live).length });
      return live;
    }
    log.info("live fundamentals incomplete or over budget, using committed snapshot", {
      got: live ? Object.keys(live).length : 0,
    });
  } catch (error) {
    log.warn("live fundamentals failed, using committed snapshot", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return getSnapshotFundamentals();
}

async function fetchLiveFundamentals(): Promise<FundamentalsMap> {
  const session = await getCrumb();
  const out: FundamentalsMap = {};
  const limit = 6;
  let next = 0;
  async function runner(): Promise<void> {
    while (next < STOCK_SYMBOLS.length) {
      const symbol = STOCK_SYMBOLS[next++];
      out[symbol] = await fetchSymbolFundamentals(symbol, session);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, STOCK_SYMBOLS.length) }, () => runner()));
  return out;
}

interface CrumbSession {
  cookie: string;
  crumb: string;
}

async function getCrumb(): Promise<CrumbSession> {
  const cookieResponse = await fetch("https://fc.yahoo.com", {
    headers: UA,
    redirect: "manual",
    next: { revalidate: 3600 },
  });
  const setCookie =
    (cookieResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()[0] ??
    cookieResponse.headers.get("set-cookie") ??
    "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("Yahoo did not set a session cookie");

  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...UA, cookie },
    next: { revalidate: 3600 },
  });
  if (!crumbResponse.ok) throw new Error(`Yahoo crumb HTTP ${crumbResponse.status}`);
  const crumb = (await crumbResponse.text()).trim();
  if (!crumb || crumb.includes("<") || crumb.includes("{")) throw new Error("Yahoo crumb handshake failed");
  return { cookie, crumb };
}

interface YahooField {
  raw?: number;
}
interface QuoteSummaryPayload {
  quoteSummary?: {
    result?: Array<{
      summaryDetail?: Record<string, YahooField>;
      defaultKeyStatistics?: Record<string, YahooField>;
      financialData?: Record<string, YahooField>;
    }>;
    error?: { description?: string } | null;
  };
}

const rawOf = (field: YahooField | undefined): number | null =>
  typeof field?.raw === "number" && Number.isFinite(field.raw) ? field.raw : null;

/** Exposed for tests: normalize one quoteSummary payload into a snapshot. */
export function parseQuoteSummary(symbol: string, payload: QuoteSummaryPayload): FundamentalSnapshot {
  const result = payload.quoteSummary?.result?.[0];
  if (!result) {
    throw new Error(payload.quoteSummary?.error?.description ?? `quoteSummary empty for ${symbol}`);
  }
  const summary = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const fin = result.financialData ?? {};
  return {
    symbol,
    asOf: new Date().toISOString().slice(0, 10),
    source: "yahoo",
    trailingPE: rawOf(summary.trailingPE),
    forwardPE: rawOf(summary.forwardPE) ?? rawOf(stats.forwardPE),
    priceToBook: rawOf(stats.priceToBook),
    evToEbitda: rawOf(stats.enterpriseToEbitda),
    profitMargin: rawOf(fin.profitMargins) ?? rawOf(stats.profitMargins),
    operatingMargin: rawOf(fin.operatingMargins),
    returnOnEquity: rawOf(fin.returnOnEquity),
    revenueGrowthYoY: rawOf(fin.revenueGrowth),
    earningsGrowthYoY: rawOf(fin.earningsGrowth),
    dividendYield: rawOf(summary.dividendYield),
    marketCap: rawOf(summary.marketCap),
  };
}

async function fetchSymbolFundamentals(symbol: string, session: CrumbSession): Promise<FundamentalSnapshot> {
  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=summaryDetail,defaultKeyStatistics,financialData&crumb=${encodeURIComponent(session.crumb)}`;
  const response = await fetch(url, { headers: { ...UA, cookie: session.cookie }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`quoteSummary HTTP ${response.status} for ${symbol}`);
  const payload = (await response.json()) as QuoteSummaryPayload;
  return parseQuoteSummary(symbol, payload);
}
