# Research memo — The IPP "power premium" unwind (2024-11 → 2026-07)

*Status: point-in-time research note, 2026-07-19. Research only — not investment advice, not a forecast. Sources at the bottom; every claim below should be re-verified against primary filings before it is relied on.*

## The anomaly that prompted this memo

An expectation-vs-reality screen (anchored 2025-01-01: log-linear trend fitted on 2023-24 only, ±1σ cone, actuals overlaid through 2026-07) put the entire independent-power-producer group at the bottom of its own expectation cone — **CEG P3, VST P0, TLN P2, NRG P4** — while the equipment leg (GEV, VRT) merely decelerated and behind-the-meter generation (Bloom, +868%) blew out the top at P100. A whole group breaking its trend together is a systematic repricing, not a stock story. This memo documents what repriced.

## Timeline of the unwind

1. **2024-11 — the crack.** FERC rejected the amended interconnection agreement for the Talen–Amazon co-location deal at the Susquehanna nuclear plant — the template transaction for "sell nuclear power directly to a data center at a premium, behind the meter." CEG fell ~12.6%, TLN ~8%, VST ~6.3% on the day; the whole nuclear-adjacent complex traded down 2–29%.
2. **2025 — political heat replaces scarcity premium.** PJM capacity prices had spiked ~833% between the 2024-25 and 2025-26 delivery years; rising residential bills turned data-center power into a ratepayer-politics issue. Regulators began scrutinizing co-location deals for cost-shifting onto residential customers, and several jurisdictions moved to make data centers fund their own grid upgrades.
3. **2026-03 — the premium is capped by agreement.** Seven major AI companies (Amazon, Google, Meta, Microsoft, OpenAI, Oracle, xAI) signed the White-House-facilitated *Ratepayer Protection Pledge*, committing to directly fund grid-infrastructure improvements — institutionalizing "the buildout must not show up in retail bills," which is precisely the mechanism through which IPPs would have harvested a scarcity premium.
4. **Throughout — the demand routes around the toll booth.** Hyperscalers increasingly self-supply behind the meter (gas turbines, fuel cells — Bloom's ~2.85 GW Oracle order is the marquee example) and Texas SB6-style rules push large loads into demand-response programs. Distributed generation competes directly with the IPP co-location pitch.
5. **Result.** VST's forward P/E compressed from ~37.6× (fall 2025 peak) to ~19.3×; the group now screens "cheap + high growth + negative momentum."

## The mechanism in one sentence

The market did not stop believing electricity is scarce — it stopped believing **listed IPPs will be allowed to charge monopoly rents on that scarcity**, and simultaneously priced in that hyperscalers would build around them. The same repricing that crushed the IPP premium is what inflated behind-the-meter suppliers (BE at P100): they are two sides of one trade.

## Implications for the bottleneck-migration framework

- The framework said "scarcity confers pricing power." The IPP case adds the missing clause: **only where regulation permits the price**. Transformers and turbines are sold in competitive industrial markets — their backlog pricing is politically invisible. Wholesale electricity is the most politically visible price in America. Same scarcity, opposite permission.
- "Cheap + high growth + negative momentum" was not the market being slow; it was the market pricing a regulatory cap the valuation screen could not see. The contrarian case now requires a view on *rulemaking*, not on electrons.
- What would change the read: a FERC framework order that cleanly legalizes co-location economics; state-level large-load tariffs that grandfather existing deals; or hyperscaler PPAs signed at visible premiums despite the pledge.

## Methodology note

The screen behind this memo: for each name, fit ln(price) OLS on 2023-01→2024-12, project 3 years with a ±1σ constant-volatility cone from 2025-01-01, overlay actual adjusted closes, report actual/expected fulfillment and the percentile of the actual within the cone. The naive model is deliberate — it is the "no-information baseline," so departures measure exactly what the prior trend could not see. Yahoo free-tier data, single-day snapshot.

## Sources

- [Utility Dive — FERC rejects Talen-Amazon ISA](https://www.utilitydive.com/news/ferc-interconnection-isa-talen-amazon-data-center-susquehanna-exelon/731841/)
- [CNBC — Talen, Constellation, Vistra tumble after FERC order](https://www.cnbc.com/2024/11/04/tech-partnerships-with-power-companies-for-ai-in-doubt-after-ferc-order.html)
- [Marketplace — data centers and electric bills](https://www.marketplace.org/story/2026/07/10/data-centers-lowered-electric-bills-in-some-places-for-now)
- [S&P Global — IPPs face competition from distributed power](https://www.spglobal.com/market-intelligence/en/news-insights/articles/2026/1/ipps-face-competition-from-distributed-power-in-race-to-energize-data-centers-96010033)
- [S&P Global — investors reevaluating utility stocks](https://www.spglobal.com/market-intelligence/en/news-insights/articles/2026/7/data-center-demand-has-investors-reevaluating-us-electric-utility-stocks-103396628)
- [Motley Fool — Vistra down 25%, forward P/E 19.3](https://www.fool.com/investing/2026/04/18/crowd-dumping-vistra-why-buy-stock-down/)
- [Utility Dive — GETs and demand response](https://www.utilitydive.com/news/gets-demand-response-data-center-electricity-prices/823487/)
