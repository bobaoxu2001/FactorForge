# Event Intelligence — architecture, methods and limits

FactorForge's event layer turns a news event into research that can be checked later. It records what happened and how well each claim is sourced. It measures what markets did. It maps exposure through explicit mechanisms. It keeps theses whose history cannot be rewritten, and it scores its own forecasts.

It is built to say "unknown", "disputed", "proposed, not enacted" and "abstain" when those are the honest answers.

Routes: `/events` (event radar), `/events/[case]` (overview, evidence, market, impact, scenarios, memo), `/theses` (thesis tracker), `/forecasts` (forecast scorecard).

---

## 0. Audit before building (Phase 0)

What already existed and was reused:

| Need | Existing component | How it is reused |
|---|---|---|
| Provenance vocabulary | `src/lib/intel/types.ts`: `Evidence`, `SourceRef`, origins, verification | Same principle, extended. Event claims add an epistemic class, a derived verification state and a separate lifecycle. |
| Snapshot pattern | `scripts/build-research-snapshot.mjs` → `src/__fixtures__/research/*` | New `scripts/build-event-snapshot.mjs` → `src/__fixtures__/events/*`, with the same keyless Yahoo endpoints and a run log. |
| Point-in-time discipline | `financials.ts` `knownAt`; lead-lag holdout | `eventAsOf()` filters sources by publication time; the forecast model slices prices to its cutoff. |
| Thesis, triggers, memo | `src/lib/intel/thesis.ts`, `memo.ts` (freight-specific) | Pattern reused, not the code. Event theses need an immutable original and replayed revisions, which the freight thesis model does not have. |
| Market stress / regimes | `src/lib/quant/marketStress.ts` | Regimes for evaluation use the benchmark's volatility percentile (simpler, testable); stress diagnostics stay where they are. |
| Hotspot scenarios | `src/lib/agents/scenarioForecast.ts` | Not reused for forecasting: its probabilities are template priors. Event scenarios carry no probabilities. |
| Weekly refresh | `.github/workflows/refresh-fixtures.yml` (opens a review PR) | Two steps added: `events:refresh` and `events:forecast`. No Vercel cron and no serverless function polling. |
| UI primitives | `components/intel/ui.tsx`, `StageNav` | Reused directly; `StageNav` gained an optional `basePath`. |

Gaps found:
- No event model, no source-independence logic and no claim-level verification.
- No event-window market measurement.
- No forecast record anywhere in the codebase; backtests are not forecasts.
- No revision history for any thesis.

Risks were stale universe prices and benchmarks that contain the affected stocks.
- **Stale prices:** the quant snapshot ends in July 2026, so the event layer has its own snapshot.
- **Contaminated benchmarks:** discussed in §5.

## 1. Architecture

```
 Sources read by the platform ──► case files (src/data/events/cases/*.ts)
   official releases, company       events · claims (paraphrased, cited) · sources
   statements, newsrooms,           impact graph · exposures · scenarios · theses
   technical reports                │
                                    │  verification.ts  (derived states, as-of views)
 Yahoo chart + quoteSummary ──► scripts/build-event-snapshot.mjs
   (keyless)                        └─► src/__fixtures__/events/{prices,fundamentals,manifest}.json
                                    │
                                    ▼
 Domain layer (pure, src/lib/events/)
   time.ts        offsets required; NY close incl. DST; first reaction bar
   sources.ts     canonical URLs; wire-copy collapse; independence keys
   verification   claim → RUMOR/REPORTED/CORROBORATED/CONFIRMED/DISPUTED + reason
                  lifecycle guard; eventAsOf(); quantity ledger; case validation
   market.ts      aligned returns; market model; abnormal returns, t-stats,
                  persistence; group reactions
   impact.ts      causal graph; path tracing; net direction; market reconciliation;
                  exposure profiles (classified + measured)
   forecast.ts    ewma-interval-v1; leakage-proof predict(); scoring
   evaluation.ts  walk-forward; coverage, MAE/RMSE, Brier, hit rate; regimes;
                  direction validation
   thesis.ts      immutable thesis; trigger replay; materiality; price-trigger rule
   ledger.ts      sha-256 hash chain; verify; append
   view.ts / memo.ts   server assembly (memoised); generated memo
                                    │
 Ledgers (append-only, committed)   src/data/events/{forecast,thesis}-ledger.json
                                    │
 Routes                             /events · /events/[case]/* · /theses · /forecasts
```

Nothing here runs on a schedule inside the web app. Pages are statically generated from committed files. The weekly GitHub workflow refreshes prices and appends rolling forecasts through a reviewed pull request.

## 2. Events, claims and verification

The code keeps three questions apart:

