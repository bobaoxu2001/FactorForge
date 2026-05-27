# FactorForge

[![CI](https://github.com/bobaoxu2001/FactorForge/actions/workflows/ci.yml/badge.svg)](https://github.com/bobaoxu2001/FactorForge/actions/workflows/ci.yml)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vitest](https://img.shields.io/badge/tests-26%20passing-22c55e?logo=vitest&logoColor=white)](#testing)

An AI quant research lab that turns daily OHLCV into factor signals, cost-aware backtests, score-weighted portfolios, and LLM-written research memos. Built as a portfolio piece for a full-stack + applied-ML role.

> Research and simulated trading demonstration only. No broker connection, no live orders. Historical backtests do not represent future returns.

---

## Why this project is interesting

| | |
|---|---|
| **Real LLM in the loop** | DeepSeek (`deepseek-chat`) writes the strategy memo and tape note from a deterministic backtest payload. Numbers come from the engine; only prose is generated. Template fallback when the key is unset. |
| **Multi-symbol portfolio engine** | Score-weighted blend of radar-eligible legs, calendar intersection, per-leg P&L attribution, and pairwise Pearson correlation. Not just N parallel backtests. |
| **Persisted compute** | SQLite-backed cache keyed by a market/benchmark fingerprint (symbol, row count, first/last bar, fallback/adjusted flags) + 6h TTL. A fresh data fetch auto-invalidates stale entries. |
| **Honest data provenance** | Every result carries provider, freshness, adjusted-close flag, row count, and an `isFallback` boolean surfaced in the UI. Demo data is never silently promoted to real evidence. |
| **CI and tests** | 26 vitest tests (engine + components) under jsdom; GitHub Actions runs lint + typecheck + test on every push. |

---

## Architecture

```mermaid
flowchart TB
  subgraph DATA["Data Layer"]
    YH[Yahoo Finance<br/>chart API]
    FB[Deterministic<br/>fallback data]
    YH -.failure.-> FB
  end

  subgraph QUANT["Quant Engine (src/lib/quant)"]
    NORM[Market data normalization<br/>adjusted close, OHLCV, quality flags]
    IND[Indicators<br/>SMA / EMA / RSI / ATR / vol]
    SIG[Strategy signal plans<br/>5 strategies in catalog]
    BT[Long-only backtest<br/>next-open exec, slippage,<br/>stops, trailing, holding cap]
    MET[Metrics<br/>Sharpe, drawdown, profit factor]
    RAD[Radar scoring<br/>composite + hard rejects]
    PORT[Portfolio engine<br/>weighting + correlation matrix]
  end

  subgraph PERSIST["Persistence (src/lib/persistence)"]
    DB[(SQLite<br/>.cache/factorforge.db)]
  end

  subgraph AI["AI Layer (src/lib/ai)"]
    DS[DeepSeek client<br/>server-only, JSON mode]
    EXP[Strategy explainer<br/>memo + thesis]
    MS[Market summary<br/>regime + highlights]
  end

  subgraph UI["Next.js App Router (src/app)"]
    HOME[/]
    STRAT[/strategies/:id]
    RADAR[/radar]
    PFOL[/portfolio]
    PAPER[/paper-trading]
    AIM[/ai-market]
    REP[/reports]
  end

  YH --> NORM
  FB --> NORM
  NORM --> IND --> SIG --> BT --> MET
  BT <-.cache by fingerprint.-> DB
  MET --> RAD --> PORT
  MET --> EXP
  IND --> MS
  EXP --> DS
  MS --> DS
  MET --> UI
  RAD --> UI
  PORT --> UI
  EXP --> UI
  MS --> UI
```

The page-level data flow is consolidated in `src/lib/research.ts → getResearchDataset()`, which is the single entry point all routes call.

---

## Module map

```text
src/
  app/                     Next.js routes (server components by default)
    page.tsx               Overview / proof-moment dashboard
    strategies/[id]        Per-strategy backtest + LLM memo
    radar/                 Composite scoring + verdicts
    portfolio/             Multi-symbol blended backtest + correlation
    paper-trading/         Simulated observation queue + risk budget
    ai-market/             Market regime memo
    reports/               Auto-generated research cards
    factors/, data/        Factor table and data provenance
  components/
    cards, badges, charts, layout, research
  lib/
    data/                  Market data facade + Yahoo provider + fallback
    quant/                 indicators, strategies, backtest, metrics,
                           radar, paper trading, portfolio
    persistence/           SQLite client + backtest cache
    ai/                    DeepSeek client + strategy explainer +
                           market summary (both LLM-or-template)
    utils/                 formatters
  types/                   market, strategy, backtest contracts
```

---

## Strategy catalog

| ID | Name | Type | Default symbol |
|---|---|---|---|
| `vcp-tight-breakout` | Quality Momentum Breakout | breakout | NVDA |
| `keltner-atr-breakout` | ATR Channel Expansion | breakout | MSFT |
| `sma200-rsi-pullback` | Defensive Trend Pullback | mean reversion | AAPL |
| `ema-trend-pullback` | EMA Continuation Signal | momentum | AMZN |
| `lowvol-rotation-proxy` | Low-Volatility Rotation | rotation | SPY |

Per-strategy notes (e.g. *"dividend component not connected yet"*) live on the strategy definition (`knownLimitations`), not hard-coded in the engine — adding a new flagged strategy doesn't require touching the runner.

---

## Quant engine — what's modeled and what isn't

**Modeled**
- Next-open execution: signals from completed daily bars fill at the next bar's open.
- Modeled slippage (bps) and per-trade fees, applied symmetrically on entry/exit.
- Stop loss, trailing stop, max-holding-days exit; strategy-level sell signals.
- Daily mark-to-market equity curve; benchmark equity sampled on the same calendar.
- Risk-adjusted metrics: total / annualized return, Sharpe, profit factor, win rate, max drawdown, volatility (all from the equity series, not invented).
- Portfolio: score-weighted blend across legs with calendar intersection, per-leg contribution attribution, Pearson correlation of daily returns.

**Not modeled (called out, not hidden)**
- No multi-asset capital rebalancing inside a leg — each leg keeps its own internal entries.
- No risk-free rate adjustment in Sharpe; reported as raw return / vol.
- Low-Volatility Rotation has no dividend input; flagged via `knownLimitations`.
- No options, no shorts, no margin.

---

## AI layer — what DeepSeek does and doesn't do

DeepSeek is given a JSON payload of the deterministic backtest result and is told to write **only prose**. It cannot fabricate numbers because:
- The `confidenceScore` and `confidenceLevel` are computed in code and **passed through** the merge step — the LLM cannot overwrite them.
- The system prompt explicitly instructs "reference only metrics that appear in the user payload" and "if `isFallback=true`, label that tape as demo data".
- All seven LLM-controlled fields are wrapped in `pickString` so a bad/empty response silently falls back to the template version.

Caching is per `(strategyId, symbol, lastSignalDate, tradeCount, dataQuality)` — re-renders against a stable backtest don't re-hit the API.

`DEEPSEEK_API_KEY` unset → entire AI layer transparently downgrades to the deterministic template. The UI shows a `template memo` badge instead of `deepseek memo`.

---

## Persistence — what's actually in SQLite

```sql
CREATE TABLE backtest_cache (
  cache_key   TEXT PRIMARY KEY,   -- "<strategyId>::<symbol>::<sha1[0:16]>"
  strategy_id TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  fingerprint TEXT NOT NULL,      -- JSON of market/benchmark identity
  payload     TEXT NOT NULL,      -- BacktestResult JSON
  created_at  INTEGER NOT NULL
);
```

The fingerprint hash covers: strategyId, market symbol + row count + first/last date + fallback/adjusted flags, benchmark symbol + row count + last date + fallback. A fresh Yahoo pull that returns new bars (or flips the fallback flag) produces a new key automatically. On top of that, a 6-hour TTL bounds staleness even if the fingerprint matches.

WAL journal mode is enabled. If the native binding fails to load (missing prebuild, sandboxed environment), `getDb()` returns `null` and the engine quietly runs uncached — no crash.

---

## Run locally

```bash
git clone https://github.com/bobaoxu2001/FactorForge.git
cd FactorForge
npm install
cp .env.example .env.local   # optional: add DEEPSEEK_API_KEY for LLM memos
npm run dev                  # http://localhost:3000
```

Quality checks (the same set CI runs):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

**Environment variables**

| Variable | Required? | What it does |
|---|---|---|
| `DEEPSEEK_API_KEY` | optional | Enables LLM-written strategy memo + market tape note. Without it the platform uses the deterministic template and labels the source as `template memo`. |
| `ALPHA_VANTAGE_API_KEY`, `POLYGON_API_KEY`, `TWELVE_DATA_API_KEY` | unused (reserved) | Placeholders for future provider fan-out. Yahoo chart API works without a key. |

---

## Testing

26 tests across 10 files under vitest + jsdom:

- **Engine** — backtest fees + execution semantics, indicators, radar verdict logic, paper-trading risk-budget transitions, portfolio engine (Pearson, calendar intersection, score-weighted blend, phase-shifted decorrelation).
- **Components** — StatusBadge (including the `idle` state introduced when fixing the zero-observation risk-budget bug), MetricCard tone classes, CorrelationMatrix rendering + empty state.
- **Data providers** — Yahoo and fallback adapters.

Run them locally with `npm test`. CI runs the same command on every push and PR; see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Tech stack

- **Next.js 14** App Router, all data fetching in server components
- **TypeScript** strict mode
- **Tailwind CSS** with a dark research-lab token system
- **Recharts** for equity / drawdown / portfolio curves
- **better-sqlite3** for the backtest cache (WAL)
- **DeepSeek** (`deepseek-chat`) via OpenAI-compatible JSON mode
- **Vitest** + **Testing Library** + **jsdom**
- **GitHub Actions** for lint / typecheck / test on push

---

## What I'd build next

In rough ROI order:

1. **Walk-forward / out-of-sample evaluation** — split the calendar into train / test, fit signal thresholds on train, report metrics only from test. Honest answer to "is this overfit?".
2. **Factor attribution** — regress strategy returns against momentum / volatility / market factors to separate alpha from known-factor exposure.
3. **Real broker integration** — Alpaca paper API for actual order flow on radar candidates (paper only, gated by `riskBudgetStatus`).
4. **Provider fan-out** — Polygon / Alpha Vantage as second-tier real data, not just fallback-to-demo.
5. **Multi-user** — Clerk/Auth.js + per-user watchlists in SQLite.

---

## Disclaimer

This platform is for research and simulated trading demonstration only. It does not constitute investment advice. Historical backtests do not represent future returns.
