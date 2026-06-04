import { describe, expect, it, vi } from "vitest";
import { fetchAlpacaPaperSnapshot } from "./alpacaPaper";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchAlpacaPaperSnapshot", () => {
  it("is disabled when paper credentials are absent", async () => {
    const fetchImpl = vi.fn();
    const snapshot = await fetchAlpacaPaperSnapshot({ env: {}, fetchImpl });

    expect(snapshot.status).toBe("disabled");
    expect(snapshot.account).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("syncs account, positions, and recent orders with read-only GET requests", async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith("/v2/account")) {
        return jsonResponse({
          status: "ACTIVE",
          currency: "USD",
          cash: "98000.50",
          buying_power: "196001",
          portfolio_value: "101250",
          equity: "101250",
        });
      }
      if (url.endsWith("/v2/positions")) {
        return jsonResponse([
          {
            symbol: "AAPL",
            qty: "10",
            market_value: "2000",
            avg_entry_price: "190",
            unrealized_pl: "100",
            unrealized_plpc: "0.0526",
            side: "long",
          },
        ]);
      }
      return jsonResponse([
        {
          id: "order-1",
          symbol: "AAPL",
          side: "buy",
          type: "market",
          status: "filled",
          qty: "10",
          filled_qty: "10",
          submitted_at: "2026-06-04T13:30:00Z",
          filled_at: "2026-06-04T13:30:01Z",
        },
      ]);
    });

    const snapshot = await fetchAlpacaPaperSnapshot({
      env: {
        ALPACA_PAPER_API_KEY_ID: "paper-key",
        ALPACA_PAPER_API_SECRET: "paper-secret",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      orderLimit: 5,
    });

    expect(snapshot.status).toBe("connected");
    expect(snapshot.account?.portfolioValue).toBe(101250);
    expect(snapshot.positions[0]).toMatchObject({ symbol: "AAPL", qty: 10, unrealizedPnl: 100 });
    expect(snapshot.orders[0]).toMatchObject({ id: "order-1", status: "filled", filledQty: 10 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const call of fetchImpl.mock.calls) {
      expect(call[1]).toMatchObject({
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": "paper-key",
          "APCA-API-SECRET-KEY": "paper-secret",
        },
      });
    }
    expect(fetchImpl.mock.calls.map((call) => call[0])).toContain("https://paper-api.alpaca.markets/v2/orders?status=all&limit=5&direction=desc");
  });

  it("returns an error snapshot when Alpaca rejects the request", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "nope" }, 401));
    const snapshot = await fetchAlpacaPaperSnapshot({
      env: {
        ALPACA_PAPER_API_KEY_ID: "paper-key",
        ALPACA_PAPER_API_SECRET: "paper-secret",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toMatch(/HTTP 401/);
  });
});
