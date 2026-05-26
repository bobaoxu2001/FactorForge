import type { HistoricalPriceResult, MarketPrice, PriceRange } from "@/types/market";

const seedFromSymbol = (symbol: string) =>
  symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

export function buildFallbackPrices(symbol: string, range: PriceRange, message: string): HistoricalPriceResult {
  const days = range === "3y" ? 756 : 252;
  const seed = seedFromSymbol(symbol);
  const prices: MarketPrice[] = [];
  const updatedAt = new Date().toISOString();
  const start = new Date();
  start.setDate(start.getDate() - days);

  let close = 80 + (seed % 180);
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const drift = 0.00025 + (seed % 7) * 0.00003;
    const cycle = Math.sin((i + seed) / 13) * 0.012;
    const noise = Math.sin((i * 17 + seed) / 9) * 0.008;
    const dailyReturn = drift + cycle + noise;
    const open = close * (1 + noise / 3);
    close = Math.max(5, close * (1 + dailyReturn));
    const high = Math.max(open, close) * (1 + 0.006 + Math.abs(noise));
    const low = Math.min(open, close) * (1 - 0.006 - Math.abs(cycle) / 2);
    const volume = Math.round(20_000_000 + (seed % 20) * 1_000_000 + Math.abs(noise) * 900_000_000);

    prices.push({
      date: date.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      rawClose: Number(close.toFixed(2)),
      adjustedClose: Number(close.toFixed(2)),
      adjustmentRatio: 1,
      volume,
    });
  }

  return {
    symbol,
    range,
    prices,
    provider: "deterministic fallback",
    isFallback: true,
    status: "fallback",
    message,
    updatedAt,
    quality: {
      adjusted: false,
      source: "fallback",
      fetchedAt: updatedAt,
      rows: prices.length,
      firstDate: prices[0]?.date ?? null,
      lastDate: prices[prices.length - 1]?.date ?? null,
    },
  };
}
