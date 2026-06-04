import "server-only";

const DEFAULT_BASE_URL = "https://paper-api.alpaca.markets";

export interface AlpacaPaperAccount {
  status: string;
  currency: string;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  equity: number;
}

export interface AlpacaPaperPosition {
  symbol: string;
  qty: number;
  marketValue: number;
  avgEntryPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  side: string;
}

export interface AlpacaPaperOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  qty: number;
  filledQty: number;
  submittedAt: string | null;
  filledAt: string | null;
}

export interface AlpacaPaperSnapshot {
  status: "disabled" | "connected" | "error";
  provider: "alpaca-paper";
  baseUrl: string;
  updatedAt: string;
  message: string;
  account: AlpacaPaperAccount | null;
  positions: AlpacaPaperPosition[];
  orders: AlpacaPaperOrder[];
}

export interface AlpacaPaperEnv {
  ALPACA_PAPER_API_KEY_ID?: string;
  ALPACA_PAPER_API_SECRET?: string;
  ALPACA_PAPER_BASE_URL?: string;
}

type FetchLike = typeof fetch;

export async function fetchAlpacaPaperSnapshot(
  options: { env?: AlpacaPaperEnv; fetchImpl?: FetchLike; orderLimit?: number } = {},
): Promise<AlpacaPaperSnapshot> {
  const env = options.env ?? process.env;
  const baseUrl = sanitizeBaseUrl(env.ALPACA_PAPER_BASE_URL);
  const keyId = env.ALPACA_PAPER_API_KEY_ID?.trim();
  const secret = env.ALPACA_PAPER_API_SECRET?.trim();
  const updatedAt = new Date().toISOString();

  if (!keyId || !secret) {
    return {
      status: "disabled",
      provider: "alpaca-paper",
      baseUrl,
      updatedAt,
      message: "Alpaca paper sync is disabled because paper API credentials are not configured.",
      account: null,
      positions: [],
      orders: [],
    };
  }

  const fetcher = options.fetchImpl ?? fetch;
  const headers = {
    accept: "application/json",
    "APCA-API-KEY-ID": keyId,
    "APCA-API-SECRET-KEY": secret,
  };

  try {
    const orderLimit = Math.max(1, Math.min(50, Math.floor(options.orderLimit ?? 20)));
    const [accountRaw, positionsRaw, ordersRaw] = await Promise.all([
      fetchJson<AlpacaAccountResponse>(fetcher, `${baseUrl}/v2/account`, headers),
      fetchJson<AlpacaPositionResponse[]>(fetcher, `${baseUrl}/v2/positions`, headers),
      fetchJson<AlpacaOrderResponse[]>(
        fetcher,
        `${baseUrl}/v2/orders?status=all&limit=${orderLimit}&direction=desc`,
        headers,
      ),
    ]);

    return {
      status: "connected",
      provider: "alpaca-paper",
      baseUrl,
      updatedAt,
      message: "Read-only Alpaca paper account, positions, and recent orders synced.",
      account: normalizeAccount(accountRaw),
      positions: positionsRaw.map(normalizePosition),
      orders: ordersRaw.map(normalizeOrder),
    };
  } catch (error) {
    return {
      status: "error",
      provider: "alpaca-paper",
      baseUrl,
      updatedAt,
      message: `Alpaca paper sync failed: ${errorMessage(error)}`,
      account: null,
      positions: [],
      orders: [],
    };
  }
}

async function fetchJson<T>(fetcher: FetchLike, url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetcher(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function sanitizeBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed.replace(/\/+$/, "");
}

interface AlpacaAccountResponse {
  status?: string;
  currency?: string;
  cash?: string;
  buying_power?: string;
  portfolio_value?: string;
  equity?: string;
}

interface AlpacaPositionResponse {
  symbol?: string;
  qty?: string;
  market_value?: string;
  avg_entry_price?: string;
  unrealized_pl?: string;
  unrealized_plpc?: string;
  side?: string;
}

interface AlpacaOrderResponse {
  id?: string;
  symbol?: string;
  side?: string;
  type?: string;
  status?: string;
  qty?: string;
  filled_qty?: string;
  submitted_at?: string | null;
  filled_at?: string | null;
}

function normalizeAccount(raw: AlpacaAccountResponse): AlpacaPaperAccount {
  return {
    status: raw.status ?? "unknown",
    currency: raw.currency ?? "USD",
    cash: numberFromString(raw.cash),
    buyingPower: numberFromString(raw.buying_power),
    portfolioValue: numberFromString(raw.portfolio_value),
    equity: numberFromString(raw.equity),
  };
}

function normalizePosition(raw: AlpacaPositionResponse): AlpacaPaperPosition {
  return {
    symbol: raw.symbol ?? "UNKNOWN",
    qty: numberFromString(raw.qty),
    marketValue: numberFromString(raw.market_value),
    avgEntryPrice: numberFromString(raw.avg_entry_price),
    unrealizedPnl: numberFromString(raw.unrealized_pl),
    unrealizedPnlPct: numberFromString(raw.unrealized_plpc),
    side: raw.side ?? "unknown",
  };
}

function normalizeOrder(raw: AlpacaOrderResponse): AlpacaPaperOrder {
  return {
    id: raw.id ?? "",
    symbol: raw.symbol ?? "UNKNOWN",
    side: raw.side ?? "unknown",
    type: raw.type ?? "unknown",
    status: raw.status ?? "unknown",
    qty: numberFromString(raw.qty),
    filledQty: numberFromString(raw.filled_qty),
    submittedAt: raw.submitted_at ?? null,
    filledAt: raw.filled_at ?? null,
  };
}

function numberFromString(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
