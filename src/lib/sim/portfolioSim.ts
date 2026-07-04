/**
 * Deterministic paper-portfolio simulator.
 *
 * Pure math over a plain state object so the exact same logic runs in the
 * browser (the interactive trading desk persists state to localStorage) and in
 * unit tests. There is no broker and no real order path — every fill is
 * simulated at a price the caller supplies (the latest daily close on the
 * trading desk). Buys and sells return a discriminated result so the UI can
 * surface a reason rather than throw.
 */

export interface SimPosition {
  symbol: string;
  shares: number;
  /** Average cost basis per share — the denominator for unrealized P&L. */
  avgCost: number;
}

export interface SimTrade {
  id: string;
  ts: number;
  side: "buy" | "sell";
  symbol: string;
  shares: number;
  price: number;
  /** Cash balance immediately after the fill. */
  cashAfter: number;
  /** Realized P&L booked by this fill (0 for buys). */
  realized: number;
}

export interface SimState {
  startingCapital: number;
  cash: number;
  positions: SimPosition[];
  /** Most-recent first. */
  trades: SimTrade[];
  realizedPnl: number;
  createdAt: number;
}

export interface PositionSnapshot extends SimPosition {
  lastPrice: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  /** Share of total account value (cash + holdings). */
  weight: number;
}

export interface SimSnapshot {
  cash: number;
  investedValue: number;
  totalValue: number;
  /** Dollar gain/loss vs the starting capital. */
  totalReturn: number;
  /** Fractional return vs the starting capital (e.g. 0.12 = +12%). */
  totalReturnPct: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positions: PositionSnapshot[];
}

export interface SimPositionSummary {
  /** Number of open positions. */
  count: number;
  /** Positions with unrealized P&L >= 0. */
  winners: number;
  /** Positions with unrealized P&L < 0. */
  losers: number;
  /** Largest single-position weight (0–1) — a simple concentration read. */
  topWeight: number;
  /** Symbol of the largest position by market value, or null when flat. */
  topSymbol: string | null;
  /** Best open position by unrealized %, or null when flat. */
  bestPosition: PositionSnapshot | null;
  /** Worst open position by unrealized %, or null when flat. */
  worstPosition: PositionSnapshot | null;
  /** Share of total account value held in equities vs cash (0–1). */
  investedWeight: number;
}

export interface SimTradeSummary {
  /** Number of closed trades (each sell fill books a realized result). */
  closedTrades: number;
  /** Sells that booked a gain (realized > 0). */
  wins: number;
  /** Sells that booked a loss (realized < 0). */
  losses: number;
  /** Fraction of closed trades that were wins (0–1); 0 when no trades closed. */
  winRate: number;
  /** Mean realized gain across winning trades (>= 0). */
  avgWin: number;
  /** Mean realized loss across losing trades, as a positive number (>= 0). */
  avgLoss: number;
  /** Sum of winning realized P&L (>= 0). */
  grossProfit: number;
  /** Sum of losing realized P&L, as a positive number (>= 0). */
  grossLoss: number;
  /**
   * Gross profit divided by gross loss. `null` when there are no losses yet
   * (an undefined ratio) so the UI can show "∞" rather than a divide-by-zero.
   */
  profitFactor: number | null;
  /** Average realized P&L per closed trade — the desk's per-trade expectancy. */
  expectancy: number;
  /** The single most profitable closed trade, or null when none have closed. */
  bestTrade: SimTrade | null;
  /** The single worst closed trade, or null when none have closed. */
  worstTrade: SimTrade | null;
}

export type TradeOutcome = { ok: true; state: SimState } | { ok: false; reason: string };

export const DEFAULT_STARTING_CAPITAL = 100_000;

// Tiny tolerance so a "buy the max" order priced from the same number the UI
// shows isn't rejected by floating-point dust.
const CASH_EPSILON = 1e-6;

export function createInitialState(
  startingCapital: number = DEFAULT_STARTING_CAPITAL,
  now: number = Date.now(),
): SimState {
  return {
    startingCapital,
    cash: startingCapital,
    positions: [],
    trades: [],
    realizedPnl: 0,
    createdAt: now,
  };
}

function makeId(now: number): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateOrder(symbolRaw: string, shares: number, price: number): { symbol: string } | { reason: string } {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) return { reason: "Pick a symbol first." };
  if (!Number.isInteger(shares) || shares <= 0) return { reason: "Enter a whole number of shares." };
  if (!Number.isFinite(price) || price <= 0) return { reason: "No price available for this symbol yet." };
  return { symbol };
}

export function buy(
  state: SimState,
  symbolRaw: string,
  shares: number,
  price: number,
  now: number = Date.now(),
): TradeOutcome {
  const checked = validateOrder(symbolRaw, shares, price);
  if ("reason" in checked) return { ok: false, reason: checked.reason };
  const { symbol } = checked;

  const cost = shares * price;
  if (cost > state.cash + CASH_EPSILON) return { ok: false, reason: "Not enough cash for this order." };

  const positions = state.positions.map((p) => ({ ...p }));
  const existing = positions.find((p) => p.symbol === symbol);
  if (existing) {
    const totalShares = existing.shares + shares;
    existing.avgCost = (existing.shares * existing.avgCost + shares * price) / totalShares;
    existing.shares = totalShares;
  } else {
    positions.push({ symbol, shares, avgCost: price });
  }

  const cash = state.cash - cost;
  const trade: SimTrade = { id: makeId(now), ts: now, side: "buy", symbol, shares, price, cashAfter: cash, realized: 0 };
  return { ok: true, state: { ...state, cash, positions, trades: [trade, ...state.trades] } };
}