| Question | Field | Values |
|---|---|---|
| What kind of statement is it? | `epistemic` | OBSERVED_FACT · REPORTED_CLAIM · ANALYST_INTERPRETATION · CAUSAL_HYPOTHESIS · MODEL_ESTIMATE · UNKNOWN |
| How well is it sourced, as of a date? | derived `verification` | RUMOR · REPORTED · CORROBORATED · CONFIRMED · DISPUTED |
| Where is it in its life? | `lifecycle` | OPEN · PROPOSED · ENACTED · IMPLEMENTED · REVISED · RESOLVED |

Verification is computed from the citations available at the cutoff, never typed in. The rules are in `verification.ts`:

- **CONFIRMED.** One of these holds:
  - An official primary source says it first-hand.
  - A company describes its own conduct. The UI says this means "the company said so", not that the substance was checked.
  - An original technical report states its own finding.
  - The claim is read off market data.
- **CORROBORATED:** two or more independent origins.
  - Wire copies, syndications, AMP pages and two versions of one article all count once (`sources.ts`).
- **REPORTED:** one origin, or claims resting on unnamed sources.
- **RUMOR:** only aggregators or rewrites carry it.
- **DISPUTED:** a source available at the cutoff contradicts it, and no official first-hand source settles it.
- **`requiresOfficial` claims** (attribution, enactment) top out at CORROBORATED until an official page is read first-hand. A blocked or unread source supports nothing.
- **Lifecycle guard:** a claim marked ENACTED, IMPLEMENTED or REVISED without an official first-hand source is shown as PROPOSED, with the reason.

Timestamps:
- Every timestamp carries an explicit offset; naive timestamps are rejected.
- Day-precision sources are dated to the end of their day, so they are never treated as available early.
- A wire story whose displayed time precedes the close it reports is dated after the close.
- `eventAsOf(event, cutoff)` rebuilds the event from sources published by the cutoff. Forecasts and thesis replays read the event this way, so they cannot see the future.

Quantities are kept on separate lines:
- Affected, frozen, replenished and recovered are never mixed or summed.
- A kind with no source is shown as unknown, not zero.
- Freezes by different parties (Binance, Tether, Circle) are listed separately because no source says whether they overlap.

## 3. Market transmission

`eventStudy()` measures the reaction against a market model, abnormal return = r − (α + β·r_benchmark):
- α and β are fitted on 120 sessions ending 10 sessions before day 0.
- With fewer than 60 sessions it falls back to market-adjusted returns.
- Day 0 is the first daily bar that closed after the event.
  - An event at 17:05 Brasília (16:05 New York) is after the NYSE close, so US equities react on the next session.
  - Crypto UTC bars react the same day.
- Windows are [0,0], [0,1], [0,4] and [0,19], each with a t-statistic.
- A window that runs past the data is marked incomplete, never truncated.
- Persistence after five bars is labelled persistent, partly reversed, reversed or within noise.
- Windows that contain another registered event's first reaction bar are flagged as overlapping, so multi-day figures are not attributed to one event.

## 4. Impact map and exposure

The graph runs event → mechanism → industry → company → expectations → valuation → price.

Each link carries:
- a sign (+, −, ±)
- the mechanism in words
- an epistemic class
- its evidence ids
- a confidence and a horizon

A company's direction is the product of signs along each path from the event. Rules:
- Paths that disagree make the company *ambiguous*. Restrictions can delay demand and raise the value of scarce capacity at the same time.
- Paths whose links have no evidence are shown but do not set the direction.
- The map is compared with the measured day-0 abnormal return. A clear reaction against the map is flagged *contradicted* and is never re-explained.
- Validation rejects backward links and any causal link labelled an observed fact.

Exposure profiles cover seven dimensions: direct revenue, supply chain, cost, geography, valuation, leverage and sentiment.
- Valuation, leverage and sentiment are measured from the snapshot and price history.
- The other four are analyst classifications of public business descriptions, marked "not yet checked against filings".

## 5. Forecasts and their scoring

Model `ewma-interval-v1` (`forecast.ts`):
- **Point forecast:** zero log return (random walk).
- **80% range:** EWMA volatility (λ = 0.94) × √horizon. A relative range is built the same way on returns minus the benchmark.
- **P(up):** the instrument's base rate over the last 500 bars, shrunk toward 0.5 with 50 pseudo-observations.
- **Direction:** issued only if walk-forward testing *up to the cutoff* finds skill. That means a hit rate above 50% at p < 0.05 on effective (de-overlapped) observations, a Brier score below a coin flip's, and both halves of the sample agreeing. Otherwise **ABSTAIN**.
- **INSUFFICIENT_DATA:** returned when there are fewer than 250 returns, or the last price is more than five days older than the cutoff.

