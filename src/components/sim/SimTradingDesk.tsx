"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import MetricCard from "@/components/cards/MetricCard";
import { num, pct, usd } from "@/lib/utils/format";
import {
  buy,
  sell,
  snapshot,
  summarizePositions,
  createInitialState,
  DEFAULT_STARTING_CAPITAL,
  type SimState,
} from "@/lib/sim/portfolioSim";

export interface SimQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  asOf: string | null;
  isFallback: boolean;
}

interface Props {
  quotes: SimQuote[];
  asOf: string | null;
  anyFallback: boolean;
}

interface ValuePoint {
  ts: number;
  value: number;
}

interface Persisted {
  state: SimState;
  history: ValuePoint[];
}

const STORAGE_KEY = "factorforge_sim_v1";
const money2 = (v: number) => `$${num(v, 2)}`;

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed?.state || typeof parsed.state.cash !== "number") return null;
    return { state: parsed.state, history: Array.isArray(parsed.history) ? parsed.history : [] };
  } catch {
    return null;
  }
}

function persist(data: Persisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full / disabled — the desk still works for this session. */
  }
}

function freshData(): Persisted {
  const now = Date.now();
  const state = createInitialState(DEFAULT_STARTING_CAPITAL, now);
  return { state, history: [{ ts: now, value: state.startingCapital }] };
}

