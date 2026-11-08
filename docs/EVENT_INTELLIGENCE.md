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
- Windows are [0,0], [0,1], [0,4] and [0,19]. Each cumulative abnormal return (CAR) gets two checks:
  - a t-statistic whose variance includes the error in estimating α and β, σ²·(L + L²/n + (ΣRm − L·R̄m)²/Sxx). On a day the benchmark itself moves 4–5%, this widens the band noticeably;
  - a placebo rank: the share of the asset's own previous 500 sessions (L-day windows) whose |CAR| was at least as large. It does not assume normal returns.
- A move counts as significant only when |t| ≥ 1.96 **and** the placebo share is at most 5%. Each window also reports how many day-0 tests passed against how many would by chance (5% of tests).
- Every US equity is also measured against the equal-weight S&P 500 (RSP), and each count is labelled with its benchmark. A stock's expected move is its estimated beta times its benchmark's move, and both differ between QQQ/SPY and RSP, so the two comparisons can disagree. Where they do, the result is reported as benchmark-sensitive; neither is treated as the true one.
- Registered events whose reaction falls inside the 120-session estimation window are listed, with whether they themselves produced a significant reaction.
- All of this measures association around a date. It does not establish that the event caused the move.
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

Model `ewma-interval-v2` (`forecast.ts`; v1 → v2 changed only the direction gate, see below):
- **Point forecast:** zero log return (random walk).
- **80% range:** EWMA volatility (λ = 0.94) × √horizon. A relative range is built the same way on returns minus the benchmark.
- **P(up):** the instrument's base rate over the last 500 bars, shrunk toward 0.5 with 50 pseudo-observations.
- **Direction:** issued only if walk-forward testing *up to the cutoff* finds skill. Under v2 that means all of:
  - the rule beats the better constant rule (always up or always down) in a paired sign test on the origins where they disagree, scaled to the effective sample size;
  - the result survives a Holm correction across every instrument × horizon tested together (60 tests today);
  - its Brier score beats the hindsight base rate (a constant forecast equal to the realized up share), not merely a coin flip;
  - both halves of the sample agree.
  Otherwise **ABSTAIN**.
- **Why v2:** v1 compared the hit rate with 50% and tested each instrument alone. A trailing base-rate rule on a drifting asset just calls the drift's side every time, so v1 could "validate" a constant rule. Its one directional call, MSTR one day down (cutoff 30 Oct), was exactly that: 62% hits against 60% for "always down", raw p = 0.44 against the constant rule, adjusted p = 1.00. The record stays on the ledger unchanged; the scorecard shows beside it that v2 would have abstained.
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
- arithmetic excess return r − r_benchmark, and error
- relative wealth return (1 + r) / (1 + r_benchmark) − 1
- whether the outcome fell in the range, and whether the relative wealth return fell in the relative range

The relative range is built from log(asset) − log(benchmark) returns and exponentiated, so it targets the relative wealth return, not the arithmetic difference. Scoring `score-v1` compared it with the arithmetic difference; `score-v2` (8 Nov 2026) compares like with like and keeps the arithmetic excess as a separate figure. Scores are derived at read time, so no stored record changes; the score carries its version, and the v1 comparison is kept beside it. For the 16 relative ranges realized so far the two rules agree; they diverge when moves are large (tests pin two such cases).
- hit or miss on direction, when one was given
- Brier score
- net directional return

A forecast stays pending until its horizon has passed.

