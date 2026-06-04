# Add Release-Note Automation

## Problem

Releases are manual. Maintainers need a repeatable way to draft release notes from merged changes without overstating adoption or usage.

## Scope

Add a local script or documented workflow that summarizes commits/PRs into changelog sections for review.

## Acceptance criteria

- Draft notes separate features, fixes, docs, tests, and security-relevant changes.
- The workflow never publishes automatically.
- Generated notes include a maintainer verification checklist.
- Adoption, stars, downloads, and external contributor claims are not invented.

## Suggested labels

`automation`, `release`, `documentation`

## Why Codex could help

Codex can summarize diffs, group changes into release-note sections, and flag claims that need manual verification.
