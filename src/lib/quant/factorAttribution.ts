import type { EquityPoint } from "@/types/backtest";
import type { HistoricalPriceResult } from "@/types/market";
import { dailyReturns, realizedVolatility } from "./indicators";

const TRADING_DAYS = 252;
const MOM_LOOKBACK = 60;
const VOL_LOOKBACK = 60;

export interface FactorReturnsRow {
  date: string;
  mkt: number; // SPY daily return
  mom: number; // cross-sectional momentum (top 50% − bottom 50% by 60d return)
  vol: number; // low-vol minus high-vol (bottom 50% − top 50% by 60d realized vol)
}

export interface FactorAttribution {
  alphaDaily: number;
  alphaAnnualized: number;
  betas: { mkt: number; mom: number; vol: number };
  tStats: { alpha: number; mkt: number; mom: number; vol: number };
  rSquared: number;
  residualVolatility: number;
  observations: number;
  startDate: string;
  endDate: string;
  benchmarkSymbol: string;
}

/**
 * Build daily factor returns from a snapshot of price histories.
 *  - mkt: SPY (or QQQ fallback) daily return
 *  - mom: equal-weight long top-50% minus short bottom-50% by 60-day momentum
 *  - vol: equal-weight long bottom-50% minus short top-50% by 60-day realized volatility
 *
 * Factors are computed using only information available at t-1, so signal
 * leakage into same-day return is avoided.
 */
export function buildFactorReturns(
  pricesBySymbol: Record<string, HistoricalPriceResult>,
): FactorReturnsRow[] {
  const benchmark = pricesBySymbol.SPY ?? pricesBySymbol.QQQ ?? Object.values(pricesBySymbol)[0];
  if (!benchmark || benchmark.prices.length < MOM_LOOKBACK + 5) return [];

  // Shared calendar = intersection of every symbol's dates
  const symbols = Object.keys(pricesBySymbol);
  const calendar = intersectDates(symbols.map((sym) => pricesBySymbol[sym].prices.map((p) => p.date)));
  if (calendar.length < MOM_LOOKBACK + 5) return [];

  // Per-symbol close vectors aligned to calendar
  const closesBySymbol: Record<string, number[]> = {};
  symbols.forEach((sym) => {
    const map = new Map<string, number>();
    pricesBySymbol[sym].prices.forEach((p) => map.set(p.date, p.close));
    closesBySymbol[sym] = calendar.map((date) => map.get(date) ?? Number.NaN);
  });

  // Precompute 60-day momentum and realized vol per symbol
  const momBySymbol: Record<string, Array<number | null>> = {};
  const volBySymbol: Record<string, Array<number | null>> = {};
  symbols.forEach((sym) => {
    const closes = closesBySymbol[sym];
    momBySymbol[sym] = closes.map((value, idx) => {
      if (idx < MOM_LOOKBACK) return null;
      const past = closes[idx - MOM_LOOKBACK];
      if (!Number.isFinite(past) || past === 0) return null;
      return value / past - 1;
    });
    volBySymbol[sym] = realizedVolatility(closes, VOL_LOOKBACK);
  });

  // Market factor: SPY daily returns aligned to calendar
  const benchCloses = closesBySymbol[benchmark.symbol];
  const mktReturns = benchCloses.map((value, idx) => {
    if (idx === 0) return 0;
    const prev = benchCloses[idx - 1];
    return prev > 0 ? value / prev - 1 : 0;
  });

  const out: FactorReturnsRow[] = [];
  for (let idx = MOM_LOOKBACK + 1; idx < calendar.length; idx += 1) {
    // Rank symbols by SIGNAL at t-1, then average their returns from t-1 → t
    const signalIdx = idx - 1;
    const ranked = symbols
      .map((sym) => ({
        sym,
        mom: momBySymbol[sym][signalIdx],
        vol: volBySymbol[sym][signalIdx],
        ret: closesBySymbol[sym][signalIdx] > 0 ? closesBySymbol[sym][idx] / closesBySymbol[sym][signalIdx] - 1 : 0,
      }))
      .filter((row) => row.mom !== null && row.vol !== null && Number.isFinite(row.ret));
    if (ranked.length < 4) continue;

    const sortedByMom = [...ranked].sort((a, b) => (b.mom as number) - (a.mom as number));
    const sortedByVol = [...ranked].sort((a, b) => (a.vol as number) - (b.vol as number)); // ascending: low vol first
    const half = Math.floor(ranked.length / 2);
    const momLong = mean(sortedByMom.slice(0, half).map((r) => r.ret));
    const momShort = mean(sortedByMom.slice(-half).map((r) => r.ret));
    const volLong = mean(sortedByVol.slice(0, half).map((r) => r.ret)); // low-vol leg
    const volShort = mean(sortedByVol.slice(-half).map((r) => r.ret)); // high-vol leg

    out.push({
      date: calendar[idx],
      mkt: mktReturns[idx],
      mom: momLong - momShort,
      vol: volLong - volShort,
    });
  }

  return out;
}

