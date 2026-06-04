# Security Review Backlog

## Review focus

Track future review work for:

- `SESSION_PASSWORD` handling and production fail-fast behavior.
- iron-session cookie options.
- bcrypt password length and validation rules.
- Rate-limit store behavior, especially fail-open paths.
- SQLite persistence boundaries between users.
- Provider credentials and structured logs.
- LLM prompt/payload handling.
- CSP and CSP report logging.

## Future improvements

- Add a short security-review checklist to PRs that touch auth/session/persistence/provider/LLM code.
- Add regression tests for accidental secret logging where practical.
- Document local reproduction steps for auth throttling and session expiry.
