# Changelog

All notable changes to FactorForge should be documented in this file.

This project follows a human-maintained changelog. There is no automated release pipeline yet.

## Unreleased

### Added

- Multi-strategy consensus: all 5 strategies run across the full 28-symbol universe, pivoted per symbol to surface names held by more than one independent strategy, ranked by strategy count then distinct strategy types. Lives at `/consensus`.
- OSS maintainer docs: contributing guide, security policy, code of conduct, roadmap, release checklist, issue templates, PR template, and maintainer backlog.
- README maintainer workflow and maintainer automation sections.

### Changed

- README opening reframed FactorForge as an open-source AI-assisted quantitative research workbench.
- README test count synced to 167 passing tests across 43 files.

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
