# FactorForge — Project Audit

*Audit date: 2026-11-01. Branch audited: `improve/platform-multi-agent` (HEAD `28f5bf2`), 18 commits ahead of `origin/main`. The audit was done by reading code paths and tests and by running the checks. README claims were not taken on trust.*

---

## 0. Summary of findings

FactorForge is a **well-engineered quantitative strategy lab** with an unusually honest data-provenance culture. It is **not yet a research platform**. It answers "which rule-based strategy looked good on which symbol" well. It has no model at all for industries, companies' financial statements, evidence, KPIs, theses or memos.

| Area | Verdict |
|---|---|
| Build health | Before this change: `lint` clean, `typecheck` clean, **310/310 tests pass** (59 files). After it: 400/400 tests and a clean production build (see §9 of the architecture doc). |
| Engineering quality | High. Deterministic engines, pure functions, provider fan-out with labelled fallback, numbers-in-code/LLM-for-prose contract, env validation, security headers, rate-limited auth. |
| Data integrity | Good on prices. Two real defects: (1) **profit factor reports a dollar amount** when a backtest has no losing trades; (2) the **committed price snapshot (as of 2026-07-17) is labelled "real, not fallback"** with no staleness warning. On a cold serverless start a page can show 3½-month-old prices without saying so. |
| Methodology | Backtest mechanics are careful (next-open execution, slippage, fees). The research layer above them has **selection bias**: 5 strategies × 30 symbols, and the best per strategy goes into the radar and model portfolio. The bias is documented in a code comment, but the UI does not quantify it. Hotspot scenarios carry **configured subjective probabilities and 0–100 confidence numbers**, which reads as false precision. |
| Product fit for the new vision | The quant engine, data layer, AI contract and UI kit are reusable. Missing entirely: industry mapping, value chain, financial-statement history, valuation, KPI tracking, evidence model, primary-research workflow, thesis/memo lifecycle. |
| Deployment | The live site (`factor-forge-ashy.vercel.app`) runs **`main`**, not this branch: `/picks` returns 404 there, the LLM is disabled, and SQLite is unavailable (expected on Vercel). |

**Recommendation:** keep the quant lab intact as the *Quantitative* section. Add a research domain layer (`src/lib/intel`) with real, attributable data (SEC EDGAR XBRL + FRED, committed as dated snapshots with provenance), and build one complete vertical workflow on it: U.S. freight. Then reorganise navigation research-first.

---

## 1. Current architecture map

```
Next.js 14 App Router (server components, ISR revalidate=3600)
│
├── src/app/                     20 pages + 2 API routes
│   ├── /                        Overview ("Model Portfolio Since May" hero)
│   ├── /data /factors           L0 data provenance, L1 factor table
│   ├── /strategies[/id]         L2 backtests, walk-forward, factor attribution, LLM memo
│   ├── /radar /consensus        L3 screening + N_eff concentration gate, L4 multi-strategy agreement
│   ├── /portfolio               L5 score-weighted multi-leg backtest
│   ├── /ai-market /picks /hotspots   regime memo, cross-sectional ranking, configured themes
│   ├── /paper-trading /simulator /track-record   simulated observation, browser sandbox, public receipt
│   ├── /reports /learn /oss     report cards, glossary, maintainer docs
│   ├── /my-watchlist /admin/cache /sign-in /sign-up   SQLite-backed (disabled on Vercel)
│   └── /api/health /api/csp-report
│
├── src/lib/research.ts          getResearchDataset(): the single pipeline every page calls
│                                (prices → factors → 150 backtests → radar → concentration gate →
│                                 paper queue → portfolio → stress → hotspots → picks → LLM notes)
├── src/lib/data/                marketData facade, composite provider (Yahoo→Polygon→AlphaVantage→synthetic),
│                                fundamentals (Yahoo quoteSummary → committed snapshot)
├── src/lib/quant/               indicators, strategies, backtest, metrics, radar, signalConcentration,
│                                portfolio, walkForward, factorAttribution, marketStress, stockPicks, …
├── src/lib/ai/                  DeepSeek JSON client + 5 "LLM-or-template" prose modules
├── src/lib/agents/              hotspot agent over a configured catalyst catalog (no live news)
├── src/lib/persistence/         better-sqlite3: backtest cache, users, watchlists, paper ledger
├── src/lib/auth, ratelimit      iron-session + bcrypt; in-memory or Upstash rate limit
├── src/lib/sim/                 pure browser-sandbox portfolio math
├── src/components/              ~70 components (cards, badges, charts, research panels, hotspots, auth)
└── src/__fixtures__/            yahoo-snapshot.json (30 symbols, 3y, as of 2026-07-17),
                                 fundamentals-snapshot.json (28 names, as of 2026-07-19)
```

