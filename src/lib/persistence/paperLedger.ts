import "server-only";
import type { HistoricalPriceResult, MarketPrice } from "@/types/market";
import type { PaperLedgerSnapshot, RadarCandidate } from "@/types/strategy";
import { createLogger } from "@/lib/observability/logger";
import { getDb } from "./db";

const log = createLogger("paperLedger");

export interface PaperLedgerSyncOptions {
  allocatedCapital: number;
  nowMs?: number;
}

interface PaperLedgerRow {
  position_id: string;
  strategy_id: string;
  symbol: string;
  strategy_name: string;
  status: "open" | "closed";
  promoted_at: number;
  entry_date: string;
  entry_price: number;
  current_date: string;
  current_price: number;
  shares: number;
  allocated_capital: number;
  radar_score: number;
  last_signal_date: string | null;
  last_signal_type: string | null;
  data_provider: string;
  is_fallback: 0 | 1;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
}

export function paperLedgerPositionId(candidate: RadarCandidate): string {
  return `${candidate.result.strategyId}-${candidate.result.symbol}`;
}

export function syncPaperLedgerPositions(
  candidates: RadarCandidate[],
  maxSlots: number,
  pricesBySymbol: Record<string, HistoricalPriceResult>,
  options: PaperLedgerSyncOptions,
): Record<string, PaperLedgerSnapshot> {
  const selected = candidates.filter((candidate) => candidate.status === "radar candidate").slice(0, Math.max(0, maxSlots));
  const db = getDb();
  const nowMs = options.nowMs ?? Date.now();

  if (!db) {
    return Object.fromEntries(
      selected.map((candidate) => {
        const latest = latestMarketPrice(candidate, pricesBySymbol);
        return [
          paperLedgerPositionId(candidate),
          buildEphemeralLedgerSnapshot(candidate, latest, options.allocatedCapital, nowMs, "unavailable"),
        ];
      }),
    );
  }

  const snapshots: Record<string, PaperLedgerSnapshot> = {};
  try {
    const read = db.prepare<[string], PaperLedgerRow>(
      "SELECT * FROM paper_ledger_positions WHERE position_id = ?",
    );
    const insert = db.prepare(
      `INSERT INTO paper_ledger_positions (
        position_id, strategy_id, symbol, strategy_name, status, promoted_at,
        entry_date, entry_price, current_date, current_price, shares,
        allocated_capital, radar_score, last_signal_date, last_signal_type,
        data_provider, is_fallback, created_at, updated_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const update = db.prepare(
      `UPDATE paper_ledger_positions
       SET status = ?, current_date = ?, current_price = ?, radar_score = ?,
           last_signal_date = ?, last_signal_type = ?, data_provider = ?,
           is_fallback = ?, updated_at = ?, closed_at = NULL
       WHERE position_id = ?`,
    );

    const transact = db.transaction(() => {
      for (const candidate of selected) {
        const positionId = paperLedgerPositionId(candidate);
        const latest = latestMarketPrice(candidate, pricesBySymbol);
        const existing = read.get(positionId);
        if (existing) {
          update.run(
            "open",
            latest.date,
            latest.close,
            candidate.score,
            candidate.result.metrics.lastSignalDate,
            latestSignalType(candidate),
            candidate.result.dataStatus.provider,
            candidate.result.dataStatus.isFallback ? 1 : 0,
            nowMs,
            positionId,
          );
          snapshots[positionId] = rowToSnapshot({
            ...existing,
            status: "open",
            current_date: latest.date,
            current_price: latest.close,
            radar_score: candidate.score,
            last_signal_date: candidate.result.metrics.lastSignalDate,
            last_signal_type: latestSignalType(candidate),
            data_provider: candidate.result.dataStatus.provider,
            is_fallback: candidate.result.dataStatus.isFallback ? 1 : 0,
            updated_at: nowMs,
            closed_at: null,
          });
          continue;
        }

        const shares = latest.close > 0 ? options.allocatedCapital / latest.close : 0;
        insert.run(
          positionId,
          candidate.result.strategyId,
          candidate.result.symbol,
          candidate.result.strategyName,
          "open",
          nowMs,
          latest.date,
          latest.close,
          latest.date,
          latest.close,
          shares,
          options.allocatedCapital,
          candidate.score,
          candidate.result.metrics.lastSignalDate,
          latestSignalType(candidate),
          candidate.result.dataStatus.provider,
          candidate.result.dataStatus.isFallback ? 1 : 0,
          nowMs,
          nowMs,
          null,
        );
        snapshots[positionId] = buildEphemeralLedgerSnapshot(candidate, latest, options.allocatedCapital, nowMs, "persistent");
      }
    });

    transact();
  } catch (error) {
    log.warn("paper ledger sync failed", { error: errorMessage(error) });
    return Object.fromEntries(
      selected.map((candidate) => {
        const latest = latestMarketPrice(candidate, pricesBySymbol);
        return [
          paperLedgerPositionId(candidate),
          buildEphemeralLedgerSnapshot(candidate, latest, options.allocatedCapital, nowMs, "unavailable"),
        ];
      }),
    );
  }

  return snapshots;
}

function rowToSnapshot(row: PaperLedgerRow): PaperLedgerSnapshot {
  const marketValue = row.shares * row.current_price;
  const unrealizedPnl = marketValue - row.allocated_capital;
  const returnPct = row.allocated_capital > 0 ? unrealizedPnl / row.allocated_capital : 0;
  const daysLive = daysBetween(row.entry_date, row.current_date);
  return {
    source: "persistent",
    positionId: row.position_id,
    status: row.status,
    promotedAt: row.promoted_at,
    promotedAtIso: new Date(row.promoted_at).toISOString(),
    entryDate: row.entry_date,
    entryPrice: row.entry_price,
    currentDate: row.current_date,
    currentPrice: row.current_price,
    shares: row.shares,
    allocatedCapital: row.allocated_capital,
    marketValue,
    unrealizedPnl,
    returnPct,
    daysLive,
    note: "Tracked from the local paper ledger entry date.",
  };
}

function buildEphemeralLedgerSnapshot(
  candidate: RadarCandidate,
  latest: MarketPrice,
  allocatedCapital: number,
  nowMs: number,
  source: PaperLedgerSnapshot["source"],
): PaperLedgerSnapshot {
  const positionId = paperLedgerPositionId(candidate);
  const shares = latest.close > 0 ? allocatedCapital / latest.close : 0;
  return {
    source,
    positionId,
    status: "open",
    promotedAt: nowMs,
    promotedAtIso: new Date(nowMs).toISOString(),
    entryDate: latest.date,
    entryPrice: latest.close,
    currentDate: latest.date,
    currentPrice: latest.close,
    shares,
    allocatedCapital,
    marketValue: allocatedCapital,
    unrealizedPnl: 0,
    returnPct: 0,
    daysLive: 0,
    note: source === "persistent"
      ? "New local paper ledger entry created at the latest available close."
      : "Persistence unavailable; showing a session-only paper ledger estimate.",
  };
}

function latestMarketPrice(
  candidate: RadarCandidate,
  pricesBySymbol: Record<string, HistoricalPriceResult>,
): MarketPrice {
  const fromProvider = pricesBySymbol[candidate.result.symbol]?.prices.at(-1);
  if (fromProvider) return fromProvider;
  const fromSignal = candidate.result.signals.at(-1);
  if (fromSignal) {
    return {
      date: fromSignal.date,
      open: fromSignal.price,
      high: fromSignal.price,
      low: fromSignal.price,
      close: fromSignal.price,
      volume: 0,
    };
  }
  return {
    date: new Date().toISOString().slice(0, 10),
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    volume: 0,
  };
}

function latestSignalType(candidate: RadarCandidate): string | null {
  return candidate.result.signals.at(-1)?.type ?? null;
}

function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 86_400_000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
