# Interview demo: FactorForge event research

A short script for presenting the event-research workflow. Every number below comes from the committed snapshot (prices built 8 Nov 2026) and can be checked on the pages named. Where the repository cannot answer a question, the text says so and leaves it for the author to fill in.

**Where to run it.** Use the Vercel preview of the latest commit on PR #20 until that PR is merged. Production (`factor-forge-ashy.vercel.app`) still serves the earlier version, which has no `/brief` page. Paths below are relative to whichever host you use.

---

## A. Thirty-second introduction

> FactorForge is an evidence-driven equity research workbench, not a stock predictor. For a market event it keeps three things apart: what the sources establish, what prices did relative to a benchmark, and what an analyst thinks it means. Each claim carries its source and a verification state, each thesis is written once with the triggers that would change it, and forecasts are logged before the outcome and scored afterwards. The forecasts are a check on method, not evidence of an edge: no directional rule passes the skill test, so the engine abstains on direction and publishes only ranges.

---

## B. Three-minute demo

The main thread is brief, then evidence and market, then theses. Forecasts come last, briefly, as a check on method.

| Time | Open | Say | Point at |
|---|---|---|---|
| 0:00–0:20 | `/events/ai-datacenter-shock/brief`, step 1 | "The question: did the 5 Nov selloff reflect a change in near-term AI-infrastructure demand, or a repricing of policy and valuation risk?" | The question, and the trigger event's verification chip (confirmed: the size of the move is in closing data). |
| 0:20–0:55 | Brief, step 2, then **Market reaction** | "4 Nov, the first session after the election, is where the sector-specific move is: power and grid-equipment names fell roughly 9–17% beyond what their benchmark predicts while Microsoft and Amazon rose. On 5 Nov the market itself fell, and the answer depends on the benchmark." | 4 Nov: 9 of 18 day-0 tests beyond noise against each stock's own benchmark, about 1 expected by chance. 5 Nov: 0 of 19 against QQQ or SPY, 7 of 19 against the equal-weight S&P 500 (RSP). On the market page, the t-statistic and placebo rank printed under each day-0 figure. |
| 0:55–1:35 | **Evidence & timeline** | "Every statement is a claim with a source and a state. Two state pauses are in force: New York's order and the Texas halt, both from primary documents. A widely repeated Texas grid-connection freeze rests on one aggregator, so it stays a rumour. Reuters and CNN could not be read, so they support nothing." | Claim cards A-C01, A-C05 (confirmed), A-C07 (rumour). A-C18 with its correction note: the Qualcomm claim used to join a reported miss to the price fall with "after"; it is now split into the report (A-C18, rumour) and the observed fall (A-C29). |
| 1:35–2:05 | Brief, step 4 | "These are competing explanations, all hypotheses. One day of prices cannot separate drivers that arrive together, so none is marked as the cause." | Earnings and guidance: QCOM's market check is listed as *inconclusive*: no statistically distinguishable abnormal return against QQQ or RSP, which neither confirms nor rules out a Qualcomm-specific cause. Rates: yields fell, which is recorded against it. |
| 2:05–2:40 | `/theses` | "A thesis is hashed when published and never edited. T-AI-1 is a worked example: it was written on 8 Nov using only sources dated by the 5 Nov close, so it is labelled backfill and is not a track record. It also has two problems: its statement says the day 'carried an earnings miss', and a trigger says 'confirmed as a driver' while firing on a merely reported claim. The original stays; a dated current assessment sits beside it." | The current-assessment box on T-AI-1, the two rule findings for TR-A2, and T-AI-2 (live), with its invalidation trigger "restrictions extend to existing load". |
| 2:40–3:00 | `/forecasts` | "Live forecasts are logged before their outcome; backfilled ones are reconstructions shown apart. No live forecast has realized yet. Out of sample, 0 of 60 instrument–horizon direction tests beat the better constant rule after correction, so every new forecast abstains on direction." | The live/backfill split, the coverage panel (pooled one-bar coverage 80%, 95% interval 75–85%), and the skill table. |

If there are only ninety seconds, show brief steps 1, 2 and 4, then the T-AI-1 assessment on `/theses`.

---

## C. The case in full: AI data-center restrictions and the 5 Nov selloff

**Research question.** Did the 5 Nov 2026 selloff (Nasdaq Composite −5.5%, S&P 500 −4.4%) reflect a change in near-term AI-infrastructure demand, or a repricing of policy and valuation risk?

**Business mechanism, as a hypothesis.** Permit pauses on new data centers could slow new-site construction. That would reach suppliers of new capacity first: grid and power equipment (VRT, ETN, GEV), and generators priced as AI-demand proxies (CEG, VST). It would reach chip and hyperscaler revenue later, if at all, because their near-term revenue rests on capex already guided. A second, opposite channel (thesis T-AI-2): restrictions on new sites could raise the value of generation and capacity that are already connected.

**What the sources establish.**
- Two restrictions are in force, both temporary permit pauses: New York's executive order (up to a year) and Texas's halt pending an ERCOT audit. Both come from primary government documents.
- The election raised the odds of more restrictions: candidates backing data-center pauses or tighter rules won governor races in Texas, Ohio, Georgia and Wisconsin. That is a promise, not a law. The Texas governor-elect takes office on 19 Jan 2027.
- The size of the 5 Nov move is in closing data. Yields fell that day.

**What is not established.**
- A Texas grid-connection freeze from August: one aggregator only.
- The Qualcomm miss: one aggregator only; Qualcomm's own results were not read.
- Positioning and flow estimates: reported analyst views and model estimates.
- Which driver explains how much of 5 Nov. Closing data cannot separate drivers that arrived together.
- Reuters and CNN coverage, and hyperscalers' own earnings releases: not read.

