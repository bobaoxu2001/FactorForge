# Roadmap

This roadmap is intentionally scoped to known project directions. It does not imply dates, external adoption, or committed release promises.

## Near term

- Keep README and route/module maps synchronized as features move.

Recently completed (see git history for details): `getResearchDataset` build-time memoization; sign-aware gain/loss tones (`signedTone` / `signedText` in `src/lib/utils/format.ts`) so losses never render in the gain color; watchlist fan-out tests for mixed-provider and partial-universe scenarios; deterministic Polygon and Alpha Vantage parser tests; fixture refresh maintainer notes in `docs/fixture_refresh.md`.

## Research engine

- Add more fixture-driven tests for next-open execution, slippage, stops, missing bars, flat/long transitions, and benchmark calendar alignment.
- Separate showcase ranking from validation reporting more explicitly in UI and docs.
- Evaluate external factor-return datasets for market, momentum, value, quality, and low-vol attribution.

## Data and providers

- Improve provider observability with per-provider hit/failure summaries that do not expose credentials.

## Maintainer operations

- Define a release-tag convention once the project starts cutting tagged releases.
- Add a release notes template if manual changelog maintenance becomes repetitive.
- Track security-sensitive review checklists for auth, sessions, persistence, CSP, provider credentials, and LLM payloads.

## Deferred

- A **read-only** Alpaca paper mirror (GET-only account/positions/orders) ships behind optional keys. Any *write* path — order submission, even to a paper account — stays deferred until risk gates, audit logs, and simulation boundaries are documented clearly.
- Package publishing is deferred; the repo is currently operated as an application/workbench, not an npm library.