Leakage guard:
- `predict()` receives full series and slices them to the cutoff itself.
- Tests append crash-sized future bars and check that every prediction is unchanged.
- Tests re-derive every stored ledger forecast from data up to its cutoff.

Ledger rules:
- Records are hash-chained. Each hash covers the record plus the previous hash, so an edit or deletion breaks the chain, and the test suite verifies it on every run.
- A record is **live** if it was written before its first target bar closed; otherwise it is **backfill**, and the UI and docs say backfill is not a track record.
- Round-trip costs (5/10/20 bp for ETFs, stocks and crypto) apply to any directional call.

Scoring (`scoreForecast`) records:
- the realized return
- the benchmark return over the same interval (last bar on or before each date, for mixed calendars)
- excess return and error
- whether the outcome fell in the range and the relative range
- hit or miss on direction, when one was given
- Brier score
- net directional return

A forecast stays pending until its horizon has passed.

Walk-forward evaluation (`evaluation.ts`):
- **Sampling:** origins every five bars, no refitting on the test period.
- **Range quality:** coverage and relative coverage, and coverage split into calm, normal and stressed regimes (benchmark 20-day volatility percentile).
- **Errors:** MAE and RMSE of zero drift versus a trailing-mean drift.
- **Skill:** Brier skill and hit rate versus the share of up outcomes.
- **Calibration:** a calibration table.
- **Sample size:** an effective n that corrects for overlapping horizons.

Generating forecasts:
- `npm run events:forecast` appends every planned forecast not yet on the ledger.
- Plans live in each case. A plan with `informationCutoff: "latest"` is a rolling plan: the weekly workflow re-runs it on each instrument's last complete bar, building a genuinely live record over time.
- The writer runs under Vitest so it can use the typed domain code without adding a TypeScript runner.

## 6. Theses

A thesis stores:
- its question and verbatim statement
- publication time and information cutoff
- origin: live, or backfill with a note
- critical assumptions and supporting or contradicting claims
- monitoring items and triggers
- linked forecasts and an outcome rule

Its content hash goes into `thesis-ledger.json`. Editing a published thesis fails the test suite: a changed view must be a new thesis.

History is *replayed*, not stored:
- **Checkpoints:** every moment a cited source became available, plus completed market observations, up to the horizon.
- **Triggers:**
  - A claim reaching a verification level or lifecycle state.
  - Any claim with a tag.
  - A market observation crossing a threshold.
- **Revision logic:**
  - A revision is recorded only when a trigger fires.
  - The revision records the explanation, assumption updates and "what the earlier view got wrong".
  - New claims that touch no trigger are logged as reviewed without change.
- **Price triggers** may only move a thesis to UNDER_REVIEW; validation rejects anything stronger.
- **Live theses** count evidence from when the platform *recorded* it. A back-dated claim lands when it was learned, so earlier revisions never change; a test checks this prefix stability.
- **Backfill theses** replay on publication time and are labelled reconstructed.
- **After the horizon** the thesis closes and is scored against its outcome rule. Evidence that arrives later is listed for the post-mortem but cannot revise the record.
- **Cutoff check:** validation rejects a thesis that cites a claim no source had published by its cutoff.

## 7. The two seeded cases: what the data show (snapshot built 8 Nov 2026)

**Binance, 29 Oct 2026**

Sourcing:
- Root cause, the role of AI tooling and the amounts rest mainly on Binance's own preliminary report.
- On that account, access control and transaction authorization failed (stolen credentials, a deployment token, a signing service), not a blockchain protocol.
- Binance says an internal AI tool was a foothold. The engine records this as a reported claim, not a demonstrated cause.
- The FBI alert returned HTTP 403, so the DPRK attribution stays CORROBORATED (second-hand), not CONFIRMED.

Amounts:
- Frozen or intercepted: about US$2.85bn.
- Replenished from company funds: 98%, per Binance.
- Recovered: unknown.

Market reaction:
- BNB fell 5.2% more than bitcoin explains on the event day (t ≈ −4.2), and the gap persisted over five days.
- Other large coins moved with bitcoin.
- US-listed crypto equities fell on 30 Oct, but the Nasdaq-100 fell 3.5% that day. Benchmark-adjusted, no crypto equity's move was significant.
- Security stocks showed no significant day-0 reaction. Their larger five-day declines overlap the 4–5 Nov election and AI selloff and cannot be attributed to the breach.

**AI data centers, 5 Nov 2026**

Policy status:
- In force: New York's executive order and Texas's permit halt, both temporary.
- Proposed only: everything the election added, plus a federal bill introduced in March.
- An aggregator's claim of a Texas grid-connection freeze is guarded as unconfirmed.

