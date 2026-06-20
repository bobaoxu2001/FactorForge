import { describe, it, expect } from "vitest";
import {
  buy,
  sell,
  snapshot,
  summarizePositions,
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
