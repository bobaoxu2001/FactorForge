# Security Policy

## Supported versions

The actively maintained line is the current `main` branch. There is no long-term-support release series yet.

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities. If private reporting is unavailable on the repository, contact the maintainer through the GitHub profile associated with this repo and include only the minimum detail needed to start the conversation. Do not include secrets, provider keys, session cookies, or personal data in public channels.

Useful report details:

- Affected route, module, or workflow.
- Reproduction steps using local configuration where possible.
- Expected behavior and observed behavior.
- Whether the issue touches auth, session cookies, rate limiting, persistence, provider credentials, LLM payloads, CSP, or logs.

## Security-sensitive areas

Changes in these areas need extra review:

- `src/lib/auth` and `src/app/sign-*`
- iron-session cookie configuration and `SESSION_PASSWORD`
- bcrypt password validation and storage
- rate-limit stores and fail-open behavior
- SQLite persistence and user/watchlist isolation
- provider keys and provider fallback logging
- DeepSeek/LLM payload construction and prompt handling
- security headers in `next.config.js`
- `/api/csp-report` logging

## Secrets

Never commit `.env.local`, provider API keys, session secrets, cookies, database files, logs containing secrets, or screenshots that expose credentials. The repo ignores `.env*` except `.env.example`.

## Dependency updates

Dependency updates should include the normal verification commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
