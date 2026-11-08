#!/usr/bin/env node
/**
 * Build the market snapshot used by the event-intelligence engine.
 *
 * Writes three files under src/__fixtures__/events/:
 *   prices.json        daily close, adjusted close and volume (3 years)
 *   fundamentals.json  vendor valuation/balance-sheet fields for equities
 *   manifest.json      run log: when, which symbols succeeded, failed or were
 *                      carried over from the previous run, and why
 *
 * Sources: Yahoo Finance chart API (prices) and quoteSummary (fundamentals),
 * both keyless. The instrument list is src/data/events/instruments.json, the
 * same file the app reads, so the two cannot drift.
 *
 * Failure handling: a symbol that fails keeps its previous rows, is marked
 * "carried-over" in the manifest, and the app labels it stale. The run exits
 * non-zero only when a benchmark (SPY, QQQ, ^IXIC, BTC-USD) cannot be priced,
 * because every abnormal-return calculation depends on those.
 *
 * Incomplete bars are dropped: crypto rows dated today (UTC) and equity rows
 * dated today in the exchange time zone before that session has closed.
 *
 * Run:
 *   npm run events:refresh
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Honour the shell proxy the way curl does (see build-fundamentals-fixture.mjs).
const proxyUrl = process.env.https_proxy ?? process.env.HTTPS_PROXY ?? null;
const dispatcher = proxyUrl ? new (await import("undici")).ProxyAgent(proxyUrl) : undefined;

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "src", "__fixtures__", "events");
const CONFIG = path.join(ROOT, "src", "data", "events", "instruments.json");
const RANGE = "3y";
const REQUIRED = new Set(["SPY", "QQQ", "^IXIC", "BTC-USD"]);
const UA = { "user-agent": "Mozilla/5.0 (factorforge event snapshot)" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Number(value.toFixed(4));

function localDate(epochSeconds, timeZone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(epochSeconds * 1000));
}

async function fetchChart(symbol, now) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${RANGE}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, { headers: UA, dispatcher });
  if (!response.ok) throw new Error(`chart HTTP ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const adj = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const ts = result?.timestamp ?? [];
  if (!result || !quote || ts.length === 0) throw new Error("empty chart");
  const timeZone = result.meta?.exchangeTimezoneName ?? "UTC";
  const sessionEnd = result.meta?.currentTradingPeriod?.regular?.end ?? null;
  const today = localDate(Math.floor(now.getTime() / 1000), timeZone);
  const sessionOpen = sessionEnd !== null && now.getTime() / 1000 < sessionEnd;
  const isCrypto = result.meta?.instrumentType === "CRYPTOCURRENCY";

  const rows = [];
  let missing = 0;
  ts.forEach((t, i) => {
    const date = localDate(t, timeZone);
    if (date === today && (isCrypto || sessionOpen)) return; // incomplete bar
    const close = quote.close?.[i];
    const adjclose = adj[i] ?? close;
    const volume = quote.volume?.[i] ?? 0;
    if (typeof close !== "number" || !Number.isFinite(close) || typeof adjclose !== "number") {
      missing += 1;
      return;
    }
    rows.push([date, round(close), round(adjclose), volume]);
  });
  return {
    symbol,
    provider: "Yahoo Finance chart API",
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history`,
    timeZone,
    instrumentType: result.meta?.instrumentType ?? null,
    currency: result.meta?.currency ?? null,
    columns: ["date", "close", "adjclose", "volume"],
    missingCloses: missing,
    rows,
  };
}

async function getCrumb() {
  const cookieResponse = await fetch("https://fc.yahoo.com", { headers: UA, redirect: "manual", dispatcher });
  const cookie = (cookieResponse.headers.getSetCookie?.()[0] ?? cookieResponse.headers.get("set-cookie"))?.split(";")[0];
  if (!cookie) throw new Error("Yahoo did not set a session cookie");
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { ...UA, cookie }, dispatcher });
  const crumb = (await crumbResponse.text()).trim();
  if (!crumb || crumb.includes("{")) throw new Error("Yahoo crumb handshake failed");
  return { cookie, crumb };
}

const raw = (field) => (typeof field?.raw === "number" && Number.isFinite(field.raw) ? field.raw : null);

async function fetchFundamentals(symbol, { cookie, crumb }, asOf) {
  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=summaryDetail,defaultKeyStatistics,financialData&crumb=${encodeURIComponent(crumb)}`;
  const response = await fetch(url, { headers: { ...UA, cookie }, dispatcher });
  if (!response.ok) throw new Error(`quoteSummary HTTP ${response.status}`);
  const result = (await response.json())?.quoteSummary?.result?.[0];
  if (!result) throw new Error("quoteSummary empty");
  const summary = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const fin = result.financialData ?? {};
  return {
    symbol,
    asOf,
    trailingPE: raw(summary.trailingPE),
    forwardPE: raw(summary.forwardPE) ?? raw(stats.forwardPE),
    evToRevenue: raw(stats.enterpriseToRevenue),
    evToEbitda: raw(stats.enterpriseToEbitda),
    revenueGrowthYoY: raw(fin.revenueGrowth),
    operatingMargin: raw(fin.operatingMargins),
    totalDebt: raw(fin.totalDebt),
    totalCash: raw(fin.totalCash),
    marketCap: raw(summary.marketCap),
  };
}

async function readPrevious(file) {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, file), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const now = new Date();
  const builtAt = now.toISOString();
  const { instruments } = JSON.parse(await readFile(CONFIG, "utf8"));
  const previousPrices = (await readPrevious("prices.json"))?.prices ?? {};
  const previousFundamentals = (await readPrevious("fundamentals.json"))?.fundamentals ?? {};
  await mkdir(OUT_DIR, { recursive: true });

  const prices = {};
  const runLog = [];
  for (const { symbol } of instruments) {
    try {
      const series = await fetchChart(symbol, now);
      prices[symbol] = { ...series, retrievedAt: builtAt };
      runLog.push({ symbol, step: "prices", status: "ok", rows: series.rows.length, first: series.rows[0]?.[0] ?? null, last: series.rows.at(-1)?.[0] ?? null, missingCloses: series.missingCloses });
      console.log(`  ${symbol.padEnd(8)} ${series.rows.length} rows → ${series.rows.at(-1)?.[0]}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (previousPrices[symbol]) {
        prices[symbol] = previousPrices[symbol];
        runLog.push({ symbol, step: "prices", status: "carried-over", error: message, last: previousPrices[symbol].rows.at(-1)?.[0] ?? null });
      } else {
        runLog.push({ symbol, step: "prices", status: "failed", error: message });
      }
      console.warn(`  ${symbol.padEnd(8)} FAILED: ${message}`);
    }
    await sleep(200);
  }

  const fundamentals = {};
  const equities = instruments.filter((i) => i.kind === "equity").map((i) => i.symbol);
  try {
    const session = await getCrumb();
    for (const symbol of equities) {
      try {
        fundamentals[symbol] = await fetchFundamentals(symbol, session, builtAt.slice(0, 10));
        runLog.push({ symbol, step: "fundamentals", status: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (previousFundamentals[symbol]) fundamentals[symbol] = previousFundamentals[symbol];
        runLog.push({ symbol, step: "fundamentals", status: previousFundamentals[symbol] ? "carried-over" : "failed", error: message });
      }
      await sleep(200);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const symbol of equities) {
      if (previousFundamentals[symbol]) fundamentals[symbol] = previousFundamentals[symbol];
      runLog.push({ symbol, step: "fundamentals", status: previousFundamentals[symbol] ? "carried-over" : "failed", error: `handshake: ${message}` });
    }
  }

  const missingRequired = [...REQUIRED].filter((s) => !runLog.some((r) => r.symbol === s && r.step === "prices" && r.status === "ok"));
  const manifest = {
    builtAt,
    builder: "scripts/build-event-snapshot.mjs",
    range: RANGE,
    providers: {
      prices: "Yahoo Finance chart API (keyless; close is split-adjusted, adjclose is split- and dividend-adjusted)",
      fundamentals: "Yahoo Finance quoteSummary (vendor-computed fields; not audited figures)",
    },
    counts: {
      instruments: instruments.length,
      pricesOk: runLog.filter((r) => r.step === "prices" && r.status === "ok").length,
      pricesCarriedOver: runLog.filter((r) => r.step === "prices" && r.status === "carried-over").length,
      pricesFailed: runLog.filter((r) => r.step === "prices" && r.status === "failed").length,
      fundamentalsOk: runLog.filter((r) => r.step === "fundamentals" && r.status === "ok").length,
    },
    status: missingRequired.length ? "failed" : runLog.some((r) => r.status !== "ok") ? "partial" : "ok",
    missingRequired,
    runLog,
  };

  await writeFile(path.join(OUT_DIR, "prices.json"), JSON.stringify({ retrievedAt: builtAt, prices }) + "\n");
  await writeFile(path.join(OUT_DIR, "fundamentals.json"), JSON.stringify({ retrievedAt: builtAt, fundamentals }, null, 1) + "\n");
  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  console.log(`[events] ${manifest.status}: ${manifest.counts.pricesOk}/${instruments.length} priced, ${manifest.counts.fundamentalsOk}/${equities.length} fundamentals`);
  if (missingRequired.length) {
    console.error(`[events] benchmark(s) missing: ${missingRequired.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
