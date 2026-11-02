# FactorForge Research Platform — Target Architecture

*Companion to [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md). Written before implementation and updated to match what shipped.*

## 1. Product principle

> Information → evidence → differentiated insight → thesis → risk-adjusted decision → outcome review.

Every screen answers a research question, not "buy or sell". Every number is computed in code from a dated, attributable source. Every claim links to an evidence record, and every evidence record says what kind of thing it is:

| Origin | Meaning | Can it be "verified"? |
|---|---|---|
| `public-secondary` | Government dataset, SEC filing, filing excerpt, market data | Yes: verified against the retrieved source |
| `user-primary` | Interview notes or channel checks **the user** recorded | Only by the user's own attestation, shown as such |
| `ai-generated` | Copilot output: questions, guides, drafts | **Never.** It is a work product, not evidence |
| `hypothesis` | Analyst or configured assumption awaiting a test | No; it is tested by evidence |

Verification statuses: `verified · partially-verified · unverified · contradicted · stale`. *Stale* is computed: an evidence item older than its source's expected cadence plus publication lag is downgraded automatically.

## 2. Layered architecture

```
                         ┌──────────────────────────────────────────────┐
  Sources (public)       │ SEC EDGAR XBRL + submissions + 10-K text     │
                         │ FRED series (+ licence, units, release date) │
                         │ Yahoo chart OHLCV + split events             │
                         └───────────────┬──────────────────────────────┘
                                         │ scripts/build-research-snapshot.mjs
                                         ▼  (dated, provenance-tagged, licence-checked)
  Snapshot fixtures      src/__fixtures__/research/<project>/{manifest,macro,companies,prices}.json
                                         │
                                         ▼
  Domain layer (pure)    src/lib/intel/
                           series.ts      monthly alignment, YoY/MoM, z-score anomalies, lead-lag,
                                          freshness vs. cadence
                           financials.ts  XBRL quarterisation (3M facts, YTD differencing, FY−9M),
                                          TTM, point-in-time "as known on date D", debt composition
                           valuation.ts   P/E, EV/EBITDA, EV/Sales, FCF yield, PIT multiple history,
                                          scenario valuation, sensitivity grid, FCFF DCF
                           attribution.ts OLS + t-stats, market/sector decomposition,
                                          multiple-testing haircut (expected max Sharpe under null)
                           evidence.ts    evidence registry: data-derived + filing-excerpt evidence,
                                          validation (IDs, URLs, origins, stale downgrade)
                           thesis.ts      hypotheses, KPI tests, invalidation triggers, monitoring
                           quality.ts     transparent completeness checks (pass/warn/fail + reason)
                           primary.ts     stakeholder plan, interview guides, MNPI/PII screening,
                                          deterministic note analysis
                           memo.ts        19-section memo assembly, status classification, Markdown
                           copilot.ts     retrieval, grounded prompt, citation validator, fallback
                           workspace.ts   versioned client-side research store (reducer + migration)
                           project.ts     server: assemble ResearchProjectView (memoised)
                                         │
  Config (data, not code) src/data/research/  kpiFrameworks.ts, projects/freight.ts
                                         │
  Routes                 /                 Research Home (projects, coverage, catalysts, tasks)
                         /research/[id]    Project overview + stage navigator
                           /industry       Value chain graph + market structure + drivers
                           /kpis           KPI explorer, freshness, anomalies, lead-lag
                           /companies      Competitive intelligence matrix
                           /companies/[t]  Company research: financials, valuation, catalysts, quant lens
                           /primary        Channel-check plan, interview guides, user notes (local)
                           /evidence       Evidence explorer (filter, trace claim → source)
                           /thesis         Hypotheses, scenarios, risk/reward, monitoring, review
                           /memo           Memo builder (editable, Markdown export)
                           /copilot        Grounded research copilot
                         /research/frameworks  KPI frameworks for other industries
                         /quant            Former overview (quant lab), unchanged otherwise
                         /api/research/copilot  POST, rate-limited, LLM-or-deterministic
```

The existing quant pipeline (`src/lib/research.ts`, `src/lib/quant/*`) is **not modified** except for the P0 fixes. The research layer reuses its indicators, strategy runner and formatting helpers.

## 3. Core data models (abridged; see `src/lib/intel/types.ts`)

```ts
SourceRef      { id, title, publisher, url, sourceType, licence?, retrievedAt, publishedAt? }
Evidence       { id, projectId, subject, claim, excerpt?, location?, source: SourceRef,
                 origin, status, confidence: "high"|"medium"|"low", confidenceRationale,
                 observationPeriod?, publishedAt?, retrievedAt,
                 kpiIds[], tickers[], hypothesisIds[], stance: {hypothesisId → supports|contradicts|context} }
KpiDefinition  { id, name, definition, units, frequency, sourceSeriesId?, leading|coincident|lagging,
                 collectionMethod, comparabilityNotes[], seasonalAdjustment, licence }
KpiReading     { kpiId, observationDate, value, yoy, momOrQoq, zScore, anomaly, freshness }
Relationship   { from, to, type, status: verified|inferred|hypothetical, evidenceIds[], rationale }
Hypothesis     { id, statement, direction, tests: KpiTest[], invalidation: Trigger[] }
Trigger        { id, description, kpiId|metric, rule, window } → evaluated: holding|triggered|insufficient-data
ScenarioInput  { case, revenueGrowth, operatingMargin, multiple, probability?, justification? }
Memo           { status: exploratory|draft-incomplete-verification|evidence-backed, sections[19], asOf, limitations[] }
WorkspaceState { version, notes[], interviews[], evidenceOverrides{}, scenarioProbabilities{}, memoEdits{} }
```

