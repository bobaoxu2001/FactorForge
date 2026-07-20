# Changelog

All notable changes to FactorForge should be documented in this file.

This project follows a human-maintained changelog. There is no automated release pipeline yet.

## Unreleased

### Added

- Humanoid Robotics Supply Chain theme on `/hotspots`: an explicitly OPTION-type theme (milestone-driven, revenue ≈ 0) tracking the component layer of humanoid robotics — actuators, edge vision, rare-earth magnets — with verified deployment facts as of 2026-07 in the catalyst summary (Figure ~1,250 operating hours at BMW, Agility 65,000+ hours across nine customer sites, Tesla 1,000+ internal Optimus units). Proxies: TSLA/NVDA in-universe adjacents with live factor reads; AMBA, MP, TER, QCOM reference-only; non-US actuator pure-plays flagged as untrackable. Risk flags state plainly that this is ex ante indistinguishable from 2021's metaverse or 2015's GPU moment, and tests lock the option-vs-cycle framing so it can never quietly masquerade as an order-driven cycle theme. (+3 tests)

- Research memo `docs/research/ipp-power-premium-unwind.md`: why the listed-generator (IPP) leg of the AI power chain broke below its own 2023-24 trend cone through 2025-26 while scarcity persisted — the FERC co-location rejection (2024-11), ratepayer-politics escalation after the PJM capacity-price spike, the 2026-03 Ratepayer Protection Pledge, and behind-the-meter competition. Adds the missing clause to the bottleneck-migration framework: scarcity confers pricing power only where regulation permits the price. The `/hotspots` Power & Grid theme now carries a "Co-location & ratepayer rules" catalyst and a generation-vs-equipment divergence risk flag pointing at the memo, with a test asserting the finding stays on the theme. (+1 test)

- Universe expanded 28 → 30: Eaton (ETN) and Vertiv (VRT) join the Industrials sleeve so the AI power-chain theme gets live high-beta factor reads instead of reference-only labels — the Power & Grid hotspot's basket coverage rises to 6/9 in-universe, and both names enter the cross-sectional stock picks (28 stocks scored) with full valuation/quality fundamentals. Both committed fixtures refreshed for the new symbols (price snapshot 30 symbols / 753 bars each; fundamentals 28 stocks); the drift guards enforce the consistency. Fixture-refresh scripts now honor `HTTPS_PROXY` for both price and fundamentals endpoints (Yahoo geo-blocks some networks); proxy-less CI runners are unaffected.

- Three AI value-chain themes on `/hotspots`, encoding the bottleneck-migration research (AI capex flows to whichever link expands slowest): **AI Power & Grid Buildout** (transformer lead times, turbine backlogs, interconnection queues; in-universe reads via NEE/DUK/CAT plus reference-only pure-plays), **Optical Interconnect / CPO** (1.6T ramp and the laser constraint — explicitly flagged as already re-rated in 2024-25, with CPO route-shift risk), and **Liquid Cooling & Thermal** (attach-rate volume story, flagged as lacking memory-style pricing power). Every AI-chain theme carries the shared-downstream warning: one AI-capex pause hits power, optics, memory, and GPUs together — correlations near 1. Configured catalyst templates as before — no live news, out-of-universe proxies labeled reference-only, scenarios are ranges not forecasts. (+4 tests)

