# FactorForge

> **AI Quant Research Lab** — factor discovery, backtesting, market-stress analysis, hotspot monitoring, and a simulated model portfolio, all in one open-source workbench.

[![CI](https://github.com/bobaoxu2001/FactorForge/actions/workflows/ci.yml/badge.svg)](https://github.com/bobaoxu2001/FactorForge/actions/workflows/ci.yml)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vitest](https://img.shields.io/badge/tests-passing-22c55e?logo=vitest&logoColor=white)](#testing)
[![Docker](https://img.shields.io/badge/Docker-standalone-2496ed?logo=docker&logoColor=white)](#deployment)

**🔗 Live demo: [factor-forge-ashy.vercel.app](https://factor-forge-ashy.vercel.app/)**

FactorForge is an AI-powered stock strategy research platform for factor discovery, cost-aware backtesting, market-stress analysis, hotspot monitoring, and simulated model-portfolio observation over daily OHLCV data.

It is designed as a reusable research toolkit: deterministic engines compute the numbers, provider metadata keeps data provenance visible, and optional LLM calls turn validated payloads into prose without overwriting computed metrics.

> Research software only. For educational and research use — **not investment advice**. The model portfolio is a **simulated research portfolio**, not a real-money trading account, and **historical performance does not indicate future results**. No broker connection. No live trading.

Public demo mode is intentionally safe: market-data and LLM keys are optional, missing keys fall back to clearly labeled provider/template behavior, and account features are limited to saved research preferences/watchlists. FactorForge has no broker connector and no order execution path.

---

## Key features

| Module | What it does |
|---|---|
| **Model Portfolio Performance Since May** | A deterministic, equal-weighted blend of the top-ranked research strategies, normalized on the start date and benchmarked against SPY/QQQ. Simulated research portfolio only — not a real-money account. |
| **Market Stress Mode** | A selloff/stress research view (`/ai-market?demo=stress`) that diagnoses market regime, breadth deterioration, and drawdown pressure with a stress-aware research memo. |
| **Market Hotspots & Scenario Research** | Configured catalyst intelligence (`/hotspots`) — coverage-weighted hotspot signals and scenario forecasts across themes, with private labeling for pre-IPO names. |
| **Strategy Research Lab** | Five structurally different rule-based strategies with cost-aware backtests, in-sample/out-of-sample splits, factor-attribution regressions, and LLM strategy memos. |
| **Radar Screening** | Composite scoring, rejection rules, and a concentration gate (`N_eff`) that demotes near-duplicate candidates before they reach observation. |
| **Paper Observation** | Research-only simulated monitoring of radar-approved strategies, with a post-market Daily Review. No live orders. |
| **Reports** | Auto-generated research cards summarizing factor breadth, backtest evidence, and portfolio diagnostics for outside viewers. |

---

## Screenshots

> _Add screenshots / a short demo GIF here for the public README._ Suggested captures: the homepage hero, the **Model Portfolio Since May** card, **Market Stress Mode** (`/ai-market?demo=stress`), and **Market Hotspots** (`/hotspots`). The social preview image lives at [`src/app/opengraph-image.png`](src/app/opengraph-image.png).

<!-- ![Homepage](docs/screenshots/home.png) -->
<!-- ![Model Portfolio Since May](docs/screenshots/model-portfolio.png) -->
<!-- ![Market Stress Mode](docs/screenshots/stress.png) -->
<!-- ![Market Hotspots](docs/screenshots/hotspots.png) -->

---

## Why this project is interesting

| | |
|---|---|
| **Two audiences, one product** | The dashboards are built for quant researchers, but every major page (overview, strategies, radar, portfolio, paper-trading, factors, data) opens with an *"In plain English"* callout that says what you're looking at in one friendly sentence, a `/learn` ("Stocks 101") page explains all 27 terms, and an inline `<Term>` helper turns jargon across the app (Sharpe, drawdown, N_eff…) into hover/tap tooltips — all driven by a single glossary source of truth. Experts skim past the cyan strip and dotted underline; newcomers get oriented in place. No separate "beginner mode" to maintain. |
| **Real LLM in the loop** | DeepSeek (`deepseek-chat`) writes the strategy memo, tape note, and post-market Daily Review from a deterministic payload. Numbers come from the engine; only prose is generated. Template fallback when the key is unset. |
| **Post-market auto-review** | The paper-trading page closes each session with an automatic Daily Review: a desk-style blotter that folds the *same* observations the page already renders into a P&L tally (winners/losers), the weakest leg, same-batch concentration (how many admissions came from one scan), and today's tape (entries / exits / skipped signals / concentration-gate rejections). Every number is computed in `buildDailyReview`; the LLM only narrates it, and a ranked "needs a look before next session" list is derived deterministically. No broker, no real orders — every count is a simulated observation. |
| **Multi-strategy consensus** | The core read of the whole lab: all 5 structurally different strategies are run across the *entire* 28-symbol universe, then the strategy×symbol grid is pivoted per-symbol to surface which names more than one independent strategy is holding right now. Agreement is ranked first by how many strategies hold the name and then by how many distinct strategy *types* those are — a breakout + a mean-reversion confirming each other is worth more than two breakouts agreeing. This is independent confirmation made explicit: one strategy liking a name is a signal; four strategies across four styles holding it (e.g. CVX) is a far less style-dependent one. Single-strategy picks are shown separately and never dressed up as consensus. Lives at `/consensus`. |
| **Sector-diversified universe** | 28 real-data names spanning 11 GICS-style sectors (single-name equities + SPY/QQQ benchmarks), not a mega-cap tech monoculture. This is what makes the cross-sectional momentum / low-vol factors and the N_eff analysis statistically meaningful — a basket of "seven tech names" is one factor wearing seven hats. `UNIVERSE` is the single source of truth; a guard test locks the committed fixture to it so the two can't drift. |
| **Multi-symbol portfolio engine** | Score-weighted blend of radar-eligible legs, calendar intersection, per-leg P&L attribution, and pairwise Pearson correlation. Not just N parallel backtests. |
| **Walk-forward + factor attribution** | Each strategy detail page reports in-sample vs out-of-sample metrics on the same equity curve, plus an OLS regression against Market / Momentum / Low-vol with t-statistics. This helps inspect overfit risk and factor exposure without claiming investable alpha. |
| **Concentration gate (one risk metric, five surfaces)** | Effective-number-of-bets `N_eff = N / (1 + (N-1)·ρ̄)` from pairwise return correlation. The *same* number drives: a radar diagnostic panel, demotion of near-duplicate candidates, the paper-trading slot cap, exclusion of redundant portfolio legs, and an LLM-written diversification memo. Answers "are these four strategies actually four bets, or one bet wearing four hats?". |
| **Provider fan-out** | Composite real-data path: Yahoo → Polygon → Alpha Vantage → synthetic fallback. Each tier's failure reason is structured-logged; the UI labels which provider answered. |
| **Persisted compute + multi-user** | SQLite stores fingerprint-keyed backtest cache (6h TTL), bcrypt-hashed users, and per-user watchlists. Iron-session cookies gate the protected routes. |
| **Observability** | JSON-line structured logger, `/admin/cache` page (live hit rate, per-strategy row counts, oldest/newest entries), a `/api/health` liveness/readiness probe, and a `/api/csp-report` sink that logs CSP violations into the same JSON stream. |
| **Hardened HTTP + auth** | Strict Content-Security-Policy plus `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS on every response; `poweredByHeader` off. Auth adds a 7-day session TTL, constant-time login (dummy-hash compare blocks username enumeration), and a bcrypt 72-byte password guard. |
| **Deploy-ready** | Multi-stage `Dockerfile` building Next's `standalone` server as a non-root container with a `HEALTHCHECK`, plus centralized env validation that fails fast in production on a missing `SESSION_PASSWORD`. |
| **Pluggable rate-limit store** | Auth throttling sits behind a `RateLimitStore` interface with two real backends: per-process in-memory (default) and a distributed Upstash/Vercel-KV adapter (atomic `INCR`+`PEXPIRE` over the REST API, no SDK) so the limit holds across a horizontally-scaled fleet. Selected by env, fail-open on infra blips, surfaced in `/api/health`; production warns when only the per-process store is wired. |
| **CI and tests** | 167 vitest tests (engine + concentration gate + universe/sector breadth + rate-limit stores + glossary + `<Term>`/`<PlainEnglish>` + components + auth + env validation + composite-provider and DeepSeek-branch mocks) under jsdom; GitHub Actions runs lint + typecheck + test on every push and pull request targeting `main`. |
| **Maintainer-facing app surface** | `/oss` documents why the project exists, who can contribute, good first issues, maintainer workflow, Codex/automation use cases, security-sensitive areas, release workflow, and current limitations inside the deployed app. |

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
    CONC[Concentration<br/>N_eff + correlation gate]
    PORT[Portfolio engine<br/>weighting + correlation matrix]
  end

  subgraph PERSIST["Persistence (src/lib/persistence)"]
    DB[(SQLite<br/>.cache/factorforge.db)]
  end

  subgraph AI["AI Layer (src/lib/ai)"]
    DS[DeepSeek client<br/>server-only, JSON mode]
    EXP[Strategy explainer<br/>memo + thesis]
    MS[Market summary<br/>regime + highlights]
    CN[Concentration note<br/>diversification memo]
  end

  subgraph UI["Next.js App Router (src/app)"]
    HOME["/"]
    STRAT["/strategies/:id"]
    RADAR["/radar"]
    PFOL["/portfolio"]
    PAPER["/paper-trading"]
    AIM["/ai-market"]
    REP["/reports"]
  end

  YH --> NORM
  FB --> NORM
  NORM --> IND --> SIG --> BT --> MET
  BT <-.cache by fingerprint.-> DB
  MET --> RAD --> CONC --> PORT
  CONC -.gate / N_eff cap.-> RAD
  MET --> EXP
  IND --> MS
  CONC --> CN
  EXP --> DS
  MS --> DS
  CN --> DS
  MET --> UI
  RAD --> UI
  CONC --> UI
  PORT --> UI
  EXP --> UI
  MS --> UI
  CN --> UI
```

The page-level data flow is consolidated in `src/lib/research.ts → getResearchDataset()`, which is the single entry point all routes call.

---

## Module map

```text
src/
  app/                     Next.js routes (server components by default)
    page.tsx               Overview / proof-moment dashboard
    strategies/[id]        Per-strategy backtest + LLM memo
    learn/                 Stocks 101 — plain-English glossary for newcomers
    radar/                 Composite scoring + verdicts
    consensus/             Multi-strategy resonance (which names ≥2 strategies hold)
    portfolio/             Multi-symbol blended backtest + correlation
    paper-trading/         Simulated observation queue + risk budget + Daily Review
    ai-market/             Market regime memo
    reports/               Auto-generated research cards
    oss/                   OSS maintainer and contribution workflow
    factors/, data/        Factor table and data provenance
  components/
    cards, badges, charts, layout, research
  lib/
    data/                  Market data facade + Yahoo provider + fallback
    quant/                 indicators, strategies, backtest, metrics,
                           radar, signal concentration (N_eff + gate),
                           paper trading, portfolio
    persistence/           SQLite client + backtest cache
    ai/                    DeepSeek client + strategy explainer +
                           market summary + concentration note
                           (all LLM-or-template)
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

## Public demo auth behavior

Account features are optional and only exist to persist saved research preferences and watchlists. They depend on a writable persistence backend, which the public Vercel demo intentionally does not provide.

- **Research pages are read-only and need no account.** Overview, Data, Factors, Strategies, Radar, Consensus, Portfolio, AI Market, Paper Trading, and Reports all work without signing in.
- **Account creation / sign-in may be disabled.** When no persistence backend is configured (`isPersistenceAvailable()` is false — e.g. Vercel's stateless serverless filesystem can't open SQLite), the sign-up and sign-in routes render a friendly demo-mode notice instead of the credential form. The raw "Persistence layer unavailable" engine string is never shown to users; the action layer also maps it to safe copy on any residual submit path.
- **Protected routes degrade with context.** My Watchlist and the admin Cache page redirect to sign-in carrying an `area`, and the sign-in route explains that the page needs saved-preference storage which is off in the public demo. The sidebar tags these routes (`local` / `admin`) and notes that saved preferences and admin cache controls are disabled in demo mode.
- **Local SQLite enables the full experience.** Running locally (or on a long-lived host with a writable volume) opens `.cache/factorforge.db`, so account creation, sign-in, and per-user watchlists work normally.
- **No broker connection, no live trading, no brokerage credentials** in any mode — accounts only store research preferences.

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

Maintainer and contributor docs:

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
- [Release checklist](docs/release_checklist.md)
- [Maintainer backlog](docs/maintainer_backlog/README.md)

Inside the app, `/oss` provides the same contribution and maintainer story for visitors using the public demo.

**Environment variables**

| Variable | Required? | What it does |
|---|---|---|
| `DEEPSEEK_API_KEY` | optional | Enables LLM-written strategy memo, market tape note, and post-market Daily Review. Without it the platform uses the deterministic template and labels the source as `template memo`. |
| `POLYGON_API_KEY` | optional | Polygon.io aggregates as a second-tier real-data source (split + dividend adjusted). Composite provider tries it after Yahoo. |
| `ALPHA_VANTAGE_API_KEY` | optional | Alpha Vantage daily as a third-tier real-data source. Free-tier endpoint is NOT corporate-action adjusted; the UI surfaces that honestly. |
| `LOG_LEVEL` | optional | `debug` / `info` / `warn` / `error`. Default `info`. Logger emits JSON lines to stdout. |
| `SESSION_PASSWORD` | required in prod | Iron-session signing key (≥32 chars random). Set this as a Vercel environment variable before making the demo public; never expose it client-side. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional | Shared rate-limit store so auth throttling holds across multiple instances. Without it, throttling is per-process. Vercel-KV's `KV_REST_API_URL` / `KV_REST_API_TOKEN` are also accepted. |
| `SITE_URL` | optional | Public origin used for absolute metadata / OpenGraph URLs. Defaults to `http://localhost:3000`. |
| `MARKET_FETCH_CONCURRENCY` | optional | Caps concurrent market-data fetches. Defaults to `4`. Lower it if a host or provider throttles requests. |
| `RISK_FREE_RATE` | optional | Annual risk-free rate used by metric helpers. Defaults to `0`. |

Env is validated centrally in `src/lib/config/env.ts`. In production a missing/short `SESSION_PASSWORD` is a hard error (`assertProductionEnv` / `/api/health` → 503); optional keys that are unset become *warnings* and the corresponding feature degrades gracefully (LLM → template, providers → Yahoo-only).

---

## Deployment

```bash
# Build the standalone server and run it directly
npm run build && node .next/standalone/server.js   # serves on $PORT (default 3000)

# …or build the container (multi-stage, non-root, with a HEALTHCHECK)
docker build -t factorforge .
docker run -p 3000:3000 -e SESSION_PASSWORD="$(openssl rand -hex 32)" factorforge
```

- **`output: "standalone"`** (next.config.js) emits a self-contained server bundle, so the runtime image ships only what it needs. `better-sqlite3` is kept as an external server package so its native `.node` binding resolves at runtime instead of being mis-bundled.
- **Security headers** are applied to every response in `next.config.js`: a tight `Content-Security-Policy` (with `report-uri` → `/api/csp-report`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS. `poweredByHeader` is disabled.
- **`GET /api/health`** returns `ok` / `degraded` / `unhealthy` (503) with DB reachability, wired features, and env warnings — point a load balancer or `docker HEALTHCHECK` at it.

### Deploy to Vercel

FactorForge can be deployed as a public Vercel demo with the default build command:

```bash
npm run build
```

Set `SESSION_PASSWORD` in Vercel Project Settings → Environment Variables before making the deployment public. Use a random value of at least 32 characters. `SITE_URL` is optional but recommended for the public deployment URL.

Optional keys can be left unset:

- `DEEPSEEK_API_KEY` unset → AI memo surfaces use deterministic template prose.
- `POLYGON_API_KEY` / `ALPHA_VANTAGE_API_KEY` unset → the app uses Yahoo Finance first, then deterministic fallback/demo data if every real-data provider fails.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` unset → auth throttling is per Vercel instance instead of shared across instances.

On Vercel's stateless serverless filesystem `better-sqlite3` cannot open a persistent database, so `getDb()` returns `null` and the engine runs uncached. This is expected: `/api/health` reports `status: "degraded"` with `database: "down"` (HTTP 200, still serving) on the public demo. Watchlists and the backtest cache are unavailable in that mode, but the research pipeline still renders. A long-lived host (Docker, a VM, or a Vercel deployment with a mounted volume) reports `status: "ok"`.

Safe public demo behavior:

- No brokerage integration is present.
- No trading execution or order routing is present.
- No market-data API key is required for the default demo path.
- No LLM API key is required.
- Fallback/demo market data is labeled when used.
- LLM-generated prose cannot overwrite computed metrics; template fallback is used when the LLM key is missing or the call fails.

Security notes:

- Do not prefix secrets with `NEXT_PUBLIC_`; all supported secrets are server-side only.
- Do not add brokerage credentials to Vercel because the app has no broker connector.
- Keep `SESSION_PASSWORD`, provider keys, LLM keys, and Redis/KV tokens out of README snippets, screenshots, issues, logs, and commits.
- Treat `/api/health` as an operational endpoint: it reports whether optional features are configured and whether production env validation passes.

---

## Testing

167 tests across 43 files under vitest + jsdom:

- **Engine** — backtest fees + execution semantics, indicators, radar verdict logic, paper-trading risk-budget transitions + N_eff slot cap, portfolio engine (Pearson, calendar intersection, score-weighted blend, phase-shifted decorrelation).
- **Concentration** — `effectiveBets` / `concentrationLevel` math (monotonicity, bounds), the correlation gate demoting near-duplicate candidates, and the shared pairwise-correlation builder.
- **Universe** — sector-diversification invariants (≥8 sectors, no sector >⅓ of single names), case-insensitive sector lookups, strategy-default coverage, and a guard that the committed fixture matches `DEFAULT_SYMBOLS` exactly.
- **AI layer** — concentration-note template prose plus a mocked DeepSeek branch proving LLM prose is adopted while computed numbers are passed through (blank fields fall back via `pickString`); Daily Review note template covering the book split, today's tape, weakest leg, same-batch clause, and the empty-book / all-winners edge cases.
- **Daily Review engine** — `buildDailyReview` winners/losers tally, weakest-leg selection, largest same-batch cluster by signal date, tape counts (skipped = continue-observing, rejected = concentration-gate demotions), watch-item derivation (underwater leg, fallback data), and empty-book degradation.
- **Multi-strategy consensus** — `buildSignalConsensus` counting only currently-held symbols, ranking resonance ahead of single-strategy picks, the distinct-strategy-type tie-break, leg averaging + best-first ordering, and honest verdicts for the nothing-held and no-confirmation cases.
- **Components** — StatusBadge (including the `idle` state introduced when fixing the zero-observation risk-budget bug), MetricCard tone classes, CorrelationMatrix rendering + empty state.
- **Learn / glossary** — definition integrity (unique ids, no jargon creep, alias-collision guard), case-insensitive `lookupTerm`, the `<Term>` component (default + custom label, click-to-reveal explanation, alias resolution, graceful fallback for unknown terms), and the `<PlainEnglish>` page callout (default + custom title, composes with inline `<Term>`).
- **Data providers** — Yahoo and fallback adapters.
- **Auth** — bcrypt round-trip, username-collision + validation rules, the bcrypt 72-byte password guard, and per-user watchlist isolation.
- **Rate-limit stores** — in-memory fixed-window determinism, plus the Upstash adapter over a mocked `fetch`: allow/block paths, retry-after from TTL, and fail-open on both unreachable and non-2xx responses.
- **Env validation** — production fail-fast on a missing session secret, dev warnings, feature-flag detection from optional keys, and the distributed rate-limit detection + prod warning.
- **Pipeline snapshot** — the full factors → backtests → radar → portfolio → concentration run against the committed real-data fixture, built once and shared across invariant checks.

Run them locally with `npm test`. CI runs the same command on every push and PR; see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Maintainer workflow

**CI**

GitHub Actions runs `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test` on pushes and pull requests targeting `main`. The workflow intentionally avoids provider keys and broker integrations; provider failure paths should be covered with mocks and fixtures.

**Tests**

Use focused tests for changes in `src/lib/quant`, `src/lib/data/providers`, `src/lib/auth`, and `src/lib/ai`. Any change to backtest math, radar scoring, concentration gating, paper observations, provider fallback, auth/session handling, or LLM payload contracts should add or update tests before review.

**Release process**

Releases are manual. Update `CHANGELOG.md`, confirm the checklist in [docs/release_checklist.md](docs/release_checklist.md), run the local verification commands, and tag only after the release notes match the shipped code. This repo does not currently publish a package to npm.

**PR review**

Review pull requests for deterministic metric integrity first: numbers must come from code and fixtures, not copy or LLM text. Then check data provenance labels, UI fallback disclosure, tests, README/docs drift, and security-sensitive changes.

**Issue triage**

Use the issue templates to separate bugs, feature requests, and docs tasks. Ask for reproduction steps, route names, provider/fallback status, env context with secrets removed, and whether a fixture-based reproduction is possible.

**Security-sensitive areas**

Treat auth/session code, bcrypt password handling, iron-session cookie settings, rate limiting, SQLite persistence, provider credentials, LLM prompts/payloads, CSP headers, and `/api/csp-report` as security-sensitive. Do not paste secrets into issues, logs, examples, screenshots, or tests.

---

## Maintainer automation use cases

Maintainers may use AI assistants for repetitive review and documentation work, but generated output should be checked against the code before merging.

- **PR review checklists** — draft route/module-specific checks for data provenance, deterministic metrics, fallback labels, tests, and docs updates.
- **Test generation for backtest edge cases** — propose cases for next-open execution, slippage/fees, stop exits, flat/long transitions, empty trades, and benchmark calendar alignment.
- **Provider fallback testing** — generate mocked Yahoo/Polygon/Alpha Vantage failure cases and assertions that synthetic data remains clearly labeled.
- **Auth/session/security review** — inspect changes around password validation, cookie settings, rate limits, env validation, CSP, and logging for accidental secret exposure.
- **Changelog and release note drafting** — summarize merged changes from commits and PR descriptions, then verify against the diff before release.
- **Issue triage and reproduction checklist generation** — turn user reports into minimal reproduction steps, expected/actual behavior, affected route/module, env context, and fixture needs.

---

## Tech stack

- **Next.js 14** App Router, all data fetching in server components
- **TypeScript** strict mode
- **Tailwind CSS** with a dark research-lab token system
- **Recharts** for equity / drawdown / portfolio curves
- **better-sqlite3** for the backtest cache + users + watchlists (WAL)
- **bcryptjs + iron-session** for auth (hashed passwords, signed cookies, 7-day TTL)
- **DeepSeek** (`deepseek-chat`) via OpenAI-compatible JSON mode
- **Vitest** + **Testing Library** + **jsdom**
- **Docker** multi-stage build of the Next.js `standalone` server (non-root + `HEALTHCHECK`)
- **GitHub Actions** for lint / typecheck / test on push

---

## What I'd build next

The current roadmap is tracked in [ROADMAP.md](ROADMAP.md). Near-term maintainer backlog notes live in [docs/maintainer_backlog](docs/maintainer_backlog/).

---

## Data transparency

- **Real data first.** Prices come from a composite provider fan-out (Yahoo → Polygon → Alpha Vantage → deterministic synthetic fallback). Every result carries provider metadata, and the UI labels which tier answered.
- **No hidden numbers.** All metrics (returns, Sharpe, drawdown, `N_eff`) are computed from OHLCV by deterministic engines — never hardcoded.
- **LLM narrates, never invents.** DeepSeek writes prose from a validated payload; computed numbers are not overwritten. Without a key, the app falls back to clearly labeled templates.

## Current limitations

- **Hotspots are configured catalyst intelligence, not a live news API.** Themes and scenarios are curated and coverage-weighted, not streamed from a real-time news feed.
- **Provider fetches may fall back.** Yahoo/other provider calls can rate-limit or fail; when they do, the app degrades to a labeled fallback tier rather than failing the page.
- **The model portfolio is a simulated research portfolio, not a live trading account.** It is a deterministic, normalized blend for research illustration only — no orders are ever placed.

---

## Disclaimer

Research software only — for educational and research use, **not investment advice**. The model portfolio is a **simulated research portfolio**, not a real-money trading account, and **historical performance does not indicate future results**. No broker connection. No live trading.
