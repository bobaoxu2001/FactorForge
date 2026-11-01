/**
 * Return attribution and multiple-testing math for the company quant lens.
 *
 *  - `ols` is ordinary least squares with an intercept, standard errors and
 *    t-statistics (homoskedastic; daily returns make this approximate).
 *  - `marketSectorAttribution` regresses a stock's daily returns on the market
 *    (SPY) and a sector spread (IYT − SPY), which separates "the market moved",
 *    "transports moved" and "this company moved".
 *  - `expectedMaxSharpe` is the Sharpe ratio the BEST of N skill-less strategies
 *    would show by luck (Bailey & López de Prado's false-strategy approximation),
 *    used to haircut a best-of-N backtest.
 */

export interface OlsResult {
  coefficients: number[];
  standardErrors: number[];
  tStats: number[];
  rSquared: number;
  residualSd: number;
  n: number;
}

/** Solve A x = b by Gaussian elimination with partial pivoting. Returns null if singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-14) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

function invert(a: number[][]): number[][] | null {
  const n = a.length;
  const columns: number[][] = [];
  for (let j = 0; j < n; j += 1) {
    const e = Array.from({ length: n }, (_, i) => (i === j ? 1 : 0));
    const col = solve(a, e);
    if (!col) return null;
    columns.push(col);
  }
  return Array.from({ length: n }, (_, i) => columns.map((col) => col[i]));
}

/** OLS of y on [1, ...X columns]. Coefficient 0 is the intercept. */
export function ols(y: number[], regressors: number[][]): OlsResult | null {
  const n = y.length;
  const k = regressors.length + 1;
  if (n <= k + 1 || regressors.some((col) => col.length !== n)) return null;
  const row = (i: number) => [1, ...regressors.map((col) => col[i])];
  const xtx = Array.from({ length: k }, () => Array(k).fill(0));
  const xty = Array(k).fill(0);
  for (let i = 0; i < n; i += 1) {
    const x = row(i);
    for (let a = 0; a < k; a += 1) {
      xty[a] += x[a] * y[i];
      for (let b = 0; b < k; b += 1) xtx[a][b] += x[a] * x[b];
    }
  }
  const beta = solve(xtx, xty);
  const inv = invert(xtx);
  if (!beta || !inv) return null;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < n; i += 1) {
    const fitted = row(i).reduce((s, x, j) => s + x * beta[j], 0);
    sse += (y[i] - fitted) ** 2;
    sst += (y[i] - meanY) ** 2;
  }
  const sigma2 = sse / (n - k);
  const standardErrors = inv.map((r, i) => Math.sqrt(Math.max(0, r[i] * sigma2)));
  return {
    coefficients: beta,
    standardErrors,
    tStats: beta.map((b, i) => (standardErrors[i] > 0 ? b / standardErrors[i] : 0)),
    rSquared: sst > 0 ? 1 - sse / sst : 0,
    residualSd: Math.sqrt(sigma2),
    n,
  };
}

export interface PricePoint {
  date: string;
  close: number;
}

/** Daily simple returns keyed by date, from a total-return (dividend-adjusted) close series. */
export function dailyReturnMap(prices: PricePoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1].close;
    if (prev > 0) out.set(prices[i].date, prices[i].close / prev - 1);
  }
  return out;
}

export interface MarketSectorAttribution {
  start: string;
  end: string;
  n: number;
  alphaAnnualized: number;
  alphaT: number;
  marketBeta: number;
  marketT: number;
  sectorBeta: number;
  sectorT: number;
  rSquared: number;
  residualVolAnnualized: number;
}

export function alignedReturns(
  stock: PricePoint[],
  market: PricePoint[],
  sector: PricePoint[],
  start?: string,
  end?: string,
): { dates: string[]; y: number[]; mkt: number[]; sec: number[] } {
  const s = dailyReturnMap(stock);
  const m = dailyReturnMap(market);
  const k = dailyReturnMap(sector);
  const dates = [...s.keys()]
    .filter((d) => m.has(d) && k.has(d) && (!start || d > start) && (!end || d <= end))
    .sort();
  return {
    dates,
    y: dates.map((d) => s.get(d) as number),
    mkt: dates.map((d) => m.get(d) as number),
    sec: dates.map((d) => (k.get(d) as number) - (m.get(d) as number)),
  };
}

export function marketSectorAttribution(
  stock: PricePoint[],
  market: PricePoint[],
  sector: PricePoint[],
  start?: string,
  end?: string,
): MarketSectorAttribution | null {
  const { dates, y, mkt, sec } = alignedReturns(stock, market, sector, start, end);
  if (dates.length < 120) return null;
  const fit = ols(y, [mkt, sec]);
  if (!fit) return null;
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    n: fit.n,
    alphaAnnualized: fit.coefficients[0] * 252,
    alphaT: fit.tStats[0],
    marketBeta: fit.coefficients[1],
    marketT: fit.tStats[1],
    sectorBeta: fit.coefficients[2],
    sectorT: fit.tStats[2],
    rSquared: fit.rSquared,
    residualVolAnnualized: fit.residualSd * Math.sqrt(252),
  };
}

export interface ReturnDecomposition {
  start: string;
  end: string;
  days: number;
  total: number;
  market: number;
  sector: number;
  residual: number;
}

/**
 * Split realised return over (start, end] into market, sector and residual
 * pieces using betas estimated BEFORE `start` (no look-ahead). Sums of daily
 * returns are used so the pieces add up exactly; this approximates compounded
 * returns closely over short windows.
 */
export function decomposeReturn(
  stock: PricePoint[],
  market: PricePoint[],
  sector: PricePoint[],
  betas: { marketBeta: number; sectorBeta: number },
  start: string,
  end?: string,
): ReturnDecomposition | null {
  const { dates, y, mkt, sec } = alignedReturns(stock, market, sector, start, end);
  if (dates.length === 0) return null;
  const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
  const total = sum(y);
  const marketPart = betas.marketBeta * sum(mkt);
  const sectorPart = betas.sectorBeta * sum(sec);
  return {
    start,
    end: dates[dates.length - 1],
    days: dates.length,
    total,
    market: marketPart,
    sector: sectorPart,
    residual: total - marketPart - sectorPart,
  };
}

// ── Multiple testing ────────────────────────────────────────────────────────

/** Inverse standard-normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const EULER_GAMMA = 0.5772156649015329;

/**
 * Expected maximum annualised Sharpe ratio among `trials` independent strategies
 * with zero true Sharpe, each estimated over `years` of data.
 * E[max Z_N] ≈ (1−γ)Φ⁻¹(1−1/N) + γΦ⁻¹(1−1/(N·e)); SR estimation error ≈ 1/√years.
 */
export function expectedMaxSharpe(trials: number, years: number): number {
  if (trials <= 1 || years <= 0) return 0;
  const z = (1 - EULER_GAMMA) * inverseNormalCdf(1 - 1 / trials) + EULER_GAMMA * inverseNormalCdf(1 - 1 / (trials * Math.E));
  return z / Math.sqrt(years);
}
