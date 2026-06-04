# Roadmap

This roadmap is intentionally scoped to known project directions. It does not imply dates, external adoption, or committed release promises.

## Near term

- Reduce repeated live-provider work during static builds by memoizing or restructuring `getResearchDataset` calls.
- Improve visual honesty for negative performance metrics so losses and gains use the correct tone everywhere.
- Expand provider fallback tests for mixed-provider and partial-universe scenarios.
- Add maintainer notes for fixture refresh review and snapshot drift.
- Keep README and route/module maps synchronized as features move.

## Research engine

- Add rolling walk-forward windows beyond the current single split.
- Add more fixture-driven tests for next-open execution, slippage, stops, missing bars, flat/long transitions, and benchmark calendar alignment.
- Separate showcase ranking from validation reporting more explicitly in UI and docs.
- Evaluate external factor-return datasets for market, momentum, value, quality, and low-vol attribution.

## Data and providers

- Improve provider observability with per-provider hit/failure summaries that do not expose credentials.
- Add deterministic tests for Yahoo, Polygon, Alpha Vantage, and fallback transitions.
- Document fixture refresh criteria and expected review steps.

## Maintainer operations

- Define a release-tag convention once the project starts cutting tagged releases.
- Add a release notes template if manual changelog maintenance becomes repetitive.
- Track security-sensitive review checklists for auth, sessions, persistence, CSP, provider credentials, and LLM payloads.

## Deferred

- Broker or paper-broker integrations are deferred until risk gates, audit logs, and simulation boundaries are documented clearly.
- Package publishing is deferred; the repo is currently operated as an application/workbench, not an npm library.
