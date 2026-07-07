# Changelog

All notable changes to FactorForge should be documented in this file.

This project follows a human-maintained changelog. There is no automated release pipeline yet.

## Unreleased

### Added

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
