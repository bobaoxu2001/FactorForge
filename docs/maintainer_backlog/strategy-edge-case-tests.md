# Add More Strategy Edge-Case Tests

## Problem

Backtest and strategy logic already has coverage, but strategy-specific edge cases are easy to regress when rules evolve.

## Scope

Add tests for entry signals near the end of a series, flat markets, stop/trailing-stop precedence, gap opens, no-trade paths, and uneven benchmark calendars.

## Acceptance criteria

- Each strategy family has at least one edge-case fixture.
- Next-open execution remains explicit in assertions.
- No-trade and insufficient-data states return clear messages.
- Existing quant calculations remain unchanged unless a bug is documented.

## Suggested labels

`testing`, `quant-engine`, `backtest`

## Why Codex could help

Codex can generate small deterministic fixtures, propose expected outcomes, and update tests without inventing performance claims.