Stack: Next 14.2.5 · React 18 · TypeScript strict · Tailwind 3 (dark-only token set) · Recharts 3 · better-sqlite3 · iron-session · bcryptjs · Vitest 4 + jsdom · ESLint (next). Docker standalone image. GitHub Actions: CI (lint/typecheck/test/build) and a weekly fixture-refresh PR.

---

## 2. Existing feature inventory

Legend: **Real** = computed from real provider data; **Repro** = deterministic given the same inputs.

| Feature | Works? | Real data? | Repro? | Useful / accurate? | Fit for research vision | Decision |
|---|---|---|---|---|---|---|
| Market data fan-out + provenance labels | Yes | Yes (Yahoo keyless; others optional) | Yes, with snapshot | Strong | Foundation | **Retain**; add staleness check |
| Factor snapshot (`/factors`) | Yes | Yes | Yes | Basic technical factors only | Quant lens | **Retain** under Quantitative |
| Strategy backtests (`/strategies`) | Yes | Yes | Yes | Careful mechanics. Profit-factor bug. Best-symbol selection bias | Quant lens | **Retain + fix**; label selection bias |
| Walk-forward + OLS factor attribution | Yes | Yes | Yes | Good; t-stats shown | Alpha-attribution building block | **Retain**; reuse |
| Radar + N_eff concentration gate | Yes | Yes | Yes | Good risk idea | Quant / portfolio | **Retain** |
| Multi-strategy consensus | Yes | Yes | Yes | Good | Quant | **Retain** |
| Portfolio backtest | Yes | Yes | Yes | In-sample blend of selected legs | Quant / risk | **Retain**; label in-sample |
| Market stress mode (`/ai-market`) | Yes | Yes | Yes | Good regime read | Market context | **Retain** |
| "AI Stock Picks" (`/picks`) | Yes (this branch only) | Yes + fundamentals snapshot | Yes | Transparent components, but framed as picks | Conflicts with "not a Buy/Hold/Sell dashboard" | **Retain, reframe** as "Quant Screen" |
| Market hotspots (`/hotspots`) | Yes | Partially. Catalysts are configured text; probabilities are configured | Yes | Honest labels, but numeric confidence/probabilities are subjective | Thematic hypotheses | **Retain**, labelled "configured hypotheses" |
| Paper observation + Daily Review | Yes | Yes | Yes (ledger needs SQLite) | Good | Monitoring | **Retain** under Portfolio |
| Trade simulator | Yes | Yes | Browser state | Good | Paper portfolio | **Retain** |
| Track record | Yes | Simulated | Needs SQLite for history | OK | Performance review | **Retain** |
| Reports (`/reports`) | Yes | Yes | Yes | Card summaries, not memos | Superseded by Memo Builder | **Retain**, link to memos |
| DeepSeek prose layer | Yes (key set locally; off in prod) | n/a | Cached | Sound contract | Copilot foundation | **Reuse** the client and contract |
| Auth + watchlists | Locally only | n/a | n/a | Fine | Workspace | **Retain** (unchanged) |
| Learn / glossary / ⌘K search / OSS | Yes | n/a | Yes | Good | Keep | **Retain**, extend index |