export function sell(
  state: SimState,
  symbolRaw: string,
  shares: number,
  price: number,
  now: number = Date.now(),
): TradeOutcome {
  const checked = validateOrder(symbolRaw, shares, price);
  if ("reason" in checked) return { ok: false, reason: checked.reason };
  const { symbol } = checked;

  const positions = state.positions.map((p) => ({ ...p }));
  const existing = positions.find((p) => p.symbol === symbol);
  if (!existing || existing.shares < shares) return { ok: false, reason: "You don't hold that many shares." };

  const realized = shares * (price - existing.avgCost);
  existing.shares -= shares;
  const remaining = existing.shares > 0 ? positions : positions.filter((p) => p.symbol !== symbol);

  const cash = state.cash + shares * price;
  const trade: SimTrade = { id: makeId(now), ts: now, side: "sell", symbol, shares, price, cashAfter: cash, realized };
  return {
    ok: true,
    state: { ...state, cash, positions: remaining, realizedPnl: state.realizedPnl + realized, trades: [trade, ...state.trades] },
  };
}

/**
 * Mark the book to the supplied latest prices. A symbol missing from
 * `latestPrices` is marked at its own cost basis (zero unrealized) rather than
 * dropped, so a temporary data gap can't make the account value lurch.
 */
export function snapshot(state: SimState, latestPrices: Record<string, number>): SimSnapshot {
  const priced = state.positions.map((p) => {
    const lastPrice = latestPrices[p.symbol] ?? p.avgCost;
    const costBasis = p.shares * p.avgCost;
    const marketValue = p.shares * lastPrice;
    const unrealizedPnl = marketValue - costBasis;
    return {
      ...p,
      lastPrice,
      costBasis,
      marketValue,
      unrealizedPnl,
      unrealizedPct: costBasis > 0 ? unrealizedPnl / costBasis : 0,
      weight: 0,
    };
  });

  const investedValue = priced.reduce((sum, p) => sum + p.marketValue, 0);
  const totalValue = state.cash + investedValue;
  const positions = priced
    .map((p) => ({ ...p, weight: totalValue > 0 ? p.marketValue / totalValue : 0 }))
    .sort((a, b) => b.marketValue - a.marketValue);

  const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalReturn = totalValue - state.startingCapital;

  return {
    cash: state.cash,
    investedValue,
    totalValue,
    totalReturn,
    totalReturnPct: state.startingCapital > 0 ? totalReturn / state.startingCapital : 0,
    unrealizedPnl,
    realizedPnl: state.realizedPnl,
    positions,
  };
}

/**
 * Deterministic position-level analytics for an already-marked snapshot:
 * winners/losers, single-name concentration, best/worst position, and the
 * invested-vs-cash split. Pure — derives everything from the snapshot the desk
 * already renders, never from a new data source.
 */
export function summarizePositions(snap: SimSnapshot): SimPositionSummary {
  const positions = snap.positions;
  const winners = positions.filter((position) => position.unrealizedPnl >= 0).length;
  const top = positions.reduce<PositionSnapshot | null>(
    (best, position) => (best === null || position.marketValue > best.marketValue ? position : best),
    null,
  );
  const bestPosition = positions.reduce<PositionSnapshot | null>(
    (best, position) => (best === null || position.unrealizedPct > best.unrealizedPct ? position : best),
    null,
  );
  const worstPosition = positions.reduce<PositionSnapshot | null>(
    (worst, position) => (worst === null || position.unrealizedPct < worst.unrealizedPct ? position : worst),
    null,
  );
  return {
    count: positions.length,
    winners,
    losers: positions.length - winners,
    topWeight: top?.weight ?? 0,
    topSymbol: top?.symbol ?? null,
    bestPosition,
    worstPosition,
    investedWeight: snap.totalValue > 0 ? snap.investedValue / snap.totalValue : 0,
  };
}

/**
 * Realized-performance analytics over the closed trades (every sell fill).
 * Where `summarizePositions` describes the *open* book, this describes actual
 * decision quality: win rate, average win/loss, profit factor, and per-trade
 * expectancy. Pure — derived only from `state.trades`, never from live prices,
 * so it's stable regardless of where the market has moved since.
 */
export function summarizeTrades(state: SimState): SimTradeSummary {
  const closed = state.trades.filter((trade) => trade.side === "sell");

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let bestTrade: SimTrade | null = null;
  let worstTrade: SimTrade | null = null;

  for (const trade of closed) {
    if (trade.realized > 0) {
      wins += 1;
      grossProfit += trade.realized;
    } else if (trade.realized < 0) {
      losses += 1;
      grossLoss += -trade.realized;
    }
    if (bestTrade === null || trade.realized > bestTrade.realized) bestTrade = trade;
    if (worstTrade === null || trade.realized < worstTrade.realized) worstTrade = trade;
  }

  const closedTrades = closed.length;
  return {
    closedTrades,
    wins,
    losses,
    winRate: closedTrades > 0 ? wins / closedTrades : 0,
    avgWin: wins > 0 ? grossProfit / wins : 0,
    avgLoss: losses > 0 ? grossLoss / losses : 0,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: closedTrades > 0 ? (grossProfit - grossLoss) / closedTrades : 0,
    bestTrade,
    worstTrade,
  };
}
