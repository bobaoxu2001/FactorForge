import type { DailyReview, PaperAccountSummary, PaperObservation } from "@/types/strategy";

export interface PublicTrackRecordRow {
  id: string;
  rank: number;
  strategyName: string;
  strategyId: string;
  symbol: string;
  status: PaperObservation["status"];
  ledgerSource: string;
  ledgerTracked: boolean;
  entryDate: string | null;
  currentDate: string | null;
  daysLive: number;
  allocatedCapital: number;
  marketValue: number;
  unrealizedPnl: number;
  returnPct: number;
  radarScore: number;
  maxDrawdown: number;
  recentSignal: string;
  nextCheck: string;
}

export interface PublicTrackRecord {
  asOf: string;
  generatedAt: string;
  shareLine: string;
  promotedCount: number;
  liveCount: number;
  ledgerTrackedCount: number;
  winners: number;
  losers: number;
  totalAllocatedCapital: number;
  totalMarketValue: number;
  unrealizedPnl: number;
  ledgerReturnPct: number;
  exposurePct: number;
  maxObservedDrawdown: number;
  averageRadarScore: number;
  oldestEntryDate: string | null;
  latestMarkDate: string | null;
  rows: PublicTrackRecordRow[];
  disclosureItems: string[];
}

export function buildPublicTrackRecord(input: {
  observations: PaperObservation[];
  account: PaperAccountSummary;
  dailyReview: DailyReview;
  generatedAt: string;
}): PublicTrackRecord {
  const rows = input.observations.map(toRow).sort((a, b) => b.returnPct - a.returnPct);
  const promotedCount = rows.length;
  const liveCount = rows.filter((row) => row.status === "active" || row.status === "holding").length;
  const ledgerTrackedCount = rows.filter((row) => row.ledgerTracked).length;
  const totalAllocatedCapital = rows.reduce((sum, row) => sum + row.allocatedCapital, 0);
  const totalMarketValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const unrealizedPnl = rows.reduce((sum, row) => sum + row.unrealizedPnl, 0);
  const ledgerReturnPct = totalAllocatedCapital > 0 ? unrealizedPnl / totalAllocatedCapital : 0;
  const oldestEntryDate = minDate(rows.map((row) => row.entryDate));
  const latestMarkDate = maxDate(rows.map((row) => row.currentDate));
  const shareLine = `${promotedCount} ${promotedCount === 1 ? "strategy" : "strategies"} tracked since radar admission · ${formatSignedPct(ledgerReturnPct)} ledger return · ${ledgerTrackedCount}/${promotedCount || 0} ledger-backed · ${input.dailyReview.winners}W/${input.dailyReview.losers}L`;

  return {
    asOf: input.dailyReview.asOf,
    generatedAt: input.generatedAt,
    shareLine,
    promotedCount,
    liveCount,
    ledgerTrackedCount,
    winners: input.dailyReview.winners,
    losers: input.dailyReview.losers,
    totalAllocatedCapital,
    totalMarketValue,
    unrealizedPnl,
    ledgerReturnPct,
    exposurePct: input.account.exposurePct,
    maxObservedDrawdown: input.account.maxObservedDrawdown,
    averageRadarScore: input.account.averageRadarScore,
    oldestEntryDate,
    latestMarkDate,
    rows: rows.map((row, index) => ({ ...row, rank: index + 1 })),
    disclosureItems: [
      "This is a public paper-trading track record, not a brokerage statement.",
      "Returns start when a strategy enters the local paper ledger, not at the beginning of the historical backtest.",
      "No live orders are submitted, cancelled, routed, or recommended from this page.",
      "Only radar-approved strategies that pass slot, exposure, drawdown, and concentration rules can appear here.",
      "Fallback/demo market data remains labeled elsewhere in the app and is not presented as broker-confirmed performance.",
    ],
  };
}

function toRow(observation: PaperObservation): PublicTrackRecordRow {
  const result = observation.candidate.result;
  const ledger = observation.ledger;
  const allocatedCapital = ledger?.allocatedCapital ?? observation.simulatedCapital;
  const unrealizedPnl = ledger?.unrealizedPnl ?? allocatedCapital * observation.simulatedReturn;
  const marketValue = ledger?.marketValue ?? allocatedCapital + unrealizedPnl;
  return {
    id: observation.id,
    rank: 0,
    strategyName: result.strategyName,
    strategyId: result.strategyId,
    symbol: result.symbol,
    status: observation.status,
    ledgerSource: ledger ? ledgerStatusLabel(ledger.source) : "backtest estimate",
    ledgerTracked: ledger?.source === "persistent",
    entryDate: ledger?.entryDate ?? null,
    currentDate: ledger?.currentDate ?? null,
    daysLive: ledger?.daysLive ?? 0,
    allocatedCapital,
    marketValue,
    unrealizedPnl,
    returnPct: ledger?.returnPct ?? observation.simulatedReturn,
    radarScore: observation.candidate.score,
    maxDrawdown: result.metrics.maxDrawdown,
    recentSignal: observation.recentSignal,
    nextCheck: observation.nextCheck,
  };
}

function ledgerStatusLabel(source: NonNullable<PaperObservation["ledger"]>["source"]): string {
  if (source === "persistent") return "ledger tracked";
  if (source === "ephemeral") return "session estimate";
  return "ledger unavailable";
}

function minDate(values: Array<string | null>): string | null {
  const dates = values.filter((value): value is string => Boolean(value));
  return dates.length > 0 ? [...dates].sort()[0] : null;
}

function maxDate(values: Array<string | null>): string | null {
  const dates = values.filter((value): value is string => Boolean(value));
  return dates.length > 0 ? [...dates].sort().at(-1) ?? null : null;
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}
