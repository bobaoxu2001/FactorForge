#!/usr/bin/env node
/**
 * Build a deterministic, network-free fundamentals snapshot fixture.
 *
 * Fetches valuation/quality fundamentals for every single-name stock in the
 * research universe from the Yahoo quoteSummary API (keyless, cookie+crumb
 * handshake) and writes the normalized map to
 * src/__fixtures__/fundamentals-snapshot.json.
 *
 * The committed fixture is the honest fallback tier for /picks value/quality
 * scores when the live endpoint is slow or unavailable — always labeled as a
 * snapshot with its as-of date, never passed off as live data.
 *
 * SYMBOL LIST: plain .mjs copy of the stock (non-ETF) universe, guarded by
 * fundamentals.test.ts against drift from src/data/watchlist.ts.
 *
 * Run:
 *   node scripts/build-fundamentals-fixture.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Yahoo geo-blocks some endpoints by IP; honor the shell's proxy settings the
// way curl does (Node fetch ignores HTTP(S)_PROXY by default). undici is a
// transitive dependency, so import it lazily and only when a proxy is set —
// proxy-less environments (CI runners) never need it.
const proxyUrl = process.env.https_proxy ?? process.env.HTTPS_PROXY ?? null;
const dispatcher = proxyUrl ? new (await import("undici")).ProxyAgent(proxyUrl) : undefined;

// Keep in sync with UNIVERSE stocks in src/data/watchlist.ts (guarded by fundamentals.test.ts).
const STOCK_SYMBOLS = [
  "AAPL", "MSFT", "NVDA",
  "GOOGL", "META",
  "AMZN", "TSLA", "HD", "MCD",
  "PG", "KO", "WMT",
  "JPM", "BAC", "V",
  "JNJ", "UNH", "PFE",
  "XOM", "CVX",
  "CAT", "HON", "ETN", "VRT",
  "NEE", "DUK",
  "AMT", "O",
];

const UA = { "user-agent": "Mozilla/5.0 (factorforge fixture builder)" };

async function getCrumb() {
  const cookieResponse = await fetch("https://fc.yahoo.com", { headers: UA, redirect: "manual", dispatcher });
  const cookie = (cookieResponse.headers.getSetCookie?.()[0] ?? cookieResponse.headers.get("set-cookie"))?.split(";")[0];
  if (!cookie) throw new Error("Yahoo did not set a session cookie");
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...UA, cookie },
    dispatcher,
  });
  const crumb = (await crumbResponse.text()).trim();
  if (!crumb || crumb.includes("{")) throw new Error("Yahoo crumb handshake failed");
  return { cookie, crumb };
}

const raw = (field) => (typeof field?.raw === "number" && Number.isFinite(field.raw) ? field.raw : null);

async function fetchFundamentals(symbol, { cookie, crumb }) {
  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=summaryDetail,defaultKeyStatistics,financialData&crumb=${encodeURIComponent(crumb)}`;
  const response = await fetch(url, { headers: { ...UA, cookie }, dispatcher });
  if (!response.ok) throw new Error(`quoteSummary HTTP ${response.status} for ${symbol}`);
  const payload = await response.json();
  const result = payload?.quoteSummary?.result?.[0];
  if (!result) throw new Error(`quoteSummary empty for ${symbol}`);
  const summary = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const fin = result.financialData ?? {};
  return {
    symbol,
    asOf: new Date().toISOString().slice(0, 10),
    trailingPE: raw(summary.trailingPE),
    forwardPE: raw(summary.forwardPE) ?? raw(stats.forwardPE),
    priceToBook: raw(stats.priceToBook),
    evToEbitda: raw(stats.enterpriseToEbitda),
    profitMargin: raw(fin.profitMargins) ?? raw(stats.profitMargins),
    operatingMargin: raw(fin.operatingMargins),
    returnOnEquity: raw(fin.returnOnEquity),
    revenueGrowthYoY: raw(fin.revenueGrowth),
    earningsGrowthYoY: raw(fin.earningsGrowth),
    dividendYield: raw(summary.dividendYield),
    marketCap: raw(summary.marketCap),
  };
}

async function main() {
  const session = await getCrumb();
  const out = {};
  for (const symbol of STOCK_SYMBOLS) {
    process.stdout.write(`${symbol}... `);
    out[symbol] = await fetchFundamentals(symbol, session);
    process.stdout.write("ok\n");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const target = path.join(process.cwd(), "src", "__fixtures__", "fundamentals-snapshot.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${STOCK_SYMBOLS.length} symbols to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
