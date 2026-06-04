# Release Checklist

FactorForge currently uses a manual release process. Complete this checklist before creating a tag or publishing release notes.

## Pre-release

- Confirm the target branch and commit.
- Review merged PRs since the previous release or changelog section.
- Update `CHANGELOG.md` with factual user-facing and maintainer-facing changes.
- Confirm `README.md`, `ROADMAP.md`, and maintainer docs still match the code.
- Check that no `.env.local`, provider keys, session secrets, cookies, database files, or private logs are staged.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If market-data fixtures changed, also document why `npm run fixture:refresh` was run and what changed in the fixture.

## Security review

- Auth/session changes reviewed.
- Rate-limit changes reviewed.
- Provider fallback logs reviewed for secret exposure.
- LLM payloads reviewed for computed-metric integrity.
- CSP/header changes reviewed.

## Release notes

- Mention only shipped features and fixes.
- Do not claim adoption, stars, downloads, external users, production deployments, or external contributors unless independently verified and relevant.
- Call out known limitations and manual migration steps.

## Post-release

- Confirm the GitHub release or tag points at the intended commit.
- Move completed roadmap/backlog items if needed.
- Open follow-up issues for deferred work.
