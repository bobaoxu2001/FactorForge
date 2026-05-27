#!/usr/bin/env node
/**
 * Build a deterministic, network-free Yahoo snapshot fixture.
 *
 * Fetches 3y daily OHLCV for the default watchlist once and writes the
 * normalized HistoricalPriceResult map to src/__fixtures__/yahoo-snapshot.json.
 *
 * The committed fixture lets CI run a full end-to-end research-pipeline
 * test (factors → backtests → radar → portfolio) without hitting Yahoo.
 *
 * Run:
 *   node scripts/build-fixture.mjs
 *
 * Re-run when you want to refresh the snapshot. The pipeline test asserts
 * shape and ranges, not exact numbers, so a refresh shouldn't break tests
 * unless the engine semantics actually changed.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "JPM", "SPY", "QQQ"];
const RANGE = "3y";
const OUT_PATH = path.join(process.cwd(), "src", "__fixtures__", "yahoo-snapshot.json");

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
      return {
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: Number((open * ratio).toFixed(4)),
        high: Number((high * ratio).toFixed(4)),
        low: Number((low * ratio).toFixed(4)),
        close: Number((hasAdj ? adj : close).toFixed(4)),
        rawClose: close,
        adjustedClose: hasAdj ? adj : close,
        adjustmentRatio: ratio,
        volume,
      };
    })
    .filter((row) => row !== null);

  if (prices.length < 40) throw new Error(`${symbol}: only ${prices.length} bars`);

  const adjustedRows = prices.filter((p) => p.adjustmentRatio !== 1).length;
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

async function main() {
  console.log(`[fixture] fetching ${DEFAULT_SYMBOLS.length} symbols (${RANGE})…`);
  const results = {};
  for (const symbol of DEFAULT_SYMBOLS) {
    process.stdout.write(`  ${symbol} … `);
    try {
      const result = await fetchOne(symbol);
      results[symbol] = result;
      console.log(`${result.prices.length} bars (${result.quality.firstDate} → ${result.quality.lastDate})`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(results, null, 0) + "\n");
  const sizeKb = (JSON.stringify(results).length / 1024).toFixed(1);
  console.log(`[fixture] wrote ${OUT_PATH} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
