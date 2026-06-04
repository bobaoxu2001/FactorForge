# Extend Route-Level Search Command Palette

## Problem

The first command palette is intentionally lightweight. It should eventually index more route-specific entities and glossary terms.

## Scope

Expand search coverage for all strategy IDs, symbols, factor names, report sections, glossary aliases, and protected-route explanations.

## Acceptance criteria

- Keyboard shortcut opens and closes reliably.
- Results link to the relevant route or filtered route.
- No shortcut label is shown unless the shortcut works.
- Empty state says "No results found" instead of rendering a blank panel.

## Suggested labels

`frontend`, `accessibility`, `search`

## Why Codex could help

Codex can add indexed entries, keyboard tests, and docs while checking that labels match implemented behavior.
