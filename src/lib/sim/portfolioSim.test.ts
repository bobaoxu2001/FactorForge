import { describe, it, expect } from "vitest";
import {
  buy,
  sell,
  snapshot,
  summarizePositions,
  summarizeTrades,
  createInitialState,
  DEFAULT_STARTING_CAPITAL,
  type SimState,
} from "./portfolioSim";

function fresh(capital = DEFAULT_STARTING_CAPITAL): SimState {
  return createInitialState(capital, 0);
}

function expectOk(outcome: ReturnType<typeof buy>): SimState {
  if (!outcome.ok) throw new Error(`expected ok, got: ${outcome.reason}`);
  return outcome.state;
}

describe("portfolioSim — buy", () => {
  it("debits cash and opens a position", () => {
    const state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1));
    expect(state.cash).toBe(9_000);
    expect(state.positions).toEqual([{ symbol: "AAPL", shares: 10, avgCost: 100 }]);
    expect(state.trades[0]).toMatchObject({ side: "buy", symbol: "AAPL", shares: 10, price: 100, cashAfter: 9_000 });
  });

  it("averages cost basis across multiple buys of the same symbol", () => {
    let state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1));
    state = expectOk(buy(state, "AAPL", 10, 200, 2));
    const aapl = state.positions.find((p) => p.symbol === "AAPL")!;
    expect(aapl.shares).toBe(20);
    expect(aapl.avgCost).toBe(150); // (10*100 + 10*200) / 20
    expect(state.cash).toBe(7_000);
  });

  it("rejects an order that exceeds available cash", () => {
    const outcome = buy(fresh(500), "AAPL", 10, 100, 1);
    expect(outcome).toEqual({ ok: false, reason: "Not enough cash for this order." });
  });

  it("rejects fractional, zero, and negative share counts", () => {
    expect(buy(fresh(), "AAPL", 1.5, 100, 1).ok).toBe(false);
    expect(buy(fresh(), "AAPL", 0, 100, 1).ok).toBe(false);
    expect(buy(fresh(), "AAPL", -3, 100, 1).ok).toBe(false);
  });

  it("rejects a missing price", () => {
    expect(buy(fresh(), "AAPL", 10, 0, 1).ok).toBe(false);
    expect(buy(fresh(), "AAPL", 10, NaN, 1).ok).toBe(false);
  });

  it("does not mutate the input state", () => {
    const before = fresh(10_000);
    buy(before, "AAPL", 5, 100, 1);
    expect(before.cash).toBe(10_000);
    expect(before.positions).toHaveLength(0);
  });
});

describe("portfolioSim — sell", () => {
  it("credits cash, books realized P&L, and reduces shares", () => {
    let state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 4, 150, 2));
    expect(state.cash).toBe(9_000 + 4 * 150);
    expect(state.realizedPnl).toBe(4 * (150 - 100)); // 200
    expect(state.positions.find((p) => p.symbol === "AAPL")!.shares).toBe(6);
  });

  it("removes the position entirely when fully sold", () => {
    let state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 10, 90, 2));
    expect(state.positions).toHaveLength(0);
    expect(state.realizedPnl).toBe(10 * (90 - 100)); // -100
  });

  it("rejects selling more than held", () => {
    const state = expectOk(buy(fresh(10_000), "AAPL", 5, 100, 1));
    expect(sell(state, "AAPL", 6, 120, 2)).toEqual({ ok: false, reason: "You don't hold that many shares." });
  });

  it("rejects selling a symbol that isn't held", () => {
    expect(sell(fresh(), "TSLA", 1, 100, 1).ok).toBe(false);
  });
});

