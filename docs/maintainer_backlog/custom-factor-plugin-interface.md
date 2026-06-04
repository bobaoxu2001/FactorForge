# Add Custom Factor Plugin Interface

## Problem

Factor definitions are currently internal code paths. Contributors who want to prototype a new factor must edit shared engine modules directly.

## Scope

Design a small typed interface for registering custom factors, including input data requirements, output shape, provenance label, and test fixture expectations.

## Acceptance criteria

- A documented `FactorPlugin` type or equivalent extension point exists.
- At least one built-in factor is expressed through the interface.
- Invalid or missing factor output fails loudly in tests.
- UI labels still disclose whether data is real or fallback/demo.

## Suggested labels

`enhancement`, `quant-engine`, `good-first-design`

## Why Codex could help

Codex can compare current factor code paths, draft the TypeScript interface, generate fixture-based tests, and update docs without changing factor math.
