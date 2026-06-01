/**
 * Research universe.
 *
 * Deliberately sector-diversified rather than a mega-cap tech monoculture: the
 * cross-sectional momentum / low-volatility factors and the N_eff concentration
 * analysis are only meaningful if the universe actually spans independent return
 * drivers. A basket of "seven different tech names" measures one factor wearing
 * seven hats — exactly the failure mode the concentration gate exists to catch.
 *
 * `UNIVERSE` is the single source of truth; `DEFAULT_SYMBOLS` is derived from it
 * so the two can never drift. The fixture builder (`scripts/build-fixture.mjs`)
 * keeps its own copy of the symbol list — a guard test asserts the committed
 * fixture's keys match `DEFAULT_SYMBOLS` exactly, so any drift fails CI.
 */

export type Sector =
  | "Technology"
  | "Communication"
  | "Consumer Discretionary"
  | "Consumer Staples"
  | "Financials"
  | "Health Care"
  | "Energy"
  | "Industrials"
  | "Utilities"
  | "Real Estate"
  | "Broad Market";

export interface UniverseConstituent {
  symbol: string;
  name: string;
  sector: Sector;
  /** ETFs are benchmark instruments, excluded from single-name factor baskets. */
  kind: "stock" | "etf";
}

export const UNIVERSE: UniverseConstituent[] = [
  // Technology
  { symbol: "AAPL", name: "Apple", sector: "Technology", kind: "stock" },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", kind: "stock" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology", kind: "stock" },
  // Communication Services
  { symbol: "GOOGL", name: "Alphabet", sector: "Communication", kind: "stock" },
  { symbol: "META", name: "Meta Platforms", sector: "Communication", kind: "stock" },
  // Consumer Discretionary
  { symbol: "AMZN", name: "Amazon", sector: "Consumer Discretionary", kind: "stock" },
  { symbol: "TSLA", name: "Tesla", sector: "Consumer Discretionary", kind: "stock" },
  { symbol: "HD", name: "Home Depot", sector: "Consumer Discretionary", kind: "stock" },
  { symbol: "MCD", name: "McDonald's", sector: "Consumer Discretionary", kind: "stock" },
  // Consumer Staples
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", kind: "stock" },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer Staples", kind: "stock" },
  { symbol: "WMT", name: "Walmart", sector: "Consumer Staples", kind: "stock" },
  // Financials
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", kind: "stock" },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", kind: "stock" },
  { symbol: "V", name: "Visa", sector: "Financials", kind: "stock" },
  // Health Care
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health Care", kind: "stock" },
  { symbol: "UNH", name: "UnitedHealth", sector: "Health Care", kind: "stock" },
  { symbol: "PFE", name: "Pfizer", sector: "Health Care", kind: "stock" },
  // Energy
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", kind: "stock" },
  { symbol: "CVX", name: "Chevron", sector: "Energy", kind: "stock" },
  // Industrials
  { symbol: "CAT", name: "Caterpillar", sector: "Industrials", kind: "stock" },
  { symbol: "HON", name: "Honeywell", sector: "Industrials", kind: "stock" },
  // Utilities
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities", kind: "stock" },
  { symbol: "DUK", name: "Duke Energy", sector: "Utilities", kind: "stock" },
  // Real Estate (REITs)
  { symbol: "AMT", name: "American Tower", sector: "Real Estate", kind: "stock" },
  { symbol: "O", name: "Realty Income", sector: "Real Estate", kind: "stock" },
  // Broad-market ETFs (benchmarks)
  { symbol: "SPY", name: "S&P 500 ETF", sector: "Broad Market", kind: "etf" },
  { symbol: "QQQ", name: "Nasdaq-100 ETF", sector: "Broad Market", kind: "etf" },
];

export const DEFAULT_SYMBOLS: readonly string[] = UNIVERSE.map((c) => c.symbol);

export type DefaultSymbol = string;

const BY_SYMBOL: Record<string, UniverseConstituent> = Object.fromEntries(
  UNIVERSE.map((c) => [c.symbol, c]),
);

export function constituentOf(symbol: string): UniverseConstituent | undefined {
  return BY_SYMBOL[symbol.toUpperCase()];
}

export function sectorOf(symbol: string): Sector | null {
  return BY_SYMBOL[symbol.toUpperCase()]?.sector ?? null;
}

export interface SectorBucket {
  sector: Sector;
  symbols: string[];
  count: number;
}

/**
 * Sector breakdown of the universe, sorted by descending count then name.
 * Drives the "sector breadth" readout and the diversification invariant tests.
 */
export function universeSectorBreakdown(universe: UniverseConstituent[] = UNIVERSE): SectorBucket[] {
  const map = new Map<Sector, string[]>();
  for (const c of universe) {
    const list = map.get(c.sector) ?? [];
    list.push(c.symbol);
    map.set(c.sector, list);
  }
  return [...map.entries()]
    .map(([sector, symbols]) => ({ sector, symbols, count: symbols.length }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));
}

/** Number of distinct sectors represented in the universe. */
export function sectorCount(universe: UniverseConstituent[] = UNIVERSE): number {
  return new Set(universe.map((c) => c.sector)).size;
}