describe("portfolioSim — snapshot", () => {
  it("computes total value and return against starting capital", () => {
    let state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1)); // cash 9000, holding worth 1000 at cost
    const snap = snapshot(state, { AAPL: 130 });
    expect(snap.cash).toBe(9_000);
    expect(snap.investedValue).toBe(1_300);
    expect(snap.totalValue).toBe(10_300);
    expect(snap.totalReturn).toBe(300);
    expect(snap.totalReturnPct).toBeCloseTo(0.03, 10);
    expect(snap.unrealizedPnl).toBe(300);
    expect(snap.positions[0]).toMatchObject({ symbol: "AAPL", lastPrice: 130, marketValue: 1_300, unrealizedPnl: 300 });
    expect(snap.positions[0].unrealizedPct).toBeCloseTo(0.3, 10);
    expect(snap.positions[0].weight).toBeCloseTo(1_300 / 10_300, 10);
  });

  it("marks a position with no live price at its cost basis (zero unrealized)", () => {
    const state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1));
    const snap = snapshot(state, {}); // price gap
    expect(snap.investedValue).toBe(1_000);
    expect(snap.totalValue).toBe(10_000);
    expect(snap.unrealizedPnl).toBe(0);
  });

  it("an all-cash book reports zero return", () => {
    const snap = snapshot(fresh(10_000), { AAPL: 999 });
    expect(snap.totalValue).toBe(10_000);
    expect(snap.totalReturnPct).toBe(0);
    expect(snap.positions).toHaveLength(0);
  });

  it("orders positions by market value, largest first", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1)); // $1,000
    state = expectOk(buy(state, "MSFT", 10, 300, 2)); // $3,000
    const snap = snapshot(state, { AAPL: 100, MSFT: 300 });
    expect(snap.positions.map((p) => p.symbol)).toEqual(["MSFT", "AAPL"]);
  });
});

describe("portfolioSim — summarizePositions", () => {
  it("splits winners and losers by unrealized P&L (>=0 is a winner)", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1)); // up
    state = expectOk(buy(state, "MSFT", 10, 300, 2)); // down
    const snap = snapshot(state, { AAPL: 130, MSFT: 250 });
    const summary = summarizePositions(snap);
    expect(summary.count).toBe(2);
    expect(summary.winners).toBe(1); // AAPL +30%
    expect(summary.losers).toBe(1); // MSFT -16.7%
  });

  it("counts a flat (zero unrealized) position as a winner, not a loser", () => {
    const state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    const snap = snapshot(state, { AAPL: 100 }); // exactly cost basis
    const summary = summarizePositions(snap);
    expect(summary.winners).toBe(1);
    expect(summary.losers).toBe(0);
  });

  it("identifies the largest position by market value for topWeight / topSymbol", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1)); // $1,000 at mark
    state = expectOk(buy(state, "MSFT", 10, 300, 2)); // $3,000 at mark
    const snap = snapshot(state, { AAPL: 100, MSFT: 300 });
    const summary = summarizePositions(snap);
    // MSFT is the biggest book name by market value.
    expect(summary.topSymbol).toBe("MSFT");
    const msft = snap.positions.find((p) => p.symbol === "MSFT")!;
    expect(summary.topWeight).toBeCloseTo(msft.weight, 10);
    expect(summary.topWeight).toBeCloseTo(3_000 / snap.totalValue, 10);
  });

  it("picks best / worst position by unrealized %, independent of position size", () => {
    // Small position with the biggest % gain, large position with a small loss.
    let state = expectOk(buy(fresh(100_000), "AAPL", 1, 100, 1)); // tiny book
    state = expectOk(buy(state, "MSFT", 100, 300, 2)); // large book
    const snap = snapshot(state, { AAPL: 200, MSFT: 290 }); // AAPL +100%, MSFT ~-3.3%
    const summary = summarizePositions(snap);
    expect(summary.bestPosition?.symbol).toBe("AAPL");
    expect(summary.bestPosition?.unrealizedPct).toBeCloseTo(1, 10);
    expect(summary.worstPosition?.symbol).toBe("MSFT");
    expect(summary.worstPosition?.unrealizedPct).toBeLessThan(0);
  });

  it("reports investedWeight as the equity share of total account value", () => {
    const state = expectOk(buy(fresh(10_000), "AAPL", 10, 100, 1)); // $1,000 invested, $9,000 cash
    const snap = snapshot(state, { AAPL: 100 });
    const summary = summarizePositions(snap);
    expect(summary.investedWeight).toBeCloseTo(1_000 / 10_000, 10);
  });

  it("returns all-zero / null fields for an empty (all-cash) book", () => {
    const snap = snapshot(fresh(10_000), {});
    const summary = summarizePositions(snap);
    expect(summary).toEqual({
      count: 0,
      winners: 0,
      losers: 0,
      topWeight: 0,
      topSymbol: null,
      bestPosition: null,
      worstPosition: null,
      investedWeight: 0,
    });
  });
});

