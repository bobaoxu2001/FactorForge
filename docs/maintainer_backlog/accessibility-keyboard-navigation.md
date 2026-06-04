# Improve Accessibility and Keyboard Navigation

## Problem

The app has dense cards, tables, side navigation, and a command palette. High-impact keyboard and screen-reader paths should be checked regularly.

## Scope

Audit focus states, button labels, dialog semantics, skip links, table labels, color contrast, and mobile navigation.

## Acceptance criteria

- Interactive controls have visible focus states and accessible names.
- Command palette uses dialog semantics and closes with Escape.
- Mobile navigation remains keyboard reachable.
- Changes are verified on desktop and mobile widths.

## Suggested labels

`accessibility`, `frontend`, `good-first-issue`

## Why Codex could help

Codex can scan JSX for unlabeled controls, suggest focused fixes, and generate component-level accessibility tests.
