# Interview demo: FactorForge event research

A short script for presenting the event-research workflow. Every number below comes from the committed data: the market snapshot built 8 Nov 2026, and Vistra's Q3 2026 release, read on 8 Nov. Each can be checked on the page named. Where the repository cannot answer a question, the text says so and leaves it for the author.

**Where to run it.** Use the Vercel preview of the latest commit on the review PR until it is merged. Production still serves an older version that has none of the pages below. Paths are relative to whichever host you use.

---

## A. Thirty-second introduction

> FactorForge is an evidence-driven equity research workbench, not a stock predictor. For a market event it asks a business question, keeps three things apart (what the sources establish, what prices did, and what an analyst infers), and shows how far each inference is from the evidence. The AI case asks whether the 5 November selloff reflected a change in near-term data-center demand or a repricing of policy risk. One company, Vistra, is worked through from its own filing to the channels through which Texas restrictions could reach its economics, with the assumptions, the unknowns and the next thing to check. Forecasts exist only as a method check; no directional rule has shown skill, so none is offered.

---

## B. Three-minute demo

The thread is question, then business mechanism, evidence, company implications and what would change the view. Forecasts are optional at the end.

| Time | Open | Say | Point at |
|---|---|---|---|
| 0:00–0:30 | `/events/ai-datacenter-shock/brief`, top card | "The question: did the 5 Nov selloff reflect a change in near-term AI-infrastructure demand, or a repricing of policy risk? The current view is that the evidence so far shows policy risk repriced in share prices, not a measured change in demand, and it can't yet split policy from positioning on 5 Nov. The facts underneath are confirmed; the interpretation is labelled tentative, and the card says why." | The two separate labels: underlying facts *confirmed*, interpretation *tentative*. The strongest evidence and the key uncertainty sit side by side; the uncertainty includes the benchmark sensitivity of 5 Nov. |
| 0:30–1:10 | Brief → **Business impact**, Vistra panel | "To get from a policy to a company, I picked the most Texas-exposed name and read its own filing. Texas is 38% of Vistra's operating EBITDA for the first nine months. That's derived from disclosed segment figures, and it's exposure to Texas generation, not to the policy. About 98% of 2027 generation is hedged, so any demand effect reaches earnings mainly from 2028." | *Disclosed figures* table: period, unit, denominator, disclosed vs derived, source and dates. Texas MW and data-center revenue read *Not disclosed*, not zero. |
| 1:10–1:45 | Business impact, channels and research tests | "Restrictions can reach Vistra six ways: lost demand, delayed revenue, relocation, pricing, cost, or only a risk premium. They can happen together. So far only the risk-premium channel has support. The price fell 16% beyond its benchmark on 4 Nov, after the election, while results and guidance two days later were up. A non-Texas generator, CEG, also fell, so the repricing may not be Texas-specific. That's written down as a test, with what would weaken it." | The *Current read* line on each channel. Hypothesis cards H-VST-3 (price check: *directionally aligned in this window; mechanism not established*) and H-VST-4 (CEG challenges it; the enacted Texas halt in September produced no distinguishable move). |
| 1:45–2:15 | Business impact, **Impact map** | "On the map, a citation only counts if it bears directly on the link. The permit pauses are confirmed, so the first link has direct evidence. That they push data-center capex out is still an assumption, so no path to Vistra is fully evidence-backed, and the map gives no evidence-backed direction. The signs are a scenario aid: the main mechanism would lower Vistra's business, and the competing scarcity mechanism would raise it." | Main mechanism selected by default; the competing ones a click away. Each link says *direct evidence* or *assumption*, with what the evidence establishes and what would challenge it. |
| 2:15–2:40 | **Evidence**, then back to the brief | "Every claim has a source and a state. The Texas halt comes from the governor's signed letter. The Qualcomm 'miss' is one aggregator, so it's a rumour. Vistra's figures are the company's own statements: confirmed as statements, not independently checked." | Claims A-C05, A-C18 (correction note) and A-C30. |
| 2:40–3:00 | Brief, *What would change the view* and *Next research action* | "This view breaks if hyperscalers cut 2027 capex, if a top state enacts a moratorium, or if Texas large-load approvals stop. The next check is Vistra's results call and the PUC filings. If interviews come later, the plan lists who could know what, and every row says planned." | Then optionally `/forecasts`: live and backfilled kept apart, 0 of 60 direction tests pass, so forecasts abstain on direction. |

If there are only ninety seconds, use the brief's top card, the Vistra figures table and *What would change the view*.

---

## C. The case in full

**Research question.** Did the 5 Nov 2026 selloff (Nasdaq Composite −5.5%, S&P 500 −4.4%) reflect a change in near-term AI-infrastructure demand, or a repricing of policy and valuation risk?

**Current assessment** (analyst, dated 8 Nov 2026, 14:00 UTC; interpretation *tentative*). The evidence so far shows policy risk repriced in share prices, not a measured change in near-term demand. It cannot yet say how much of the 5 Nov decline was policy rather than positioning or valuation.

**Business mechanism (hypothesis).** Permit pauses → slower new sites → later data-center capex → slower demand growth for generation → lower value of Vistra's unhedged Texas output. Competing mechanisms: connected capacity becomes scarcer and more valuable, which would push the other way; projects move to other states; or only the risk premium changes.