**Why the benchmark changes the result.** An abnormal return is the stock's move minus what its benchmark predicts, where the prediction is α plus β times the benchmark's move, fitted on 120 earlier sessions. On 5 Nov QQQ fell 6.5%, SPY 4.4% and the equal-weight RSP 2.9%. Take SMH, the semiconductor ETF, which fell about 11%. Its estimated β against SPY is 2.8, so SPY's fall "predicts" roughly −12%, and the actual move is +1.3% better than predicted: normal. Against RSP its β is 1.35, which predicts about −4%, so the same move is 7.4% worse than predicted and passes both checks. Across the 19 instruments tested, 0 pass against their own benchmark (QQQ or SPY) and 7 pass against RSP, mostly semiconductors, networking and data-center equipment. Neither benchmark is sector-neutral, and RSP still contains semiconductors. The honest reading is that the 5 Nov stock-level result is benchmark-sensitive; neither comparison says why the stocks moved. The 4 Nov result is more robust: 9 of 18 pass against own benchmarks and 7 of 18 against RSP.

**What would change the view.** These are T-AI-1's own triggers and the base-case invalidations:
- weaken if hyperscalers cut 2027 capex guidance (two or more breaks the base case);
- weaken if a top data-center state enacts a moratorium;
- review if a federal moratorium advances, or if SMH's 20-session abnormal return falls below −15%;
- for T-AI-2, invalidate if restrictions extend to existing load, since that removes the scarcity benefit.

**Next step: a channel-check plan.** This is a plan only. No interviews have been done, and the case uses no private data. Each call would be screened for material nonpublic information and limited to public or non-confidential knowledge.

| Who | What to ask | Which view it tests |
|---|---|---|
| Data-center developers and site-selection consultants | Are projects in Texas or New York being deferred, cancelled or moved to other states? Is it permits, power, or financing that is binding? | T-AI-1 mechanism; base case |
| Utility and ERCOT-region large-load interconnection planners (public filings first) | Has the large-load queue changed since September? Are existing interconnection agreements affected? | T-AI-2 invalidation (existing load) |
| Electrical-equipment distributors and switchgear or UPS channel partners | Are orders being pushed out or cancelled, and are lead times shortening? | Whether the 4 Nov move in VRT, ETN and GEV reflects orders or sentiment |
| Colocation leasing brokers | Has pricing for energized, already-connected capacity moved since the election? | T-AI-2 scarcity channel |
| State permitting attorneys | What scope did TCEQ's compliance update set, and could a governor act without the legislature? | Open questions on the Texas halt |

The freight module's `/primary` page shows how such a plan is held: planned calls never count as completed interviews, and notes are screened for personal data and MNPI.

---

## D. Likely questions

**What does AI actually do in this project?**
In the event layer shown in the demo, nothing at run time. Verification states, the event study, interval scoring and the ledgers are deterministic code, and the memo is assembled from case data. Elsewhere in the app a language model (DeepSeek, when an API key is configured) writes prose on top of deterministic results: strategy memos, the paper-trading daily review, and the freight research copilot. Numbers come from code, and the model is told to use only the payload. The copilot moves any statement that lacks a retrieved evidence ID into an "unsupported" list. Without a key, every one of these falls back to a template. The codebase itself was written with an AI coding assistant; see the next answer.

**What did you personally design and validate?**
*Author to complete; the repository cannot answer this.* Git history shows 73 of 98 commits co-authored with Claude, an AI coding assistant, so say that plainly and then describe the decisions you made and checked yourself. Examples, if they apply: choosing the research question, reading the sources, deciding what counts as verified, choosing the benchmarks, or reviewing the statistical tests. Do not claim work you did not do.

**How do you distinguish facts from hypotheses?**
Every claim has an epistemic class (observed fact, reported claim, analyst interpretation, model estimate, causal hypothesis), and a verification state derived from its sources: confirmed, corroborated, reported, rumour or disputed. Explanations of a price move are always hypotheses. A trigger can make a thesis act on verified evidence, but a price move alone can only send a thesis to review. When a claim was worded too strongly, it is corrected with a dated note rather than silently rewritten. Qualcomm is the example: the report, the observed fall and the causal link are three separate items.

**Why do different benchmarks produce different conclusions?**
Because "abnormal" means "beyond what the benchmark predicts", and the prediction is β times the benchmark's move. Both the β and the benchmark's move differ between benchmarks. On 5 Nov SPY fell 4.4% and RSP 2.9%; with SMH's β of 2.8 against SPY and 1.35 against RSP, the same 11% fall is normal against one and unusual against the other. Neither is the right benchmark for a sector shock, so the page reports both counts and calls the result benchmark-sensitive. It is not read as proof that the selloff was, or was not, sector-specific.

**What would you improve next?**
- A sector-neutral benchmark, such as an industry factor model.
- Reading Qualcomm's own results and the hyperscalers' capex statements.
- Replacing the keyword check on trigger wording with a structured field.
- Letting the live forecasts accumulate before claiming anything about calibration.

---

## Known limits to state if asked

- **Effective sample and design effect.** Both are approximations, so the coverage verdicts are evidence of miscalibration or of consistency under the test, not proof. Five-bar ranges in stressed markets covered 87% against a nominal 80% (too wide).
- **Placebo rank.** It uses the previous 500 sessions, so its resolution is about 0.2%.
- **Relative range.** It assumes log returns are symmetric. Correcting the scoring to relative wealth return changed none of the 16 relative ranges realized so far.
- **T-AI-1's strengthening.** It rests on reported analyst views and model estimates (A-C20, A-C21). "Strengthened" means the evidence its author named arrived, not that positioning was proven to be the cause.
