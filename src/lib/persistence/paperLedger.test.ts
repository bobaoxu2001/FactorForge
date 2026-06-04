import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import type { BacktestResult } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import type { RadarCandidate } from "@/types/strategy";

const state = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("./db", () => ({
  getDb: () => state.db,
}));

import { syncPaperLedgerPositions } from "./paperLedger";

function installSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE paper_ledger_positions (
      position_id       TEXT PRIMARY KEY,
      strategy_id       TEXT NOT NULL,
      symbol            TEXT NOT NULL,
      strategy_name     TEXT NOT NULL,
      status            TEXT NOT NULL,
      promoted_at       INTEGER NOT NULL,
      entry_date        TEXT NOT NULL,
      entry_price       REAL NOT NULL,
      current_date      TEXT NOT NULL,
      current_price     REAL NOT NULL,
      shares            REAL NOT NULL,
      allocated_capital REAL NOT NULL,
      radar_score       INTEGER NOT NULL,
      last_signal_date  TEXT,
      last_signal_type  TEXT,
      data_provider     TEXT NOT NULL,
      is_fallback       INTEGER NOT NULL,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      closed_at         INTEGER
    );
  `);
}

function candidate(): RadarCandidate {
  const result: BacktestResult = {
    symbol: "AAPL",
    strategyId: "desk-test",
    strategyName: "Desk Test Strategy",
    description: "test",
    type: "breakout",
    signals: [{ date: "2026-06-01", type: "buy", price: 100, reason: "entry" }],
    trades: [],
    equityCurve: [],
    riskFlags: [],
    recommendation: "test",
    assumptions: {
      initialCapital: 100_000,
      positionFraction: 0.2,
      stopLossPct: 0.08,
      trailingStopPct: 0.12,
      maxHoldingDays: 45,
      execution: "next_open",
      slippageBps: 5,
      feePerTrade: 1,
    },
    dataStatus: {
      provider: "test provider",
      isFallback: false,
      message: "test",
      updatedAt: "2026-06-01T00:00:00.000Z",
      adjusted: true,
    },
    metrics: {
      totalReturn: 0.50,
      annualizedReturn: 0.2,
      benchmarkReturn: 0.1,
      excessReturn: 0.1,
      maxDrawdown: -0.1,
      sharpe: 1.5,
      winRate: 0.6,
      profitFactor: 1.8,
      tradeCount: 5,
      averageHoldingDays: 8,
      volatility: 0.2,
      currentPosition: "long",
      lastSignalDate: "2026-06-01",
    },
  };
  return {
    rank: 1,
    score: 90,
    status: "radar candidate",
    result,
    reasons: [],
    nextAction: "promote",
  };
}

function prices(close: number, date: string): Record<string, HistoricalPriceResult> {
  return {
    AAPL: {
      symbol: "AAPL",
      range: "3y",
      provider: "test provider",
      isFallback: false,
      status: "ok",
      message: "test",
      updatedAt: `${date}T00:00:00.000Z`,
      quality: {
        adjusted: true,
        source: "yahoo",
        fetchedAt: `${date}T00:00:00.000Z`,
        rows: 1,
        firstDate: date,
        lastDate: date,
      },
      prices: [{ date, open: close, high: close, low: close, close, volume: 1_000_000 }],
    },
  };
}

describe("paper ledger persistence", () => {
  beforeEach(() => {
    state.db?.close();
    state.db = new Database(":memory:");
    installSchema(state.db);
  });

  it("starts a promoted position at zero P&L, then marks future prices from the original entry", () => {
    const c = candidate();
    const first = syncPaperLedgerPositions([c], 1, prices(100, "2026-06-01"), {
      allocatedCapital: 20_000,
      nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
    })["desk-test-AAPL"];

    expect(first.source).toBe("persistent");
    expect(first.entryPrice).toBe(100);
    expect(first.currentPrice).toBe(100);
    expect(first.returnPct).toBe(0);
    expect(first.unrealizedPnl).toBe(0);

    const second = syncPaperLedgerPositions([c], 1, prices(110, "2026-06-04"), {
      allocatedCapital: 20_000,
      nowMs: Date.parse("2026-06-04T12:00:00.000Z"),
    })["desk-test-AAPL"];

    expect(second.entryDate).toBe("2026-06-01");
    expect(second.entryPrice).toBe(100);
    expect(second.currentDate).toBe("2026-06-04");
    expect(second.currentPrice).toBe(110);
    expect(second.returnPct).toBeCloseTo(0.10);
    expect(second.unrealizedPnl).toBeCloseTo(2_000);
    expect(second.daysLive).toBe(3);
  });
});
