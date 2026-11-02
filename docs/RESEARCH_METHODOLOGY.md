# Research Methodology

How FactorForge turns public data into research evidence, and what it refuses to do. Every rule below is implemented in `src/lib/intel` and covered by tests (file names in brackets).

## 1. Provenance taxonomy

| Origin | Examples | May be "verified"? |
|---|---|---|
| `public-secondary` | FRED observation, SEC XBRL fact, verbatim 10-K sentence, calculation on those | Yes, against the retrieved source |
| `user-primary` | Interview notes you recorded | Only with a document reference you supply |
| `ai-generated` | Copilot answers, interview guides, drafts | Never |
| `hypothesis` | Configured or analyst assumptions | Never; hypotheses are tested, not verified |

Statuses: verified · partially-verified (calculations that depend on a method choice) · unverified · contradicted · stale. [`evidence.ts`, `project.test.ts`]

## 2. Financial statements (SEC XBRL)

- **Concept selection.** For each metric and company, one us-gaap concept is chosen by recent coverage (distinct period ends in the last three years), then recency, then a preference order. The concept name is displayed. Periods never mix concepts. [`build-research-snapshot.mjs`]
- **First-reported values.** Each period keeps the value as first filed (point-in-time) and the latest filed value. A difference is flagged as a restatement. [`financials.ts`]
- **Quarterisation.** Direct 3-month facts are preferred. Otherwise Q2/Q3 = YTD(t) − YTD(t−1) with the same fiscal-year start, and Q4 = FY − 9M. Each derived value is labelled, and its availability date is the latest filing it depends on. [`financials.test.ts`]
- **TTM** requires four consecutive quarters spanning about a year; gaps return null.
- **Debt** = combined tag, else LongTermDebt, else noncurrent + current; plus a convertible only if larger than that base (so it cannot already be included); plus finance leases and short-term borrowings. Operating leases are excluded. Components are displayed.
- **ROIC (approx.)** = TTM EBIT × (1 − tax) ÷ (debt + equity − cash). Tax is the TTM effective rate if between 0% and 40%, else 21%.

## 3. Valuation

- Market cap = raw traded price (Yahoo split-adjusted close × later split factors) × cover-page shares known on that date, restated for later splits. Dual-class filers without a cover count fall back to weighted diluted shares, and the page says so. [`valuation.test.ts`]
- Multiples use positive denominators only. Negative-earnings P/E is "n/m", never cheap.
- **Historical multiples are point-in-time.** At each month-end, only fundamentals filed by that date are used. [`project.test.ts`: "uses point-in-time fundamentals"]
- **Scenarios** take the 25th/50th/75th percentiles of the company's own 5-year TTM growth, margin and EV/EBITDA, ordered around the current value. They are stress anchors, not forecasts. Probabilities are blank until the analyst enters them with a written justification; expected return appears only for a complete distribution. [`workspace.ts`, `valuation.ts`]
- **DCF** (FCFF) shows every input, warns when terminal value exceeds 75% of EV, and refuses WACC ≤ g.

## 4. KPIs

- YoY is matched by calendar month (weekly: the observation 364 ± 3 days earlier), never by array offset. Missing months give null. [`series.test.ts`]
- **Anomaly**: |z| ≥ 2 for the YoY change against its trailing 36 observations, excluding the current one.
- **Freshness**: the latest observation is compared with the latest period expected to be published, given cadence and publication lag: fresh, lagging (one period behind) or stale.
- **Comparability**: NSA series are read YoY only. Derived ratios (Cass cost per shipment) say that mix changes move them.
- **Fuel-adjusted residual**: OLS of a price KPI's YoY on diesel YoY, fitted only on data before the last 12 months. The residual over the holdout is reported, with an extrapolation warning when diesel moves outside the training range.
- **Lead-lag**: Pearson correlation of YoY series at lags 0–12, the best lag chosen after scanning (stated), plus a split-half sign/stability check. A **holdout test** then picks the lag using only pairs fully observed by the end of the first two-thirds of the leader's history and measures the correlation at that lag on later months; it "holds" only if the sign matches and |r| ≥ 0.3 (≥ 12 holdout pairs). It is still described as co-movement, never as predictive power. [`series.test.ts`]

## 5. Hypotheses & monitoring

- Tests are threshold rules on computed values. The outcome is whatever the data says. Evidence is attached only for the value that decided the test, so a contrary reading is never listed as support. [`thesis.ts`, `project.test.ts`]
- A hypothesis is supported, contradicted or mixed across its tests, or *insufficient data*.
- Invalidation triggers (e.g., "Cass shipments YoY < 0 for three consecutive months") are evaluated on every build and shown as not triggered, triggered or insufficient data.

## 6. Attribution & backtests

- Market/sector attribution: daily OLS of total returns on SPY and (IYT − SPY), with t-statistics. Alpha with |t| < 2 is described as indistinguishable from zero.
- **Outcome review** estimates betas on the 12 months *before* the thesis date and applies them after it (no look-ahead).
- Company quant lens: the existing strategy engine runs on the snapshot (next-open execution, slippage, fees). Best-of-N Sharpe is compared with E[max Sharpe of N null strategies] ≈ (1−γ)Φ⁻¹(1−1/N) + γΦ⁻¹(1−1/(Ne)), scaled by 1/√years. [`attribution.test.ts`]
- **Selection bias on `/strategies` and `/radar`**: each showcased run is the best of N symbols (≈30). Its Sharpe is tested with the Deflated Sharpe Ratio (Bailey & López de Prado, 2014): SR₀ = √Var(per-symbol Sharpe) · E[max Z_N], and P(true SR > SR₀) corrects for sample length, skew and kurtosis. A run "survives" at ≥ 95%. The radar's admission rule (Sharpe > 1) is not changed; the check is shown next to it. [`selectionBias.test.ts`]
- **Stops** are judged on the completed close and filled at the next open, so overnight gaps through a stop are paid; the entry bar's close is checked too. [`backtest.test.ts`]
- Backtested, simulated and actual performance are separated. Actual trading is not supported.

## 7. Primary research & compliance

- Notes are stored only in the browser. Saving screens for emails, phone numbers, ID-like numbers, MNPI language ("not yet public", "inside information", "internal forecast", "under NDA") and confidentiality markers. Contact details are redacted on save.
- Interview guides are templates (work product), never evidence.
- AI analysis of notes needs explicit opt-in per request. Text with possible MNPI is never sent to a model.
- Compliance notes in each project describe consent, attribution, cooling-off and current-employee restrictions.

## 8. Copilot grounding

1. Retrieve up to 14 evidence items (BM25-style ranking plus hypothesis/company boosts).
2. The model sees only those items and must return facts, calculations, interpretation, hypotheses, missing information and follow-ups.
3. The validator moves any fact or calculation without a citation, or citing an ID not retrieved, to "unsupported" and shows it struck through.
4. Without a working key, deterministic handlers answer from the same evidence under the same structure.

## 9. Licensing

FRED licence labels are captured per series. "Copyrighted: pre-approval required" series are excluded from the snapshot. Cass data ("copyrighted: citation required") are cited wherever shown. SEC filings are public records; only short excerpts are stored, with links to the full filing.
