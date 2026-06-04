# Changelog

All notable changes to FactorForge should be documented in this file.

This project follows a human-maintained changelog. There is no automated release pipeline yet.

## Unreleased

### Added

- Multi-strategy consensus (多策略共振): all 5 strategies run across the full 28-symbol universe, pivoted per symbol to surface names held by more than one independent strategy, ranked by strategy count then distinct strategy types. Lives at `/consensus`.
- OSS maintainer docs: contributing guide, security policy, code of conduct, roadmap, release checklist, issue templates, PR template, and maintainer backlog.
- README maintainer workflow and maintainer automation sections.

### Changed

- README opening reframed FactorForge as an open-source AI-assisted quantitative research workbench.
- README test count synced to 155 passing tests.

## 0.1.0

### Added

- Next.js App Router research workbench with data, strategy, radar, consensus, portfolio, paper-trading, factors, reports, learn, auth, and admin cache routes.
- Composite market-data provider path: Yahoo Finance, optional Polygon, optional Alpha Vantage, and labeled deterministic fallback.
- Rule-based quant engine for indicators, strategies, backtests, metrics, radar scoring, concentration diagnostics, portfolio construction, paper observations, daily review, factor attribution, and multi-strategy consensus.
- Optional DeepSeek-generated research prose with deterministic template fallback.
- SQLite-backed backtest cache, users, and per-user watchlists.
- GitHub Actions CI for lint, typecheck, and tests.
