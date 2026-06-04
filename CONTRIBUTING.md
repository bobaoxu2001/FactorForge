# Contributing to FactorForge

Thanks for taking the time to improve FactorForge. This project is maintained as an open-source AI-assisted quantitative research workbench, with a strong preference for deterministic metrics, explicit data provenance, and honest fallback behavior.

## Scope

Good contributions include:

- Backtest, indicator, radar, concentration, portfolio, or paper-observation improvements with tests.
- Data provider improvements that preserve fallback disclosure and structured failure reasons.
- UI changes that make research assumptions clearer without hiding limitations.
- Auth/session/security hardening.
- Documentation that keeps maintainer and contributor workflows accurate.

Out of scope unless discussed first:

- Claims about users, adoption, stars, downloads, external contributors, or production usage.
- Changes that present simulated observations as live orders.
- LLM output that can overwrite computed metrics.
- Secrets, API keys, personal data, or provider tokens committed to the repo.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Optional provider keys can be added to `.env.local`. Keep `.env.local` private.

## Verification

Run the same checks expected by CI before opening a PR:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run fixture:refresh` only when intentionally updating the committed market-data fixture. Review fixture diffs carefully because they affect snapshot-style research invariants.

## Testing expectations

- Quant engine changes should include focused unit tests for edge cases and invariants.
- Provider changes should test success, failure, fallback, and missing-key paths without network calls.
- Auth/session changes should test validation, rate limiting, cookie/session assumptions, and failure modes.
- LLM changes should test both template fallback and mocked provider responses.
- UI changes should keep fallback/demo labels visible where relevant.

## Pull requests

Please include:

- What changed and why.
- Commands run locally.
- Any data fixture, env, or provider assumptions.
- Screenshots only when they clarify UI changes.
- Notes about remaining risks or follow-up work.

Maintainers review for metric integrity first, then tests, fallback disclosure, security impact, and documentation drift.

## Documentation style

Keep docs factual. Do not invent adoption, external users, download counts, stars, production deployments, or contributor activity. If a capability is optional or simulated, say so directly.