/**
 * Regress strategy daily returns against [const, MKT, MOM, VOL] via the
 * normal equations. Returns annualized alpha, betas, t-statistics, and R².
 *
 * benchmarkSymbol is metadata only — it documents which series drove the
 * market factor.
 */
export function attributeFactors(
  equityCurve: EquityPoint[],
  factorReturns: FactorReturnsRow[],
  benchmarkSymbol: string,
): FactorAttribution | null {
  if (equityCurve.length < 60 || factorReturns.length < 60) return null;

  // Align strategy returns (computed from equity) to the factor calendar
  const equityByDate = new Map<string, number>();
  equityCurve.forEach((point) => equityByDate.set(point.date, point.equity));

  type Row = { date: string; y: number; x1: number; x2: number; x3: number };
  const rows: Row[] = [];
  for (let i = 1; i < factorReturns.length; i += 1) {
    const today = factorReturns[i];
    const prevDate = factorReturns[i - 1].date;
    const equityToday = equityByDate.get(today.date);
    const equityPrev = equityByDate.get(prevDate);
    if (!Number.isFinite(equityToday) || !Number.isFinite(equityPrev) || (equityPrev as number) === 0) continue;
    const strategyReturn = (equityToday as number) / (equityPrev as number) - 1;
    if (!Number.isFinite(strategyReturn)) continue;
    rows.push({ date: today.date, y: strategyReturn, x1: today.mkt, x2: today.mom, x3: today.vol });
  }
  if (rows.length < 40) return null;

  const n = rows.length;
  // Design matrix [1, x1, x2, x3]
  // Normal equations: (X'X) β = X'y. Build XtX (4x4) and Xty (4).
  const XtX: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const Xty: number[] = [0, 0, 0, 0];
  rows.forEach((r) => {
    const x = [1, r.x1, r.x2, r.x3];
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) XtX[i][j] += x[i] * x[j];
      Xty[i] += x[i] * r.y;
    }
  });

  const inv = invert4(XtX);
  if (!inv) return null;
  const beta = matVec(inv, Xty);
  const [alpha, bMkt, bMom, bVol] = beta;

  // Residuals + variance
  let sse = 0;
  let sst = 0;
  const meanY = rows.reduce((sum, r) => sum + r.y, 0) / n;
  rows.forEach((r) => {
    const yhat = alpha + bMkt * r.x1 + bMom * r.x2 + bVol * r.x3;
    sse += (r.y - yhat) ** 2;
    sst += (r.y - meanY) ** 2;
  });
  const rSquared = sst === 0 ? 0 : 1 - sse / sst;

  // Standard errors: residual variance × diag(inv)
  const dof = n - 4;
  const sigma2 = dof > 0 ? sse / dof : 0;
  const stdErrors = inv.map((row, i) => Math.sqrt(Math.max(sigma2 * row[i], 0)));
  const tStats = {
    alpha: stdErrors[0] === 0 ? 0 : alpha / stdErrors[0],
    mkt: stdErrors[1] === 0 ? 0 : bMkt / stdErrors[1],
    mom: stdErrors[2] === 0 ? 0 : bMom / stdErrors[2],
    vol: stdErrors[3] === 0 ? 0 : bVol / stdErrors[3],
  };

  return {
    alphaDaily: alpha,
    alphaAnnualized: alpha * TRADING_DAYS,
    betas: { mkt: bMkt, mom: bMom, vol: bVol },
    tStats,
    rSquared,
    residualVolatility: Math.sqrt(sigma2 * TRADING_DAYS),
    observations: n,
    startDate: rows[0].date,
    endDate: rows[rows.length - 1].date,
    benchmarkSymbol,
  };
}

function intersectDates(seriesList: string[][]): string[] {
  if (seriesList.length === 0) return [];
  const sorted = [...seriesList].sort((a, b) => a.length - b.length);
  const shortest = sorted[0];
  const others = sorted.slice(1).map((list) => new Set(list));
  return shortest.filter((date) => others.every((set) => set.has(date)));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function matVec(M: number[][], v: number[]): number[] {
  const n = M.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let j = 0; j < n; j += 1) sum += M[i][j] * v[j];
    out[i] = sum;
  }
  return out;
}

/** Invert a small (n ≤ 6) square matrix via Gauss-Jordan elimination. Returns null if singular. */
function invert4(M: number[][]): number[][] | null {
  const n = M.length;
  const a = M.map((row) => row.slice());
  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let i = 0; i < n; i += 1) {
    // pivot
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) {
      if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
    }
    if (Math.abs(a[pivot][i]) < 1e-14) return null;
    if (pivot !== i) {
      [a[i], a[pivot]] = [a[pivot], a[i]];
      [inv[i], inv[pivot]] = [inv[pivot], inv[i]];
    }
    const div = a[i][i];
    for (let j = 0; j < n; j += 1) {
      a[i][j] /= div;
      inv[i][j] /= div;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = a[r][i];
      if (factor === 0) continue;
      for (let j = 0; j < n; j += 1) {
        a[r][j] -= factor * a[i][j];
        inv[r][j] -= factor * inv[i][j];
      }
    }
  }
  return inv;
}

export const __testing = { invert4, intersectDates, mean };
