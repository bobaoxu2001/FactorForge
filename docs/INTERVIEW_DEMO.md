# Interview demo: FactorForge event research

A short script for presenting the event-research workflow. Every number below comes from the committed data: the market snapshot built 8 Nov 2026, and Vistra's Q3 2026 release (an SEC filing, read 8 Nov and re-read for the hedging and guidance details). Each can be checked on the page named.

## Where to run it

- **Production:** https://factor-forge-ashy.vercel.app. Checked 8 Nov 2026 at 20:02 UTC:
  - it served `main` at `3350e96` (PR #22);
  - that includes the corrected current assessment quoted below, and every page used in this script.
- **Final-polish preview:** branch `polish/homepage-entry` changes only the homepage and the case entry links:
  - a featured-case introduction on the homepage;
  - case links that open on the brief;
  - a dated catalyst calendar.

  Until that PR is merged, those changes appear only on its Vercel preview. Production keeps the earlier homepage.
- **Main route:** `/events/ai-datacenter-shock/brief` → **Business impact** → **Evidence** → back to the brief for *What would change the view*. On the preview, the homepage's "Read research brief" button opens the same brief. `/forecasts` is optional at the end.

---

## A. Thirty-second introduction

> FactorForge is an evidence-driven equity research workbench, not a stock predictor. For a market event it asks a business question, keeps three things apart — what the sources establish, what prices did, and what is inferred — and shows how far each inference is from the evidence. The AI case asks whether the 5 November selloff reflected a change in near-term data-center demand or a repricing of policy risk. One company, Vistra, is worked through from its own SEC filing to the ways Texas restrictions could reach its economics, with the assumptions, the unknowns and the next thing to check. Forecasts exist only as a method check; no directional rule has shown skill, so none is offered.

---

## B. Three-minute demo

The thread is research question, then business mechanism, evidence, company implications and what would change the assessment.

| Time | Open | Say | Point at |
|---|---|---|---|
| 0:00–0:30 | Brief, top card | "The question is whether the 5 Nov selloff reflected a change in near-term demand or a repricing of policy risk. The working view: the price pattern is consistent with a repricing of policy or valuation risk, but the cause of the selloff isn't established, and the sources reviewed don't verify a change in near-term demand. The facts underneath are confirmed; the interpretation is labelled tentative, and the card says why." | The two separate labels, *underlying facts: confirmed* and *interpretation: tentative*; the strongest evidence beside the key uncertainty. Each item is marked observed, disclosed or unresolved. |
| 0:30–1:10 | Business impact, Vistra panel | "To get from a policy to a company, the case uses Vistra, a company with disclosed Texas operations, and its own SEC filing. It's a worked example; Texas exposure wasn't compared across the companies here. Texas is 38% of Vistra's operating EBITDA for the first nine months, derived from disclosed segment figures. That's exposure to its Texas segment, not to the data-center policy. The filing says about 98% of expected 2027 generation volumes were hedged as of 30 Oct. That matters for near-term price exposure, but the filing doesn't give the hedges' scope or terms, so it doesn't tell us when a demand change would reach earnings." | *Disclosed figures*: period, unit, denominator, disclosed vs derived, source and dates, and the amber qualification under each guidance and hedge figure. Texas MW and data-center revenue read *Not disclosed*, not zero. |
| 1:10–1:45 | Business impact, channels and research tests | "Restrictions could reach Vistra six ways: lost demand, delayed revenue, relocation, pricing, cost, or only a risk premium. They can happen together. The risk-premium channel has the most observations: the share fell 16% beyond its benchmark on 4 Nov, and the 6 Nov release didn't lower guidance. But a price fall can also reflect lower expected cash flows or positioning, and the guidance rests on market curves from 2 Nov, before the election, so that channel isn't established. CEG, which isn't Texas-focused, also fell, which challenges a Texas-specific reading." | The *Current read* line under each channel and the dated revision note. Hypothesis cards H-VST-3 (price check: *directionally aligned in this window; mechanism not established*) and H-VST-4 (CEG challenges it; the Texas halt in September produced no distinguishable move). |
| 1:45–2:15 | Business impact, impact map | "On the map, a citation only counts if it bears directly on the link. The permit pauses are confirmed, so the first link has direct evidence. That they push data-center spending out is still an assumption, so no path to Vistra is fully evidence-backed. The signs are a scenario aid: the main mechanism would lower Vistra's business, and the competing scarcity mechanism would raise it." | The main mechanism opens by default; the competing ones are a click away. Each link says *direct evidence* or *assumption*, with what the evidence establishes and what would challenge it. |
| 2:15–2:40 | Evidence | "Every claim has a source and a state. The Texas halt is from the governor's signed letter. The Qualcomm 'miss' is one aggregator, so it's a rumour. Vistra's figures are the company's own statements: confirmed as statements, not independently checked. Where a note went beyond its source, it carries a dated correction." | Claims A-C05; A-C18 and A-C32, each with its correction note; A-C30. |
| 2:40–3:00 | Brief, *What would change the view* and *Next research action* | "The view would change if hyperscalers cut 2027 capex, a top state enacts a moratorium, or Texas large-load approvals stop. An approval hold would support the delay mechanism, but showing an effect on Vistra would still need evidence that its projects were affected. The next step is Vistra's results call and the PUC filings. The channel-check plan lists who could know what; every row is planned, none done." | Then optionally `/forecasts`: live and backfilled forecasts kept apart, 0 of 60 direction tests pass, so forecasts abstain on direction. |

If there are only ninety seconds, use the brief's top card, the Vistra figures table and *What would change the view*.

---

## C. The case in full

**Research question.** Did the 5 Nov 2026 selloff (Nasdaq Composite −5.5%, S&P 500 −4.4%) reflect a change in near-term AI-infrastructure demand, or a repricing of policy and valuation risk?

**Current assessment** (analyst; interpretation *tentative*). The wording below is the corrected version from 8 Nov 2026, 16:00 UTC; the 14:00 version is kept as history.

> Working view: the price pattern is consistent with a repricing of policy or valuation risk: power and grid-equipment shares fell sharply after the election, and the one company release reviewed did not lower guidance. We have not established the cause of the selloff, or verified a change in near-term demand, in the sources reviewed.

**Business mechanism (hypothesis).** Permit pauses → slower new sites → later data-center capex → slower demand growth for generation → lower value of Texas generation not covered by hedges or contracts. Competing mechanisms:
- connected capacity becomes scarcer and more valuable, which would push the other way;
- projects move to other states;
- only the risk premium changes.

**Observed** (primary documents and closing prices).
- Two restrictions are in force, both temporary permit pauses: New York's executive order (up to a year) and Texas's halt pending an ERCOT audit. Texas's letter also tells other agencies to hold data-center approvals.
- On 4 Nov, the first session after the election, power and grid-equipment shares fell 9–17% beyond their benchmarks, against either benchmark.

**Disclosed** (Vistra's 6 Nov release; the company's own statements).
- Texas segment Adjusted EBITDA was $1,227m in Q3, against $784m a year earlier.
- Texas was 38% of nine-month Ongoing Operations Adjusted EBITDA (derived: 2,124 ÷ 5,639).
- Guidance:
  - 2026 guidance narrowed around a higher midpoint.
  - 2027 guidance initiated at $7.7–8.5bn.
  - Both rest on market curves as of 2 Nov 2026, the day before the election.
- "As of Oct. 30, 2026, Vistra had hedged approximately 100% of its expected generation volumes for 2026, approximately 98% for 2027, and approximately 78% for 2028." The release does not state the scope of these percentages or what "hedged" covers.
- A 20-year, 207 MW agreement at its Odessa plant in Texas, described as signed.
- No mention of Texas policy.

**Interpretation and unresolved questions.**
- Whether the 4 Nov fall reflects policy risk, lower expected cash flows, positioning or other news is not established.
- How much of 5 Nov was policy is unresolved. Policy, a reported Qualcomm miss (a rumour), positioning and financing worries all arrived together.

**Not found or not checked in the sources reviewed.** The coverage was:
- the state orders and letter;
- AP (via Yahoo Finance) and The Next Web;
- two aggregators (Tech Times, Coinpaper);
- closing prices;
- Vistra's Q3 release.

Reuters and CNN could not be read. Within that coverage:
- **Not found:** no disclosure of delayed or cancelled projects, and no hyperscaler update to 2027 capex since the election. Hyperscaler, supplier and utility filings were not read.
- **Not disclosed in the documents reviewed:** Texas generating capacity; revenue from data-center customers; the Odessa agreement's start date, price and end use; the scope and terms of the hedges.
- **Not checked:** whether the PUC or ERCOT have paused large-load approvals; Vistra's results call; market consensus for 2027.
- **Expectation gap:** therefore *not established*. Guidance is not consensus, and a price fall does not show what was expected.

**Why benchmarks change the result.** An abnormal return is the move beyond α + β × the benchmark's move.
- On 5 Nov, QQQ fell 6.5%, SPY 4.4% and the equal-weight RSP 2.9%.
- SMH fell about 11%. Against SPY its estimated β is 2.8, which predicts about −12%, so the move looks normal. Against RSP its β is 1.35, which predicts about −4%, so the move is 7.4% worse than predicted.
- Across the 19 instruments tested: 0 beyond noise against their own benchmark, 7 against RSP.
- The 4 Nov result holds under both benchmarks.
- Neither benchmark is sector-neutral, and neither comparison explains the move.

**What would change the view.**
- Two or more hyperscalers cut 2027 capex guidance.
- A top data-center state enacts a moratorium.
- Evidence that Texas large-load approvals have stopped. That would support the delay mechanism; a company-level effect would still need evidence that the company's projects are affected.
- Vistra or an equipment supplier reports delayed or cancelled projects.

**Next steps.**
- Read Vistra's Q3 results call.
- Check PUC and ERCOT filings for large-load approvals since 21 Sep.
- Channel checks, planned only. None has been done, and each would be compliance-screened and limited to public or non-confidential information:
  - a large-load interconnection planner;
  - a PPA broker;
  - a Texas data-center developer;
  - a permitting attorney.

---

## D. Likely questions

**What does AI actually do in this project?**
- **Event research:** nothing at run time. Verification states, link-evidence checks, event studies, scoring and the ledgers are deterministic code. The assessment, channels and research tests are dated analyst records in the case file.
- **Elsewhere in the app:** a language model (DeepSeek, when an API key is configured) writes prose on top of deterministic results — strategy memos, the paper-trading daily review, and the freight research copilot, which moves any statement without a retrieved evidence id into an "unsupported" list. Without a key, each falls back to a template.
- **Building the codebase:** an AI coding assistant was used; its commits carry co-author lines. That metadata does not show who made which decisions, so personal contribution is left to the section below.

**How do you distinguish facts from hypotheses?**
- **Claims:** each has a statement type and a verification state derived from its sources.
- **Links:** a link from event to company counts evidence only if the evidence exists, was read and published by the cutoff, is verified well enough, and has been judged (with a date) to bear on that link. Otherwise the link is a stated assumption.
- **Hypotheses:** each is written as a test, with what we'd expect if it were true, what supports it, what challenges it, and what would weaken it.
- **Wording:** current summaries separate what was observed, what was disclosed, what is interpretation and what is unresolved. Absence statements are limited to the sources reviewed.
- **Corrections:** dated, beside the original, never silent.

**Why do different benchmarks produce different conclusions?** "Abnormal" means beyond what the benchmark predicts, and the prediction is β times the benchmark's move; both change with the benchmark. On 5 Nov, SMH's 11% fall is normal against SPY (β 2.8) and unusual against RSP (β 1.35). So the result is reported as benchmark-sensitive, not as proof that the selloff was, or was not, sector-specific.

**What would you improve next?**
- Read Vistra's results call and the PUC and ERCOT filings, and update the channel reads.
- Review the hedges' scope and contract terms before saying anything about timing.
- Add a sector-neutral benchmark.
- Work through a second company with a different exposure before generalising.
- Let the live forecasts accumulate.

---

## E. [AUTHOR TO COMPLETE] Personal contribution

The repository and the build conversation cannot establish what the author personally decided, read or checked. Complete this section yourself before the interview, and claim only what you did. Prompts:

- Which research question and which case you chose, and why.
- Which sources you read yourself, as opposed to reading summaries produced during the build.
- Whether you chose Vistra as the worked example, and on what basis.
- Which rules you designed or reviewed: when evidence counts, benchmark choice, the forecast skill test.
- What you checked independently, and how.
- How you used AI coding assistance, and what you reviewed or changed in its output.

---

## Known limits to state if asked

- **Relevance is a judgement.** "Bears on this link" is a dated analyst judgement, labelled as such; the code does not prove it.
- **One company, one document.** The company-level work covers Vistra only, from one release; its results call was not read. Other companies' exposure is an unverified classification.
- **Release timing.** The release's time of day was not recorded, so it is dated to the end of 6 Nov. VST's +10.6% that day may already include it, and the market rebounded the same day.
- **Statistical approximations.** Effective sample size and design effect are approximations, and the placebo rank resolves to about 0.2%.
- **No user testing.** The 30-second, two-minute and three-minute reading targets have not been tested with readers.
