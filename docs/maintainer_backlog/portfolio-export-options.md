# Add Portfolio Export Options

## Problem

Portfolio diagnostics are visible in the UI, but users cannot export the leg table, equity curve, or assumptions for offline review.

## Scope

Add CSV or JSON export for portfolio legs, curve points, benchmark comparison, and methodology notes.

## Acceptance criteria

- Export includes generation time, data provenance, benchmark, and assumptions.
- Export does not include secrets or account identifiers.
- Empty portfolio state has a clear non-crashing message.
- Tests cover output shape for a fixture portfolio.

## Suggested labels

`enhancement`, `portfolio`, `export`

## Why Codex could help

Codex can generate serialization helpers, tests, and UI copy while preserving existing portfolio calculations.
