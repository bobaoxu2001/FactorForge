# Improve Production Deployment Docs

## Problem

The README covers Vercel and Docker basics, but operators may still need clearer environment-specific guidance.

## Scope

Create a deployment guide for Vercel, Docker, and local production smoke checks, including required/optional env vars and safe demo defaults.

## Acceptance criteria

- Required `SESSION_PASSWORD` setup is prominent.
- Optional provider, LLM, and Redis/KV variables are clearly separated.
- Health-check expectations and degraded states are documented.
- No real secrets or fake production claims appear.

## Suggested labels

`documentation`, `deployment`, `security`

## Why Codex could help

Codex can compare `.env.example`, env validation, README, and `/api/health` output to draft accurate deployment docs.