Missing for the target vision: industry taxonomy and value chain, company financial-statement history, valuation multiples over time, KPI definitions/observations, evidence records, verification status, primary-research planning and notes, hypotheses with supporting/contradicting evidence, scenario valuation, thesis monitoring, memo builder, research-quality checks.

---

## 3. Working vs incomplete functionality

**Working, verified by tests and code reading:** the full price → factor → backtest → radar → portfolio pipeline against the committed fixture (`research.snapshot.test.ts`), provider fan-out and fallback, fundamentals parsing, LLM merge contract (numbers passed through), auth, rate limiting, env validation, simulator math, sitemap/search drift guards.

**Incomplete or misleading:**
1. `calculateMetrics` → `profitFactor = grossProfit` (a dollar figure) when there are no losing trades. With one winning trade of $2,340 the UI shows "profit factor 2,340.00". **(P0, fixed.)**
2. `buildSnapshotPrices` relabels a months-old committed snapshot as `status: ok, isFallback: false`. Pages show coverage dates in places, but no global staleness warning, and `metadata.realDataCount` counts the snapshot as live data. **(P0, fixed: staleness surfaced.)**
3. `MARKET_FETCH_CONCURRENCY` defaults to **8** in code, but README and `.env.example` say **4**. **(Doc drift, fixed.)**
4. README screenshots section is placeholders.
5. The live deployment is two months behind this branch.

---

## 4. Data source inventory

| Source | Access | Used for | Licensing / terms note | Status |
|---|---|---|---|---|
| Yahoo Finance chart API | keyless HTTPS | daily OHLCV (3y) | Unofficial endpoint; personal/research use; may throttle | Live + committed snapshot (2026-07-17) |
| Yahoo quoteSummary | keyless cookie+crumb | valuation/quality multiples | Same | Live + snapshot (2026-07-19) |
| Polygon.io | `POLYGON_API_KEY` | 2nd-tier OHLCV | Per-plan licence | Optional, off in prod |
| Alpha Vantage | `ALPHA_VANTAGE_API_KEY` | 3rd-tier OHLCV (unadjusted free tier) | Per-plan | Optional, off in prod |
| Deterministic synthetic | in code | last-resort fallback | n/a | Labelled "fallback/demo" |
| DeepSeek `deepseek-chat` | `DEEPSEEK_API_KEY` | prose only | API terms | Local only |
| Alpaca paper (read-only) | keys | paper mirror | GET only | Optional |

**Added by this transformation:** SEC EDGAR XBRL `companyfacts` and `submissions` (public, needs a declared User-Agent; see §7 of the architecture doc). FRED series CSV + series metadata (public; each series carries its own licence, which the build script records and honours).

---

## 5. Main technical risks

| # | Risk | Severity | Notes |
|---|---|---|---|
| R1 | Profit-factor unit bug | High (calculation) | Fixed; now `null` = undefined, rendered as "—" |
| R2 | Silent stale snapshot | High (integrity) | Fixed; staleness computed and surfaced |
| R3 | Selection bias / multiple testing in the best-of-N showcase feeding radar and model portfolio | High (methodology) | **Quantified.** `/strategies`, `/radar` and each strategy page show the Deflated Sharpe Ratio of the best-of-N pick; company quant lenses show the expected-max-Sharpe haircut. Radar admission itself still uses Sharpe > 1 (gating on DSR is roadmap) |
| R4 | Stop exits filled at the trigger bar's close (decided and filled on the same close) | Medium | **Fixed.** Stops are judged on the close and filled at the next open, so gaps through a stop are paid; the entry bar's close is checked too |
| R5 | Hotspot numeric confidence and probabilities are subjective configuration | Medium | **Mitigated.** Scenario weights show as configured priors to the nearest 5% ("~35% prior"); confidence shows as a Lower/Moderate/Higher heuristic band with the raw score only in a tooltip. The underlying configuration is unchanged |
| R6 | Recommendation-style framing ("AI Stock Picks", "prime watch") | Medium (product/compliance) | Page and navigation relabelled "Quant Screen". Internal tier names ("prime watch") are unchanged |
| R7 | No persistence on Vercel | Medium | Research workspace state is kept client-side (versioned localStorage + JSON export). Private notes never touch the server unless the user explicitly runs an AI analysis |
| R8 | New user-triggerable LLM endpoint could be abused | Medium (cost/security) | Copilot route is rate-limited, input-size-bounded, and never echoes secrets |
| R9 | Dark-only theme with hard-coded hex colours in ~40 files | Low (UX) | Light theme deferred; documented |
| R10 | CSP allows `'unsafe-inline'` scripts | Low | Documented upstream; nonce CSP is the next step |
| R11 | In-memory caches are per-instance on serverless | Low | Acceptable; snapshot tier keeps pages deterministic |