Walk-forward evaluation (`evaluation.ts`):
- **Sampling:** origins every five bars, no refitting on the test period.
- **Range quality:** empirical coverage against the nominal 80%, with a 95% Wilson interval on the effective sample, overall and by calm, normal and stressed regime (benchmark 20-day volatility percentile). Each row is labelled consistent, too narrow, too wide or too few to judge.
- **Pooled coverage:** across instruments per horizon. Instruments miss together, so the pooled effective n is the sum of per-instrument effective n divided by the design effect 1 + (m − 1)·ρ̄, where ρ̄ is the mean pairwise correlation of the inside-the-range indicators.
- **Errors:** MAE and RMSE of zero drift versus a trailing-mean drift.
- **Skill:** hit rate against both constant rules, the paired sign test, Holm-adjusted p, Brier skill against a coin flip and against the base rate.
- **Calibration:** a calibration table.
- **Sample size:** effective n is the smaller of the overlap count (n × step / horizon) and an autocorrelation-adjusted count with Bartlett weights, so dependence from volatility clustering is caught as well as path overlap.

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
- **Trigger wording (from 8 Nov 2026, 10:00 UTC):** a trigger label that says "confirmed" must require CONFIRMED, and one that calls something a driver or cause, or keys on a causal hypothesis, may only prompt a review. No verification state can show that one thing drove another. Earlier theses are immutable, so they are not rejected; the rules are reported beside them.
- **Current assessments:** a case can attach dated notes to a thesis's statement or a trigger, saying what the evidence now supports. They are shown beside the original and are not part of its hash.

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
- BNB fell 5.2% more than bitcoin explains on the event day (t ≈ −4.1; only 2% of its previous 500 days moved as much). About four-fifths of the gap remained after five days, though the five-day figure on its own is within noise.
- Other large coins moved with bitcoin. Bitcoin's own −4.3% against QQQ no longer counts once fat tails are allowed for (5.8% of earlier days moved as much).
- US-listed crypto equities fell on 30 Oct, but the Nasdaq-100 fell 3.5% that day. Against QQQ, none of the 12 equities measured moved beyond noise. Against the equal-weight S&P 500, COIN (−9.0%) sits right at the 5% placebo threshold; the rest do not. QQQ itself fell 2.7% more than the equal-weight index that day, a megacap move, not a crypto one.
- Security stocks showed no significant day-0 reaction. Their larger five-day declines overlap the 4–5 Nov election and AI selloff and cannot be attributed to the breach.

**AI data centers, 5 Nov 2026**

Policy status:
- In force: New York's executive order and Texas's permit halt, both temporary.
- Proposed only: everything the election added, plus a federal bill introduced in March.
- An aggregator's claim of a Texas grid-connection freeze is guarded as unconfirmed.

