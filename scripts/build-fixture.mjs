#!/usr/bin/env node
/**
 * Build a deterministic, network-free Yahoo snapshot fixture.
 *
 * Fetches 3y daily OHLCV for the research universe once and writes the
 * normalized HistoricalPriceResult map to src/__fixtures__/yahoo-snapshot.json.
 *
 * The committed fixture lets CI run a full end-to-end research-pipeline
 * test (factors → backtests → radar → portfolio) without hitting Yahoo.
 *
 * SYMBOL LIST: this script keeps its own copy of the universe symbols (it's a
 * plain .mjs with no TS imports). A guard test (`watchlist.test.ts`) asserts the
 * committed fixture's keys match DEFAULT_SYMBOLS exactly, so any drift between
 * src/data/watchlist.ts and this list fails CI.
 *
 * Per-row fields are intentionally limited to the MarketPrice fields the
 * research pipeline actually consumes (date/open/high/low/close/volume); the
 * provider-only fields (rawClose/adjustedClose/adjustmentRatio) are dropped to
 * keep the committed fixture small.
 *
 * Run:
 *   node scripts/build-fixture.mjs
 *
 * Re-run when you change the universe or want to refresh the snapshot. The
 * pipeline test asserts shape and ranges, not exact numbers, so a refresh
 * shouldn't break tests unless the engine semantics actually changed.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Keep in sync with UNIVERSE in src/data/watchlist.ts (guarded by watchlist.test.ts).
const DEFAULT_SYMBOLS = [
  "AAPL", "MSFT", "NVDA",            // Technology
  "GOOGL", "META",                   // Communication
  "AMZN", "TSLA", "HD", "MCD",       // Consumer Discretionary
  "PG", "KO", "WMT",                 // Consumer Staples
  "JPM", "BAC", "V",                 // Financials
  "JNJ", "UNH", "PFE",               // Health Care
  "XOM", "CVX",                      // Energy
  "CAT", "HON",                      // Industrials
  "NEE", "DUK",                      // Utilities
  "AMT", "O",                        // Real Estate
  "SPY", "QQQ",                      // Broad-market ETFs
];
const RANGE = "3y";
const OUT_PATH = path.join(process.cwd(), "src", "__fixtures__", "yahoo-snapshot.json");
const CONCURRENCY = 4;
const isFinite = (value) => typeof value === "number" && Number.isFinite(value);

async function fetchOne(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${RANGE}&interval=1d&events=history&includeAdjustedClose=true`;
  const response = await fetch(url, {
    headers: { "user-agent": "factorforge-fixture-builder/0.1" },
  });
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const adjustedCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const timestamps = result?.timestamp ?? [];
  if (!result || !quote || timestamps.length === 0) throw new Error(`${symbol}: empty data`);

  let adjustedRows = 0;
  const prices = timestamps
    .map((ts, i) => {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const adj = adjustedCloses[i];
      const volume = quote.volume?.[i];
      if (![open, high, low, close, volume].every(isFinite)) return null;
      const hasAdj = isFinite(adj) && close > 0;
      const ratio = hasAdj ? adj / close : 1;
      if (ratio !== 1) adjustedRows += 1;
      // Only the fields the research pipeline reads.
      return {
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: Number((open * ratio).toFixed(4)),
        high: Number((high * ratio).toFixed(4)),
        low: Number((low * ratio).toFixed(4)),
        close: Number((hasAdj ? adj : close).toFixed(4)),
        volume,
      };
    })
    .filter((row) => row !== null);

  if (prices.length < 40) throw new Error(`${symbol}: only ${prices.length} bars`);

  const fetchedAt = new Date().toISOString();
  return {
    symbol,
    range: RANGE,
    prices,
    provider: "Yahoo Finance chart API",
    isFallback: false,
    status: "ok",
    message: adjustedRows > 0
      ? "Real daily OHLCV data loaded and adjusted for corporate actions"
      : "Real daily OHLCV data loaded",
    updatedAt: fetchedAt,
    quality: {
      adjusted: adjustedRows > 0,
      source: "yahoo",
      fetchedAt,
      rows: prices.length,
      firstDate: prices[0].date,
      lastDate: prices[prices.length - 1].date,
    },
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const out = {};
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const symbol = items[next++];
      process.stdout.write(`  ${symbol} … `);
      try {
        const result = await worker(symbol);
        out[symbol] = result;
        console.log(`${result.prices.length} bars (${result.quality.firstDate} → ${result.quality.lastDate})`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return out;
}

async function main() {
  console.log(`[fixture] fetching ${DEFAULT_SYMBOLS.length} symbols (${RANGE}, concurrency ${CONCURRENCY})…`);
  const results = await mapWithConcurrency(DEFAULT_SYMBOLS, CONCURRENCY, fetchOne);

  const fetched = Object.keys(results);
  const missing = DEFAULT_SYMBOLS.filter((s) => !fetched.includes(s));
  if (missing.length > 0) {
    throw new Error(`Refusing to write an incomplete fixture. Missing: ${missing.join(", ")}`);
  }

  // Stable key order (matches DEFAULT_SYMBOLS) so the committed file diffs cleanly.
  const ordered = {};
  for (const symbol of DEFAULT_SYMBOLS) ordered[symbol] = results[symbol];

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(ordered, null, 0) + "\n");
  const sizeKb = (JSON.stringify(ordered).length / 1024).toFixed(1);
  console.log(`[fixture] wrote ${OUT_PATH} — ${fetched.length} symbols, ${sizeKb} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