---

## 6. Product and research-methodology gaps

1. **No industry context.** Securities are evaluated with no model of value chains, competitors or demand drivers.
2. **No financial statements.** Only point-in-time multiples from one Yahoo snapshot. No revenue/margin/FCF history and no point-in-time awareness (filing dates).
3. **No evidence model.** Claims (including LLM prose) have no claim → source link, no verification status, no freshness.
4. **No KPI framework.** No definitions, units, frequency, publication lag, comparability limits, or leading/lagging distinction.
5. **No primary-research discipline.** No way to plan interviews, record user-provided notes, or keep AI-generated questions separate from evidence.
6. **No thesis lifecycle.** No hypotheses, invalidation triggers, scenarios, monitoring or outcome review.
7. **Recommendation framing over research framing.** Composite scores and tiers instead of "what is priced in / what would change our mind".
8. **Backtest results can be mistaken for performance.** Mostly well labelled, but there is no explicit backtest vs simulated vs actual taxonomy across pages.

---

## 7. Recommended architectural changes

1. Add a research domain layer `src/lib/intel/` of pure, tested functions: financial-statement quarterisation (XBRL), point-in-time selection, ratios, valuation, DCF/sensitivity, KPI transforms (YoY, anomalies, lead-lag), freshness, evidence registry and validation, research-quality checks, thesis triggers, interview safeguards, memo assembly, copilot retrieval and citation validation.
2. Add a reproducible snapshot builder (`scripts/build-research-snapshot.mjs`) that pulls SEC EDGAR + FRED + Yahoo prices into dated, provenance-tagged fixtures under `src/__fixtures__/research/`. Cover it with drift-guard tests and add it to the weekly refresh workflow.
3. Use config-driven research projects (`src/data/research/`) so a new industry is a data file, not new code.
4. Keep user research state client-side: a versioned localStorage store with export/import and explicit provenance categories.
5. Add a grounded Copilot API route that reuses the DeepSeek client. Every factual sentence must cite an evidence ID that exists. Deterministic fallback when no key is set. Rate limited.
6. Make the information architecture research-first (§4 of the architecture doc). Keep every quant route under a *Quantitative* group.

---

## 8. Prioritised implementation roadmap

| Priority | Scope | Status in this change set |
|---|---|---|
| **P0** | Profit-factor fix, snapshot staleness, doc drift | Done |
| **P1** | Research home, industry map (value chain), company research (financials, valuation), evidence explorer, KPI analysis, memo, all on real data | Done for the freight project |
| **P2** | Grounded copilot: plan, KPI extraction, industry analysis, contradiction detection, memo draft | Done (LLM + deterministic fallback) |
| **P3** | Primary research: stakeholder map, interview guides, user notes with provenance, MNPI/PII safeguards, note analysis | Done (client-side) |
| **P4** | Quant integration: company quant lens (strategy runs, multiple-testing haircut, market/sector attribution), scenario valuation, portfolio context | Done for coverage names |
| **P5** | Featured case study "Is the U.S. Freight Recovery Real?" | Done |
| Later | Light theme; DB-backed multi-user research projects; more industries with data adapters; earnings-call transcripts (licensing); consensus estimates (needs a licensed provider); gate radar admission on the deflated Sharpe; rolling-origin lead-lag tests | Roadmap |