describe("portfolioSim — summarizeTrades", () => {
  it("returns an empty summary before any trade is closed", () => {
    // Open positions but no sells yet — nothing realized to summarize.
    const state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    expect(summarizeTrades(state)).toEqual({
      closedTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: null,
      expectancy: 0,
      bestTrade: null,
      worstTrade: null,
    });
  });

  it("counts wins, losses, and win rate across closed trades", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 10, 150, 2)); // +500 win
    state = expectOk(buy(state, "MSFT", 10, 300, 3));
    state = expectOk(sell(state, "MSFT", 10, 280, 4)); // -200 loss
    const summary = summarizeTrades(state);
    expect(summary.closedTrades).toBe(2);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(1);
    expect(summary.winRate).toBeCloseTo(0.5, 10);
  });

  it("computes gross profit/loss, averages, and profit factor", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 10, 160, 2)); // +600
    state = expectOk(buy(state, "MSFT", 10, 100, 3));
    state = expectOk(sell(state, "MSFT", 10, 80, 4)); // -200
    const summary = summarizeTrades(state);
    expect(summary.grossProfit).toBe(600);
    expect(summary.grossLoss).toBe(200); // stored as a positive magnitude
    expect(summary.avgWin).toBe(600);
    expect(summary.avgLoss).toBe(200);
    expect(summary.profitFactor).toBeCloseTo(3, 10); // 600 / 200
    expect(summary.expectancy).toBeCloseTo(200, 10); // (600 - 200) / 2
  });

  it("reports profitFactor null when there are no losing trades", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 10, 150, 2)); // only a win
    const summary = summarizeTrades(state);
    expect(summary.losses).toBe(0);
    expect(summary.grossLoss).toBe(0);
    expect(summary.profitFactor).toBeNull();
  });

  it("does not count a scratch (break-even) sell as a win or a loss", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 10, 100, 2)); // realized exactly 0
    const summary = summarizeTrades(state);
    expect(summary.closedTrades).toBe(1);
    expect(summary.wins).toBe(0);
    expect(summary.losses).toBe(0);
    expect(summary.winRate).toBe(0);
  });

  it("identifies the best and worst closed trade by realized P&L", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 10, 200, 2)); // +1000 best
    state = expectOk(buy(state, "MSFT", 10, 100, 3));
    state = expectOk(sell(state, "MSFT", 10, 55, 4)); // -450 worst
    state = expectOk(buy(state, "NVDA", 10, 100, 5));
    state = expectOk(sell(state, "NVDA", 10, 120, 6)); // +200
    const summary = summarizeTrades(state);
    expect(summary.bestTrade).toMatchObject({ symbol: "AAPL", realized: 1_000 });
    expect(summary.worstTrade).toMatchObject({ symbol: "MSFT", realized: -450 });
  });

  it("expectancy over all closed trades matches total realized P&L / count", () => {
    let state = expectOk(buy(fresh(100_000), "AAPL", 10, 100, 1));
    state = expectOk(sell(state, "AAPL", 4, 150, 2)); // +200
    state = expectOk(sell(state, "AAPL", 6, 90, 3)); // -60
    const summary = summarizeTrades(state);
    // Two partial sells of the same name are two closed trades.
    expect(summary.closedTrades).toBe(2);
    expect(summary.expectancy).toBeCloseTo(state.realizedPnl / 2, 10);
  });
});