## 4. Information architecture

| Group | Routes |
|---|---|
| **Research** | Research Home `/`, Freight case study `/research/freight/*`, KPI Frameworks, Copilot |
| **Quantitative** | Quant Overview `/quant`, Factors, Strategies, Radar, Consensus, Portfolio, Quant Screen (`/picks`), Market Stress (`/ai-market`), Thematic Hypotheses (`/hotspots`) |
| **Portfolio & Monitoring** | Paper Observation, Trade Simulator, Track Record |
| **Workspace** | Data Sources (`/data`), Reports, Learn, OSS, My Watchlist, Cache |

No empty pages: industries without a data adapter appear only in the KPI-framework library, marked "no connected source".

## 5. Methodology safeguards (implemented in code, enforced by tests)

1. **Point-in-time fundamentals.** Each XBRL fact keeps its *first* filing date and accession. Historical multiples at date D use only facts filed on or before D. Restatements are surfaced as revision history (`value` vs `latestValue`).
2. **Quarterisation is explicit.** Values come from direct 3-month facts where filed. Otherwise they are derived from YTD differences or FY − 9M, and each derived value carries `derivation: "ytd-difference" | "fy-minus-9m"`.
3. **One XBRL concept per metric per company**, with the concept name displayed, so line items never silently mix. Debt is a displayed sum of named components, with known exclusions.
4. **KPI comparability guard.** Lead-lag and comparisons refuse incompatible pairs (e.g. NSA vs SA levels) or explain the transform (YoY on both). Correlation is labelled in-sample and never called predictive. A split-half stability check and a train/holdout test (lag chosen on the first two-thirds, tested on later months) are shown next to it.
5. **Freshness.** Every series has an expected cadence and lag. Readings are flagged `fresh / lagging / stale` against the snapshot build date, and the snapshot age itself is shown on every page.
6. **Licences.** FRED licence labels are captured. "Pre-approval required" series are excluded from redistribution. "Citation required" series (Cass) carry a citation on every chart.
7. **No invented precision.** No composite "AI confidence" scores. Quality checks are pass/warn/fail with reasons. Scenario probabilities are blank until the user enters them *with a justification*; expected return is only computed when they sum to 100%.
8. **Backtest ≠ performance.** Company quant lens: strategy runs are labelled *backtest*, and the best-of-N Sharpe is compared with the expected maximum Sharpe of N null strategies.
9. **Primary research integrity.** AI-generated guides are typed `ai-generated` and cannot be promoted to evidence. User notes are `user-primary`, stored only in the user's browser, and screened for MNPI/PII patterns before any optional AI analysis (which requires explicit opt-in per request).
10. **Copilot grounding.** The LLM sees only retrieved evidence. Each fact or calculation must cite ≥1 existing evidence ID or it is moved to "unsupported". The response is always split into facts / calculations / interpretation / hypotheses / missing information. With no key, a deterministic handler answers from the same evidence.

## 6. Persistence strategy

- **Server data:** committed snapshots (reproducible, CI-testable, Vercel-safe), refreshed by `npm run research:refresh` and by the weekly workflow.
- **User research state:** browser `localStorage` (`factorforge.workspace.v1`), versioned with a migration function, plus JSON export/import. This keeps private notes off public demo servers. A DB-backed multi-user store can replace it behind the same reducer interface.

## 7. External access & secrets

| Variable | Purpose |
|---|---|
| `SEC_EDGAR_USER_AGENT` | Required by SEC fair-access policy *for the snapshot builder only* (`"Org contact@email"`). Never written to output. |
| `DEEPSEEK_API_KEY` | Optional; enables LLM copilot answers. Server-only. |
| `COPILOT_RATE_LIMIT_PER_HOUR` | Optional; defaults to 30 requests per IP per hour. |

No new runtime dependencies were added.

## 8. Implementation order (dependency-aware)

1. P0 fixes (profit factor, snapshot staleness, doc drift).
2. Snapshot builder → fixtures → drift-guard tests.
3. `series`, `financials`, `valuation`, `attribution` (pure math + tests).
4. Project config → `evidence`, `thesis`, `quality` (+ tests).
5. Pages: project shell/navigator → industry → KPIs → companies → company → evidence → thesis → memo.
6. `primary` + workspace store + Primary Research page.
7. `copilot` + API route + page.
8. Research Home, navigation, `/quant` move, search/sitemap updates.
9. Validation: lint, typecheck, tests, build, browser walkthrough.
10. Docs: README, methodology, this file.

## 9. Validation record (2026-11-01)

| Check | Result |
|---|---|
| `npm run lint` | No warnings or errors |
| `npm run typecheck` | Clean |
| `npm test` | 400 / 400 passed (71 files; 90 new research tests). After the follow-up methodology pass: 412 / 412 (73 files) |
| `npm run build` | Succeeded; 17 research pages prerendered (SSG), copilot API as a serverless function |
| Production smoke (`next start`) | Query-param pages (`?kpi=`, `?since=`, `?id=`) render correctly; unknown project or ticker returns 404 |
| Browser walkthrough | Home, overview, industry graph, KPIs (fuel residual), company page, primary-research save flow (compliance screen blocks until acknowledged), evidence explorer (user notes appear as user-primary), copilot, memo; no console errors; no horizontal overflow at 375px |
| LLM path | Exercised with a mocked model in route tests. The local DeepSeek key returned HTTP 402 (insufficient balance), so the live path fell back to deterministic answers as designed |