export default function SimTradingDesk({ quotes, asOf, anyFallback }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<Persisted>(() => ({
    state: createInitialState(DEFAULT_STARTING_CAPITAL, 0),
    history: [],
  }));

  // Side / symbol / quantity for the order ticket.
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState<string>(quotes[0]?.symbol ?? "");
  const [qtyStr, setQtyStr] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // localStorage is client-only — load after mount to avoid a hydration mismatch.
  useEffect(() => {
    setData(loadPersisted() ?? freshData());
    setHydrated(true);
  }, []);

  const latestPrices = useMemo(
    () => Object.fromEntries(quotes.map((q) => [q.symbol, q.price])),
    [quotes],
  );
  const quoteFor = useMemo(() => new Map(quotes.map((q) => [q.symbol, q])), [quotes]);

  const snap = useMemo(() => snapshot(data.state, latestPrices), [data.state, latestPrices]);
  const bookSummary = useMemo(() => summarizePositions(snap), [snap]);

  function commit(next: SimState, ts: number) {
    const value = snapshot(next, latestPrices).totalValue;
    const history = [...data.history, { ts, value }];
    const updated = { state: next, history };
    setData(updated);
    persist(updated);
  }

  function submitOrder(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const shares = Number(qtyStr);
    const price = quoteFor.get(symbol)?.price ?? 0;
    const now = Date.now();
    const result = side === "buy" ? buy(data.state, symbol, shares, price, now) : sell(data.state, symbol, shares, price, now);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    commit(result.state, now);
    setQtyStr("");
  }

  function setMax() {
    const price = quoteFor.get(symbol)?.price ?? 0;
    if (price <= 0) return;
    if (side === "buy") {
      setQtyStr(String(Math.floor(data.state.cash / price)));
    } else {
      const held = data.state.positions.find((p) => p.symbol === symbol)?.shares ?? 0;
      setQtyStr(String(held));
    }
  }

  function sellPosition(sym: string, shares: number) {
    setSide("sell");
    setSymbol(sym);
    setQtyStr(String(shares));
    setError(null);
  }

  function reset() {
    if (typeof window !== "undefined" && !window.confirm("Reset your simulated book to $100,000 cash? This clears all positions and history.")) {
      return;
    }
    const next = freshData();
    setData(next);
    persist(next);
    setError(null);
    setQtyStr("");
  }

  if (!hydrated) {
    return (
      <div className="card p-6 text-[13px] text-ink-muted">Loading your simulated desk…</div>
    );
  }

  const price = quoteFor.get(symbol)?.price ?? 0;
  const qty = Number(qtyStr);
  const estimate = Number.isFinite(qty) && qty > 0 ? qty * price : 0;
  const held = data.state.positions.find((p) => p.symbol === symbol)?.shares ?? 0;
  const returnTone = snap.totalReturn >= 0 ? "positive" : "negative";

  return (
    <div className="space-y-6">
      {/* Disclaimer + data freshness */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
          Simulation only · virtual money · no broker
        </span>
        <span className="text-[11.5px] text-ink-soft">
          Fills at the latest close{asOf ? ` (${asOf})` : ""}.{anyFallback ? " Some prices are labeled fallback/demo data." : " Real market data."}
        </span>
      </div>

      {/* Hero: total value + return */}
      <div className="card relative overflow-hidden p-5 md:p-6">
        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-soft">Account value</div>
            <div className="num mt-1 text-[40px] font-semibold leading-none tracking-tight text-white md:text-[52px]">
              {usd(snap.totalValue)}
            </div>
            <div className={`mt-2 text-[15px] font-semibold ${snap.totalReturn >= 0 ? "text-brand-green" : "text-rose-300"}`}>
              {pct(snap.totalReturnPct)} <span className="text-ink-muted font-normal">({snap.totalReturn >= 0 ? "+" : ""}{usd(snap.totalReturn)} vs {usd(data.state.startingCapital)} start)</span>
            </div>
          </div>
          <Sparkline points={data.history.map((h) => h.value)} up={snap.totalReturn >= 0} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total return" value={pct(snap.totalReturnPct)} tone={returnTone} hint={`${usd(snap.totalValue)} total`} />
        <MetricCard label="Cash" value={usd(snap.cash)} hint={`${quotes.length} symbols tradable`} />
        <MetricCard label="Invested" value={usd(snap.investedValue)} hint={`${snap.positions.length} position${snap.positions.length === 1 ? "" : "s"}`} />
        <MetricCard label="Realized P&L" value={usd(snap.realizedPnl)} tone={snap.realizedPnl >= 0 ? "positive" : "negative"} hint={`Unrealized ${usd(snap.unrealizedPnl)}`} />
      </div>

      {/* Book analytics — derived from the snapshot, only meaningful once you hold something */}
      {bookSummary.count > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            label="Open winners"
            value={`${bookSummary.winners} / ${bookSummary.count}`}
            tone={bookSummary.winners >= bookSummary.losers ? "positive" : "negative"}
            hint={`${bookSummary.losers} down`}
          />
          <MetricCard
            label="Top concentration"
            value={`${(bookSummary.topWeight * 100).toFixed(1)}%`}
            hint={bookSummary.topSymbol ? `${bookSummary.topSymbol} largest` : undefined}
            tone={bookSummary.topWeight > 0.4 ? "negative" : "default"}
          />
          <MetricCard
            label="Best position"
            value={bookSummary.bestPosition ? pct(bookSummary.bestPosition.unrealizedPct) : "—"}
            tone="positive"
            hint={bookSummary.bestPosition?.symbol}
          />
          <MetricCard
            label="Invested"
            value={`${(bookSummary.investedWeight * 100).toFixed(0)}%`}
            hint={`${(100 - bookSummary.investedWeight * 100).toFixed(0)}% cash`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Holdings */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Holdings</h2>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-line bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-ink-muted transition-colors hover:text-ink"
            >
              Reset book
            </button>
          </div>

          {snap.positions.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-muted">No positions yet. Use the order ticket to buy your first name.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.14em] text-ink-soft">
                    <th className="pb-2 pr-3 font-medium">Symbol</th>
                    <th className="pb-2 pr-3 text-right font-medium">Shares</th>
                    <th className="pb-2 pr-3 text-right font-medium">Avg cost</th>
                    <th className="pb-2 pr-3 text-right font-medium">Last</th>
                    <th className="pb-2 pr-3 text-right font-medium">Mkt value</th>
                    <th className="pb-2 pr-3 text-right font-medium">Unrealized</th>
                    <th className="pb-2 pr-3 text-right font-medium">Weight</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {snap.positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-line/60">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-ink">{p.symbol}</div>
                        <div className="text-[11px] text-ink-soft">{quoteFor.get(p.symbol)?.name ?? ""}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-right num text-ink">{num(p.shares, 0)}</td>
                      <td className="py-2.5 pr-3 text-right num text-ink-muted">{money2(p.avgCost)}</td>
                      <td className="py-2.5 pr-3 text-right num text-ink">{money2(p.lastPrice)}</td>
                      <td className="py-2.5 pr-3 text-right num text-ink">{usd(p.marketValue)}</td>
                      <td className={`py-2.5 pr-3 text-right num ${p.unrealizedPnl >= 0 ? "text-brand-green" : "text-rose-300"}`}>
                        {usd(p.unrealizedPnl)}
                        <span className="ml-1 text-[11px] opacity-80">({pct(p.unrealizedPct)})</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right num text-ink-muted">{(p.weight * 100).toFixed(1)}%</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => sellPosition(p.symbol, p.shares)}
                          className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-100 transition-colors hover:bg-rose-400/20"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order ticket */}
        <div className="card p-5">
          <h2 className="text-[15px] font-semibold text-ink">Order ticket</h2>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setSide("buy"); setError(null); }}
              className={`h-9 rounded-lg border text-[13px] font-semibold transition-colors ${side === "buy" ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100" : "border-line bg-white/[0.04] text-ink-muted hover:text-ink"}`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => { setSide("sell"); setError(null); }}
              className={`h-9 rounded-lg border text-[13px] font-semibold transition-colors ${side === "sell" ? "border-rose-300/45 bg-rose-400/15 text-rose-100" : "border-line bg-white/[0.04] text-ink-muted hover:text-ink"}`}
            >
              Sell
            </button>
          </div>

          <form onSubmit={submitOrder} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">Symbol</span>
              <select
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value); setError(null); }}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-white/[0.04] px-3 text-[13px] text-ink focus:border-blue-400/45 focus:outline-none"
              >
                {quotes.map((q) => (
                  <option key={q.symbol} value={q.symbol}>
                    {q.symbol} — {q.name} ({money2(q.price)})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">Shares</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={qtyStr}
                  onChange={(e) => { setQtyStr(e.target.value); setError(null); }}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-line bg-white/[0.04] px-3 text-[13px] text-ink focus:border-blue-400/45 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={setMax}
                  className="h-10 shrink-0 rounded-xl border border-line bg-white/[0.04] px-3 text-[12px] text-ink-muted transition-colors hover:text-ink"
                >
                  Max
                </button>
              </div>
            </label>

            <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-[12px] text-ink-muted">
              <div className="flex items-center justify-between">
                <span>Price</span>
                <span className="num text-ink">{money2(price)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>{side === "buy" ? "Estimated cost" : "Estimated proceeds"}</span>
                <span className="num text-ink">{usd(estimate)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>{side === "buy" ? "Buying power" : "Shares held"}</span>
                <span className="num text-ink">{side === "buy" ? usd(snap.cash) : `${num(held, 0)}`}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-[12.5px] text-rose-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              className={`h-11 w-full rounded-xl border text-[14px] font-semibold transition-colors ${side === "buy" ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25" : "border-rose-300/40 bg-rose-400/15 text-rose-100 hover:bg-rose-400/25"}`}
            >
              {side === "buy" ? "Buy" : "Sell"} {symbol}
            </button>
          </form>
        </div>
      </div>

      {/* Trade log */}
      {data.state.trades.length > 0 && (
        <div className="card p-5">
          <h2 className="text-[15px] font-semibold text-ink">Trade log</h2>
          <div className="mt-3 space-y-1.5">
            {data.state.trades.slice(0, 20).map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/50 py-1.5 text-[12.5px]">
                <span className={`w-10 shrink-0 font-semibold ${t.side === "buy" ? "text-emerald-200" : "text-rose-200"}`}>
                  {t.side === "buy" ? "BUY" : "SELL"}
                </span>
                <span className="num font-medium text-ink">{num(t.shares, 0)} {t.symbol}</span>
                <span className="num text-ink-muted">@ {money2(t.price)}</span>
                {t.side === "sell" && (
                  <span className={`num ${t.realized >= 0 ? "text-brand-green" : "text-rose-300"}`}>
                    realized {usd(t.realized)}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-ink-soft">{new Date(t.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) {
    return (
      <div className="grid h-[120px] place-items-center rounded-xl border border-line bg-white/[0.02] text-[12px] text-ink-soft">
        Your account-value line appears here after your first trade.
      </div>
    );
  }
  const w = 600;
  const h = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <div className={up ? "text-brand-green" : "text-rose-300"}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[120px] w-full" role="img" aria-label="Account value over time">
        <path d={area} fill="currentColor" opacity={0.1} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