Market reaction:
- Neither enacted order produced a reaction beyond noise in the instruments measured (first sessions 15 Jul and 22 Sep).
- On 4 Nov, the first session after the results, power, cooling, grid and generation names fell sharply relative to SPY: VRT −17.3%, VST −16.1%, ETN −13.5%, GEV −12.3%, CEG −8.7%. MSFT and AMZN *rose* about 6%. 9 of 18 day-0 tests pass both checks, against about 1 expected by chance, and the power and grid results hold against the equal-weight index too. CoreWeave's −11.7% against QQQ does not pass the placebo check (6.7% of its earlier days moved as much); SMH and NVDA pass against their own benchmarks but not against the equal-weight index.
- On 5 Nov the broad market fell (SPY −4.4%, QQQ −6.5%, equal-weight RSP −2.9%). The stock-level result depends on the benchmark. Against each stock's own benchmark (QQQ or SPY), 0 of 19 day-0 moves pass both checks. Against RSP, 7 of 19 do: SMH −7.4%, NVDA −7.0%, AMD −12.3%, AVGO −8.3%, ANET −8.6%, VRT −10.0% and EQIX −3.6%; the hyperscalers do not. QQQ and SPY fell further than RSP, and these stocks' estimated betas to them are high, so the moves QQQ and SPY predict are already large. The data show sensitivity to the benchmark, not where the selling came from or why.
- Coverage of 5 Nov names policy, a Qualcomm miss, positioning and financing worries. Yields fell. The engine lists these as competing explanations and does not pick one.
- The Qualcomm miss is reported by one aggregator only (a rumour by the engine's rules); QCOM's 9.5% fall is an observed fact, but against QQQ it is within noise, so the market check counts against, not for, a Qualcomm-specific driver. T-AI-1's statement mentions "an earnings miss" and its trigger TR-A2 is labelled "confirmed as a driver"; both are kept as published, with a dated assessment beside them. TR-A2 has not fired.

**Forecasts**
- 78 forecasts on the ledger, 77 abstaining on direction. The two newest are the first made under v2.
- One v1 call (MSTR, one day, down) missed: MSTR rose 0.2%. The v2 gate would have abstained.
- No live forecast has realized yet. Of 19 realized backfilled forecasts (worked examples, not foresight), 18 landed inside their 80% range. AMD's +11% on 6 Nov did not.
- Walk-forward over three years: no instrument × horizon shows directional skill after the v2 checks (0 of 60). Pooled one-bar coverage is 80% (95% interval 75–85%). Ranges run wide in stressed regimes (5-bar: 87%, judged too wide) and slightly narrow in calm ones (77–79%).

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
- They measure association around a date, not cause. Several drivers often arrive on the same day.
- The equal-weight S&P 500 reduces, but does not remove, contamination: semiconductors are still in it, and no sector-neutral or factor model is used.
- The placebo rank uses the asset's own history (up to 500 sessions), so its resolution is about 0.2%, and newly listed stocks (CRWV, CRCL) have fewer placebo windows.
- With roughly 100 day-0 tests across both cases, a few passes are expected by chance; each window reports the expected count beside the observed one.

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
3. Add sector-neutral benchmarks for event studies (equal-weight sector baskets, or a factor model); the equal-weight S&P 500 check is a first step.
4. Fill in the live forecast record weekly; report calibration once each horizon has 30+ effectively independent realized forecasts.
5. Have an LLM assist with tagging new claims against open thesis triggers, with every suggestion requiring confirmation.
6. Move the ledgers from committed JSON to an append-only table once there is a persistence backend. The hash chain carries over unchanged.

## 11. Research audit, 8 Nov 2026

A second pass over the merged implementation, for statistical overconfidence and source accuracy.

**Statistics**
- Direction gate rewritten (v1 → v2, see §5). Under v1 one call passed by being a constant rule; under v2 nothing passes.
- Interval coverage now reports nominal against empirical, with Wilson intervals on effective n, per regime and pooled with a design effect.
- Event-study t-statistics include estimation error; a placebo rank guards against fat tails; significance needs both. Two previously "significant" moves (BTC on 29 Oct, CRWV on 4 Nov) no longer pass.
- Equal-weight benchmark added. It shows the 5 Nov stock-level result is benchmark-sensitive (0 of 19 against own benchmarks, 7 of 19 against RSP; see §7).

**Evidence re-read** (every readable source, 08:20–08:33 UTC)
- Corrected and marked on the claim, with the reason: A-C18 (see the split below), B-C14 (demand window), B-C15 (several threads, not one chain), B-C17 ("may involve"), B-C21 (campaign date), B-C23 (whose words), B-C24 (transfers, not totals), A-C04 (no month given), A-C08 ("grid officials", second-hand), A-C16 (AP figures not described as closes), A-C24 (borrowing, not "debt-financed").
- Split: the Qualcomm claim joined a reported miss to the price fall with "after". The fall is now an observed fact (A-C29), the miss a reported claim (A-C18), and the link the hypothesis X-A2.
- Added: the Texas governor's signed letter to TCEQ (primary source), which also tells every other state agency to hold data-center approvals and lists no exception for applications already filed (A-C28); the president's same-day doubt about the North Korea attribution (B-C25); Binance's SAFU pledge, which differs from the "corporate reserves" wording elsewhere (B-C26).
- Confirmed unchanged: all headline amounts (US$6.34bn affected, US$2.85bn frozen or intercepted, 98% replenished), the stablecoin freezes, publication times, and both state orders' terms.
- Still unread: the FBI alert (403), Reuters, CNN. The North Korea attribution stays short of confirmed.

**Interface**
- A six-step brief per case (`/events/<case>/brief`) runs question → industry impact → evidence → competing explanations → implications → what would change the conclusion.
- Phone layouts: the radar becomes a list; wide tables pin the instrument column. Case pages carry the case name in their titles; tables carry header scope and labels; event pages have their own loading state.