**What the sources establish.**
- Two restrictions are in force, both temporary permit pauses: New York's executive order (up to a year) and Texas's halt pending an ERCOT audit. Texas's letter also tells other agencies to hold data-center approvals. All are primary government documents.
- After the election, candidates backing pauses won governor races in Texas, Ohio, Georgia and Wisconsin. Those are promises, not laws.
- Vistra's Q3 release (6 Nov):
  - Texas segment Adjusted EBITDA was $1,227m in Q3, against $784m a year earlier.
  - Texas was 38% of nine-month Ongoing Operations Adjusted EBITDA (derived: 2,124 ÷ 5,639).
  - 2026 guidance was narrowed around a higher midpoint, and 2027 guidance was initiated at $7.7–8.5bn.
  - About 98% of 2027 generation and 78% of 2028 is hedged.
  - It signed a 20-year, 207 MW agreement at its Odessa plant in Texas.
  - The release does not mention Texas policy.

**What is not established.**
- Whether restrictions have delayed or cancelled any project; no company has said so.
- Whether Vistra's Texas deals need approvals that the letter holds back.
- What the Odessa buyer will use the power for, and its start date and price.
- Generation capacity in Texas, and revenue from data-center customers: not disclosed in the documents read.
- Market consensus for 2027. The expectation gap is therefore *not established*: guidance is not consensus, and a price fall does not reveal what was expected.
- Which explanation drove 5 Nov. Policy, a reported Qualcomm miss (a rumour), positioning and financing all arrived together.

**Why benchmarks change the result.** An abnormal return is the move beyond α + β × the benchmark's move.
- On 5 Nov QQQ fell 6.5%, SPY 4.4% and the equal-weight RSP 2.9%.
- SMH fell about 11%. Its estimated β is 2.8 against SPY, which "predicts" about −12%, so the move looks normal. Its β is 1.35 against RSP, which predicts about −4%, so the same move is 7.4% worse than predicted.
- Across the 19 instruments tested: 0 beyond noise against their own benchmark, 7 against RSP.
- 4 Nov holds up under both benchmarks (9 of 18 against own benchmarks, 7 of 18 against RSP).
- Neither benchmark is sector-neutral, and neither comparison explains why prices moved.

**What would change the view.**
- Two or more hyperscalers cut 2027 capex guidance.
- A top data-center state enacts a moratorium.
- Evidence that Texas large-load approvals have stopped.
- Vistra or an equipment supplier reports delayed or cancelled projects.

**Next steps.**
- Read Vistra's Q3 results call, then check PUC and ERCOT filings for large-load approvals since 21 Sep.
- Channel checks, planned only. None has been done; all would be compliance-screened and public or non-confidential only:
  - a large-load interconnection planner;
  - a PPA broker;
  - a Texas data-center developer;
  - a permitting attorney.
  Each question is open, and each is tied to the hypothesis it would test.

---

## D. Likely questions

**What does AI actually do in this project?**
In the event research shown here, nothing at run time.
- Verification states, link evidence checks, event studies, scoring and the ledgers are deterministic code.
- The assessment, channels and research tests are an analyst's dated records in the case file.

Elsewhere in the app, a language model (DeepSeek, when an API key is configured) writes prose on top of deterministic results:
- strategy memos;
- the paper-trading daily review;
- the freight research copilot, which moves any statement without a retrieved evidence id into an "unsupported" list.

Without a key, each of these falls back to a template. The codebase itself was written with an AI coding assistant (next answer).

**What did you personally design and validate?**
*Author to complete; the repository cannot answer this.* Git history shows 78 of 103 commits co-authored with Claude, an AI coding assistant. Say that plainly, then describe the decisions you made and checked yourself: for example the research question, which sources to read, the choice of Vistra, or the rules for when evidence counts. Do not claim work you did not do.

**How do you distinguish facts from hypotheses?**
- **Statements.** Each claim has a statement type and a verification state derived from its sources.
- **Links.** A link from event to company counts evidence only if the evidence exists, was read and published by the cutoff, is verified well enough, and has been judged (with a date) to bear on that link. Otherwise the link is a stated assumption. A confirmed permit pause establishes the pause, not a company's revenue loss.
- **Hypotheses.** Each is a test: what we would expect if it were true, what supports it, what challenges it, and what would weaken it.
- **Corrections.** A wrong claim gets a dated correction; it is not silently rewritten.

**Why do different benchmarks produce different conclusions?**
"Abnormal" means beyond what the benchmark predicts, and the prediction is β times the benchmark's move. Both the β and the move change with the benchmark. On 5 Nov, SMH's 11% fall is normal against SPY (β 2.8) and unusual against RSP (β 1.35). So the result is reported as benchmark-sensitive, not as proof that the selloff was, or was not, sector-specific.

**What would you improve next?**
- Read Vistra's results call and the PUC and ERCOT filings, and update the channel reads.
- Add a sector-neutral benchmark.
- Work through a second company with different exposure, such as an equipment supplier, before generalising.
- Replace the keyword check on trigger wording with a structured field.
- Let live forecasts accumulate before saying anything about calibration.

---

## Known limits to state if asked

- **Relevance is a judgement.** "Bears on this link" is a dated analyst judgement, not something the code proves; it is labelled as such.
- **One company.** The company-level work covers Vistra only, from one release; its results call was not read. Other companies' exposure is an unverified classification.
- **Release timing.** The Vistra release time of day was not recorded, so it is dated to the end of 6 Nov. VST's +10.6% that day may already include it, and the market rebounded the same day.
- **Statistical approximations.** Effective sample size and design effect are approximations; the placebo rank resolves to about 0.2%.
- **No user testing.** The 30-second, two-minute and three-minute reading targets have not been tested with readers.
