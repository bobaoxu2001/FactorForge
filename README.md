# AI Quant Research Lab

A real-market-data-driven MVP for AI stock strategy research. Core workflow:

**Real data -> core factors -> strategy rules -> backtest metrics -> radar screening -> paper observation -> research reports**

> This platform is for research and simulated trading demonstration only. It does not constitute investment advice. Historical backtests do not represent future returns.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Quality checks:

```bash
npm run lint
npm run build
```

## Data source

- Uses Yahoo Finance chart API for 1y / 3y daily OHLCV by default.
- `getHistoricalPrices(symbol, range)` lives in `src/lib/data/marketData.ts`.
- Provider output is normalized to `{ date, open, high, low, close, volume }`.
- Request failures, empty data, or insufficient bars return deterministic fallback data, and the UI labels it as `fallback/demo`.
- `.env.example` reserves Alpha Vantage / Polygon / Twelve Data keys for future provider replacement.

## Current MVP

- Default US watchlist: AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL, JPM, SPY, QQQ
- Indicators: SMA, EMA, RSI, ATR, rolling high/low, volume MA, percent change, realized volatility, max drawdown
- Strategies:
  - VCP Tight-Base Breakout Candidate
  - Keltner ATR Breakout Candidate
  - SMA200 RSI Defensive Pullback
  - EMA Trend Pullback Candidate
  - Low-Volatility Rotation Proxy, explicitly labeled with dividend component not connected yet
- Backtest:
  - long-only
  - initial capital 100000
  - fixed 20% position fraction
  - stop loss, trailing stop, holding-period expiry, and moving-average breakdown exits
  - outputs trades, equity curve, benchmark comparison, drawdown, and core metrics
- Radar:
  - scores annualized return, Sharpe, max drawdown, win rate, trade count, and risk penalty
  - strategies meeting thresholds enter paper-observation mode
- AI-style text:
  - no external LLM call
  - generated deterministically from real metrics as summary, risk, and next step

## Project layout

```text
src/
  app/                         Next.js routes
  components/
    layout/                    App shell and navigation
    cards/                     Metric, strategy, module, market cards
    charts/                    Equity and drawdown charts
    badges/                    Status/risk badges
    research/                  Backtest/data/signal panels
  data/                        Strategy catalog and watchlist
  lib/
    data/                      Market data facade and providers
    quant/                     Indicators, strategies, backtest, metrics, radar, paper trading
    ai/                        Deterministic analysis text
    utils/                     Formatting helpers
  types/                       Market, strategy and backtest contracts
```

## Production gaps

- Yahoo chart API is convenient for MVP work but does not provide a production data SLA.
- No persistent database yet; server memory and Next fetch cache are used.
- No scheduled ingestion or backtest jobs yet.
- No authenticated users or custom strategy DSL yet.
- Paper trading is simulated observation only; no broker API is connected.