- Rolling walk-forward windows on strategy detail pages: after a burn-in stretch, the equity curve is cut into sequential out-of-sample segments (anchored — each window's in-sample is everything before it), each scored with the existing window metrics and verdict heuristic, plus a cross-window aggregate (share of OOS-positive windows, share beating the benchmark, average OOS Sharpe and its spread, worst OOS drawdown) and an overall consistent/mixed/fragile read. Same equity curve, no refitting — one good split can be luck; consistency across windows is the harder test. (+5 tests)

- Scheduled fixture refresh: a weekly GitHub Actions workflow (`.github/workflows/refresh-fixtures.yml`, Mondays 05:00 UTC + manual dispatch) re-fetches the committed price and fundamentals snapshots on a US-based runner, runs lint/typecheck/the full test suite/a keyless build against the refreshed fixtures, and opens a review PR instead of committing to `main` — the human review steps in `docs/fixture_refresh.md` remain the merge gate. Complements the runtime's own freshness layers (hourly ISR revalidation, 5-minute dataset cache, 6-hour fundamentals cache), which keep the deployed site current without any commits.

- Fundamentals integration for AI Stock Picks: `/picks` now blends two fundamental components into the ranking — **value** (cross-sectional percentiles of earnings/book/EBITDA yields, so negative-earnings multiples drop out instead of scoring as cheap) and **quality** (ROE, operating margin, earnings growth vs peers) — alongside the six technical components, with regime-aware weights re-normalized across all eight. Data comes from a new fundamentals tier (`src/lib/data/fundamentals.ts`): the keyless Yahoo quoteSummary API under a wait budget, degrading to a committed, dated snapshot (`npm run fundamentals:refresh`, drift-guarded against the universe) — source and as-of date are always shown on the page and in per-pick caveats; names without fundamentals score neutral with a visible caveat. Pick cards show the underlying multiples (trailing P/E, P/B, ROE, op margin, revenue growth, dividend yield) and the LLM note may cite them but is instructed to never state fair values, price targets, or buy/sell advice. (+13 tests)

- AI Stock Picks (`/picks`): model-ranked cross-sectional stock selection over the 28-name universe. Six deterministic sub-scores per name — momentum percentile, 200-day trend, realized-volatility stability, RSI overheat guard, volume confirmation, and multi-strategy evidence from the consensus grid — blended under regime-aware weights (stress shifts weight from momentum to stability). Benchmark ETFs are excluded, incomplete factor rows are excluded with visible coverage counts, and fallback-data names are capped at the monitor tier. The optional DeepSeek note (`src/lib/ai/stockPickNote.ts`) writes prose on top of the computed report and falls back to a deterministic template — same "numbers in code, prose on top" contract as every other AI surface. Wired into the research dataset, sidebar, ⌘K search, and sitemap. Technical evidence only — no fundamental data, no forecast, not investment advice. (+13 tests)

- Sign-aware gain/loss tones (`signedTone` / `signedText` in `src/lib/utils/format.ts`): performance metrics that can go negative — annualized/total return on the homepage table and case study, strategy detail (including excess vs benchmark), portfolio, strategy cards, and the simulator's best-position card — now derive their color from the value's sign instead of hardcoding the gain color. A losing strategy can no longer render green. (+2 tests)
- Watchlist fan-out provider tests (`src/lib/data/marketData.test.ts`): mixed-provider universes keep per-symbol provider labels, a partial-universe fallback never taints real-data neighbors, the fan-out cache serves within TTL and is not poisoned by a failed fetch, `MARKET_FETCH_CONCURRENCY` is honored as an in-flight cap, and the committed-snapshot wait-budget path stays labeled as real (non-fallback) snapshot data. (+6 tests)
- Deterministic parser tests for the Polygon and Alpha Vantage adapters (`polygon.test.ts`, `alphaVantage.test.ts`) over a mocked `fetch`: aggregate/series parsing, honest adjusted-vs-unadjusted quality labels (Polygon `adjusted: true`, Alpha Vantage free tier `adjusted: false`), rolling range cutoffs, non-finite rows dropped instead of poisoning the series, quota/error payloads treated as failures, and missing-key / too-few-bars throws so the composite tier falls through. Every real-data tier now has adapter-level coverage. (+11 tests)
- Fixture refresh maintainer notes (`docs/fixture_refresh.md`): when a refresh is warranted (universe change, staleness, row-shape change) and the review steps for a fixture diff (provenance, key set, coverage sanity, no synthetic leakage, snapshot-test drift), linked from CONTRIBUTING and the release checklist.

- CI now runs `npm run build` after lint/typecheck/tests, so build-only breaks (metadata, static generation, route conflicts) fail on the PR instead of at deploy time. The build runs keyless on purpose — it must succeed on labeled fallback data alone, same as a fresh clone.
- `sitemap.xml` + `robots.txt` via App Router conventions: strategy detail URLs derive from the catalog, protected/account surfaces (`/admin`, `/api`, `/my-watchlist`, auth pages) are excluded and disallowed, and the shared `SITE_URL` now lives in `src/lib/config/site.ts` so layout metadata, sitemap, and robots can never disagree on the origin. Drift-guard tests assert the sitemap covers every route the ⌘K search links to.
- Per-page SEO metadata across the whole app: every route now exports a proper `title`/`description` (via the root `%s · FactorForge` template), and strategy detail pages generate theirs from the catalog — so shared links (especially `/track-record`, which exists to be shared) show meaningful titles in browser tabs, search results, and link previews instead of the generic site title.
- Drift-proof ⌘K search: symbol, strategy-detail, and glossary results are now derived from their single sources of truth (`UNIVERSE`, `STRATEGY_CATALOG`, `GLOSSARY`) instead of hand-maintained copies — every universe name is searchable by ticker, company name, or sector, every glossary term deep-links to its `/learn` anchor, and the previously missing `/learn` and `/hotspots` routes are indexed. Guard tests fail loudly if a new symbol, strategy, or term ever drops out of search.
- Sector-exposure risk lens on the trade simulator (`/simulator`): a segmented allocation bar plus legend grouping the invested book by sector, so a single-name desk still shows its real concentration (five names in one sector is one bet, not five). Pure `summarizeSectorExposure` in `src/lib/sim/portfolioSim.ts`, weighted by share of invested value; unit-tested including the all-cash, unknown-sector, and multi-name-per-sector cases.
- Realized trading stats on the trade simulator (`/simulator`): once a trade is closed, the desk surfaces win rate, profit factor, per-trade expectancy, and average win/loss (with best/worst closed trade) alongside the existing open-book analytics. Pure, unit-tested math derived from the trade log (`summarizeTrades` in `src/lib/sim/portfolioSim.ts`); adds an `expectancy` glossary entry so the new metric explains itself inline and on `/learn`.
- Interactive trade simulator (`/simulator`): start with $100k virtual cash, buy/sell any universe name at its latest close, and watch holdings, weights, and total return update live. Deterministic, unit-tested portfolio math (`src/lib/sim/portfolioSim.ts`); state persists in the browser, so it needs no login and works on the public demo. Simulation only — no broker, no real orders.
- Multi-strategy consensus: all 5 strategies run across the full 28-symbol universe, pivoted per symbol to surface names held by more than one independent strategy, ranked by strategy count then distinct strategy types. Lives at `/consensus`.
- Public track record (`/track-record`): a shareable, outside-viewer receipt of the simulated paper ledger — strategy-by-strategy results, observation dates, current marks, and guardrails. Not a broker statement, not advice.
- Market hotspots (`/hotspots`): coverage-weighted catalyst intelligence and scenario research across themes, with private labeling for pre-IPO names.
- Optional **read-only** Alpaca *paper* mirror on `/paper-trading` (`src/lib/broker/alpacaPaper.ts`): GET-only sync of paper account, positions, and recent orders behind optional `ALPACA_PAPER_*` keys. No order-submission path; the panel reports `disabled` when keys are unset.
- OSS maintainer docs: contributing guide, security policy, code of conduct, roadmap, release checklist, issue templates, PR template, and maintainer backlog.
- README maintainer workflow and maintainer automation sections.

### Security

- Auth throttling now buckets per-IP in addition to per-username, capping a username-spray from a single host that would otherwise stay under each account's limit. Fails open when the client IP is unknown (e.g. local dev with no upstream proxy).

### Changed

- Glossary deep-links now highlight their target: landing on `/learn#<id>` (from ⌘K search or an inline term link) lights up the matching card with a cyan border + glow via a `:target` rule, so the eye finds the definition instantly among ~30 cards.
- README opening reframed FactorForge as an open-source AI-assisted quantitative research workbench.
- Fixed subject-verb agreement in the `/consensus` page subtitle.
- Multi-agent polish pass: navigation grouping and "in plain English" UX refinements, added trading/risk metric depth, a reliability guard with broader test coverage (test suite 219 → 229 across 52 files), and a documentation reconciliation — README/CHANGELOG/ROADMAP and the in-app `/oss` page now reflect the current route set (`/hotspots`, `/simulator`, `/track-record`, `/consensus`) and the read-only Alpaca paper mirror, with stale test counts corrected throughout.

### Demo safety

- Friendly demo-mode notices on sign-in / sign-up when no persistence backend is configured, replacing the raw "Persistence layer unavailable" engine string.
- Protected routes (My Watchlist, admin Cache) redirect with context explaining saved-preference storage is disabled in the public demo.
- Sidebar tags (`local` / `admin`) and a persistent public-demo safety notice in the app shell: research software only, no broker connection, no live trading.

## 0.1.0

### Added

- Next.js App Router research workbench with data, strategy, radar, consensus, portfolio, paper-trading, factors, reports, learn, auth, and admin cache routes.
- Composite market-data provider path: Yahoo Finance, optional Polygon, optional Alpha Vantage, and labeled deterministic fallback.
- Rule-based quant engine for indicators, strategies, backtests, metrics, radar scoring, concentration diagnostics, portfolio construction, paper observations, daily review, factor attribution, and multi-strategy consensus.
- Optional DeepSeek-generated research prose with deterministic template fallback.
- SQLite-backed backtest cache, users, and per-user watchlists.
- GitHub Actions CI for lint, typecheck, and tests.
- Public Vercel demo deployment, read-only for research pages.
- Safety boundaries enforced throughout: research software only, no financial advice, no broker connection, no order execution, no brokerage credentials. Accounts only store research preferences.
- Contributor and security docs (CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, ROADMAP, release checklist) and a maintainer backlog.