Market reaction:
- Neither enacted order produced a reaction beyond noise in the instruments measured (first sessions 15 Jul and 22 Sep).
- On 4 Nov, the first session after the results, power, cooling, grid and generation names fell sharply relative to SPY: VRT −17.3%, VST −16.1%, ETN −13.5%, GEV −12.3%, CEG −8.7%. CoreWeave fell 11.7% relative to QQQ. MSFT and AMZN *rose* about 6%.
- On 5 Nov the decline was market-wide: Nasdaq Composite −5.5%, S&P 500 −4.4%. No single stock moved significantly beyond what its benchmark explains.
- Caveat: AI names dominate QQQ, so benchmark-adjusted returns understate a sector-wide shock. Raw returns are shown alongside.
- Coverage of 5 Nov names policy, a Qualcomm miss (aggregator-sourced), positioning and financing worries. Yields fell. The engine lists these as competing explanations and does not pick one.

**Forecasts**
- 76 forecasts on the ledger, 75 abstaining on direction.
- One validated call (MSTR, one day, down) missed: MSTR rose 0.2%.
- Of 17 realized forecasts, 16 landed inside their 80% range. AMD's +11% on 6 Nov did not.

## 8. Known limitations

**Sources**
- Most event facts come from a handful of sources read on 8 Nov 2026. Reuters, CNN, the FBI alert and two crypto outlets refused automated access.
- There is no news-ingestion pipeline. New events and claims are added by hand in case files, paraphrased with links.

**Exposure**
- Business exposure is classified, not quantified.
- Segment revenue shares need SEC filings, which need `SEC_EDGAR_USER_AGENT`.
- That variable is not set in this environment; it is set in the weekly workflow.

**Market data**
- Fundamentals are vendor fields (Yahoo quoteSummary), not audited figures.
- Three years of daily bars cover few regimes, so stressed-regime statistics rest on a handful of episodes.
- Overlapping 20- and 60-bar forecasts leave few independent observations.

**Event studies**
- They use a single benchmark per instrument.
- A sector-neutral or equal-weight benchmark would reduce contamination when the affected stocks dominate the index.

**Track record**
- The backfilled theses and forecasts demonstrate the machinery on real outcomes.
- The author knew later events, so they are not evidence of foresight.
- The live record starts on 8 Nov 2026.

**Process**
- Thesis triggers fire on claims the case author tags. Tagging new evidence is manual.
- An LLM could propose tags and extract entities. It must not decide verification or compute returns.

## 9. Extending it

**Add an event to an existing case**
1. Add `SourceRecord`s with offsets, a retrieval state and a note if unread.
2. Add `Claim`s with paraphrased citations and tags.
3. Add an `EventRecord` with its core claims, timeline and competing explanations.
4. Add a market window.
5. Run `npm test`. Case validation, graph validation and thesis validation all run.

**Add a case**
1. Create `src/data/events/cases/<id>.ts`.
2. Register it in `src/data/events/index.ts`.
3. Add any instruments to `instruments.json`, then run `npm run events:refresh`.
4. Add theses and forecast plans, then run `npm run events:forecast`.

**Add an event category**
- Add a key to `EventCategory` and a row to `EVENT_CATEGORIES`.
- Nothing else branches on category.

**Connect a data source** behind the same `SourceRecord`/`Claim` contract:
- **News or filing feeds:** e.g. SEC EDGAR full-text and 8-K items, Federal Register, state legislature APIs.
  - The adapter should store publication time with offset, retrieval state, canonical URL and originator.
  - It should never write verification.
- **Grid and permitting data:** ERCOT, PJM or other ISO interconnection queues; FERC eLibrary; state permit registries. These become market-data-tier or official sources for infrastructure claims.
- **On-chain data:** for exchange incidents, it would let "frozen" and "recovered" be observed facts.

**Structured channel checks** can fit the same model. Interview notes become claims whose source tier is a new `primary-research` value.
- Each would carry a compliance record (consent, no MNPI, reviewer).
- The verification rules would treat them as one origin each.
- The freight case's primary-research workspace (MNPI and PII screening) is the starting point.
- No interview is recorded today, and proposed interviews are never shown as completed.

## 10. Next engineering priorities

1. Quantify revenue exposure from 10-K segment notes, and attach the facts as evidence ids on impact links.
2. Add an ingestion adapter for official sources (Federal Register, state governors' feeds, SEC 8-K) that proposes claims for human review.
3. Add sector-neutral benchmarks for event studies (equal-weight sector baskets, or a factor model).
4. Fill in the live forecast record weekly; report calibration once each horizon has 30+ effectively independent realized forecasts.
5. Have an LLM assist with tagging new claims against open thesis triggers, with every suggestion requiring confirmation.
6. Move the ledgers from committed JSON to an append-only table once there is a persistence backend. The hash chain carries over unchanged.
