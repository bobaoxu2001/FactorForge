# FactorForge

FactorForge is an AI quant research lab that turns real market data into factor signals, backtested strategy evidence, radar-ranked candidates, and simulated paper-observation insights.

> Research and simulated trading demonstration only. This project does not provide investment advice. Historical backtests do not represent future returns.

## Product Overview

FactorForge is not a retail trading terminal. It is a desktop web SaaS demo for an AI-powered research workflow:

**Real Market Data -> Factor Discovery -> AI Strategy Generation -> Backtesting -> Radar Screening -> Paper Observation -> Research Reports**

The interface is built as a premium dark research lab with dense metrics, transparent data provenance, AI-style research notes, and cost-aware backtest assumptions.

## Live Demo

Live demo placeholder: add your Vercel deployment URL here.

## Screenshots

Add screenshots after deployment:

- `Overview` dashboard with six-layer research architecture
- `Strategy Detail` with AI thesis, backtest metrics, equity curve, and risk flags
- `Factors` console with factor hypotheses and snapshot table
- `Radar` screening workflow and paper-observation queue

## Features

- Real Yahoo Finance chart API ingestion for daily OHLCV
- Adjusted-close awareness with provider, row count, coverage, and freshness metadata
- Deterministic fallback/demo data with explicit UI labeling
- Factor discovery across momentum, volatility, volume, trend, and quality proxies
- Strategy catalog with polished research-oriented strategy names
- Long-only backtest engine with next-open execution, slippage, fees, stops, trailing stops, and holding-period exits
- Radar scoring with annualized return, Sharpe, drawdown, win rate, trade count, and risk penalties
- Simulated paper-observation queue for radar-approved strategies
- AI-style research summaries, strategy theses, confidence scores, risk flags, and suggested experiments
- Production-ready dark SaaS UI built for portfolio/demo presentation

## What Makes This Real

This is designed as a research workflow prototype, not an AI stock picker and not a static mockup.

- No hardcoded strategy returns: annualized return, Sharpe, drawdown, win rate, trades, and equity curves are calculated from backtests.
- Market data comes from Yahoo Finance chart API daily OHLCV for the default US equity universe.
- The home page includes a proof moment showing how a symbol moves from fetched data to signals, backtest metrics, radar score, and paper-observation decision.
- The overview includes a live market pulse for the Magnificent Seven plus SPY, QQQ, and JPM using latest close data.
- Every provider result carries source, freshness, adjusted-close, row-count, coverage, and fallback metadata.
- Fallback/demo data is allowed for resilience, but it is always explicitly labeled and never presented as real validation.
- Paper trading is simulated observation only; the platform does not connect to a broker or place real orders.

## Architecture

```text
Yahoo Finance / Fallback Provider
  -> Market Data Normalization
  -> Factor Snapshot Layer
  -> Strategy Signal Generation
  -> Cost-Aware Backtest Engine
  -> Metrics + Radar Scoring
  -> AI-Style Research Reports
  -> Simulated Paper Observation
```

## Data Pipeline

- Default universe: AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL, JPM, SPY, QQQ
- Provider: Yahoo Finance chart API
- Ranges: 1y and 3y daily OHLCV
- Normalized output includes open, high, low, close, volume, raw close, adjusted close, adjustment ratio, and quality metadata
- Network failures, empty data, or insufficient bars return deterministic fallback data
- Fallback/demo results are never hidden; they are labeled throughout the UI

## AI Layer

The current AI layer is deterministic and intentionally labeled as AI-style research output. It generates:

- AI Strategy Thesis
- AI Research Notes
- Model Reasoning Summary
- AI Confidence Score
- Risk Flags
- Suggested Next Experiments
- Market Intelligence memo

No external OpenAI, Claude, or broker API call is connected in this demo build.

## Quant Engine

The quant layer includes:

- Indicators: SMA, EMA, RSI, ATR, rolling high/low, volume moving average, percent change, realized volatility, max drawdown
- Strategies: Quality Momentum Breakout, ATR Channel Expansion, Defensive Trend Pullback, EMA Continuation Signal, Low-Volatility Rotation
- Backtest assumptions: initial capital 100000, 20% position fraction, next-open fills, modeled slippage, per-trade fees, stop loss, trailing stop, max holding period
- Metrics: total return, annualized return, benchmark return, excess return, drawdown, Sharpe, win rate, profit factor, trade count, average holding days, volatility

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React
- Vitest

## Run Locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Quality checks:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Project Layout

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
    ai/                        Deterministic AI-style research text
    utils/                     Formatting helpers
  types/                       Market, strategy and backtest contracts
```

## Limitations / Production Gaps

- Yahoo Finance is suitable for demo research but does not provide a production data SLA
- No persistent database, scheduled ingestion, or background backtest jobs yet
- No authenticated users or custom strategy DSL yet
- AI summaries are deterministic; no external LLM workflow is connected yet
- Paper trading is simulated observation only; no broker API or real orders are connected

## Disclaimer

This platform is for research and simulated trading demonstration only. It does not constitute investment advice. Historical backtests do not represent future returns.
