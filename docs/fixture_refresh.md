# Fixture Refresh — Criteria and Review Steps

> **Also applies to the fundamentals fixture** (`src/__fixtures__/fundamentals-snapshot.json`, refreshed via `npm run fundamentals:refresh`): same provenance rule (script only, never hand-edited), same isolation rule (own commit), and its drift guard lives in `fundamentals.test.ts` (keys must match the universe's single-name stocks). It backs the value/quality tiers on `/picks` when the live Yahoo quoteSummary tier is unavailable, always labeled with its as-of date. The script honors `HTTPS_PROXY` since some networks geo-block Yahoo endpoints.

The committed market-data fixture (`src/__fixtures__/yahoo-snapshot.json`) is a real 3-year Yahoo OHLCV snapshot of the research universe. It powers three things:

1. The **pipeline snapshot test** (`src/lib/research.snapshot.test.ts`) — the full factors → backtests → radar → portfolio → concentration run in CI, network-free.
2. The **demo wait budget** in `src/lib/data/marketData.ts` — when live providers exceed `MARKET_LIVE_WAIT_MS`, pages serve the snapshot (labeled as snapshot data, never as synthetic fallback).
3. The **universe drift guard** (`src/data/watchlist.test.ts`) — asserts the fixture's keys match `DEFAULT_SYMBOLS` exactly.

## Scheduled refresh

A weekly GitHub Actions workflow (`.github/workflows/refresh-fixtures.yml`, Mondays 05:00 UTC, also runnable via *workflow_dispatch*) starts from `main`, refreshes market, fundamentals and event fixtures, and appends forecast and thesis records. It stages `src/__fixtures__/` plus both `src/data/events/forecast-ledger.json` and `src/data/events/thesis-ledger.json`, verifies lint/typecheck/tests/build against those changes, and opens (or updates) a `chore/scheduled-fixture-refresh` PR. The PR is the review gate — walk the steps below before merging; nothing lands on `main` automatically. Note that CI does not auto-trigger on the bot-created PR (GitHub token limitation); the same gates already ran inside the refresh workflow.

Before any refresh, `scripts/check-refresh-history.mjs` reads the existing bot branch's two ledgers without checking out its code. Replacement is allowed only when every pending record is already preserved, in the same order, in the base checkout. If a prior PR contains unmerged records or a conflicting chain, the workflow stops with an instruction to merge or reconcile that PR first. Keep those records intact; do not delete the branch to bypass this check. Publication uses an explicit `--force-with-lease` against the inspected commit, so a concurrent branch update also stops the push.

### Fixed research editions

Scheduled refreshes deliberately leave `src/__fixtures__/research/` and the freight writing sample unchanged, even when a SEC contact secret is configured. `revision.json` pins that edition's information cutoff, and the app rejects retrievals newer than it. Running `research:refresh` alone against the published edition would break the build and make its PDF inconsistent.

To publish a new edition, run `npm run research:refresh` explicitly with a valid `SEC_EDGAR_USER_AGENT`, review source definitions and changed conclusions, update the edition ID/date/cutoff in `src/data/research/revision.json`, review the separately maintained direct-source extracts, and regenerate the writing-sample data/PDF together. Run all normal checks and compare the rendered sample with the PDF before merging that dedicated edition change. A macro-only refresh also requires a new edition; it is not an exception to the cutoff rule.

## When to refresh

Refresh (`npm run fixture:refresh`) only when one of these is true:

- **The universe changed** — a symbol was added, removed, or renamed in `src/data/watchlist.ts`. This is mandatory: the drift guard fails CI until the fixture matches. Also update the symbol list copy in `scripts/build-fixture.mjs`.
- **The snapshot is stale enough to distort demos** — the wait-budget path shows coverage dates on `/data`; refresh when the gap between the fixture's last bar and today misrepresents what the platform demos.
- **The `MarketPrice` row shape changed** — the fixture stores only the fields the pipeline consumes (date/open/high/low/close/volume); a shape change requires a rebuild.

Do **not** refresh casually alongside unrelated changes — a fixture diff is large, unreviewable line-by-line, and changes what every snapshot-style invariant runs against. Isolate it in its own commit.

## Review steps for a fixture diff

- **Provenance** — confirm the diff came from `npm run fixture:refresh` (Yahoo, 3y, universe symbols), not manual edits. Hand-edited rows are never acceptable; if a test needs a crafted scenario, build a small dedicated fixture in the test instead.
- **Key set** — keys must equal `DEFAULT_SYMBOLS` exactly (the drift guard enforces this; check locally with `npm test`).
- **Coverage sanity** — spot-check a few symbols: `quality.rows` in a plausible range for 3y of trading days (~700+), `firstDate`/`lastDate` consistent across symbols, no symbol with a drastically shorter history than its peers unless the listing is genuinely young.
- **No synthetic leakage** — every entry must have `isFallback: false` and `quality.source: "yahoo"`. A fallback row in the committed fixture would silently turn "real-data" claims in the UI and README into fiction.
- **Snapshot-test drift** — run `npm test`. The pipeline test asserts shape and ranges, not exact numbers, so a refresh alone should pass. If a refresh breaks tests, the engine's behavior changed with the data — treat that as a finding to explain in the PR, not a test to loosen.
- **Commit message** — state why the refresh was run (universe change / staleness / shape change) and the new coverage window, per the [release checklist](release_checklist.md).
