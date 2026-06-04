# Expand Provider Fallback Tests

## Problem

Provider fallback behavior is safety-critical because the public demo must not disguise fallback/demo data as real market data.

## Scope

Add mocked Yahoo, Polygon, Alpha Vantage, timeout, malformed-response, and all-provider-failure cases.

## Acceptance criteria

- Tests cover provider order and failure messages.
- Deterministic fallback rows are labeled as fallback/demo.
- Optional missing keys do not fail build or tests.
- Logs do not include secret values.

## Suggested labels

`testing`, `data-providers`, `security`

## Why Codex could help

Codex can generate mocked provider cases, identify missing assertions, and cross-check README/UI wording against provider behavior.
