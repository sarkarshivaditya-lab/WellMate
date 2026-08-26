---
name: wellmate-workflow
description: Execute WellMate changes through a repeatable inspect-plan-implement-verify-review workflow.
---

# WellMate Workflow

## Phase 1 — Intake

Convert the user's natural-language request into:

- desired outcome
- explicit constraints
- implicit safety constraints
- affected feature
- acceptance criteria

Do not begin editing merely because a file appears relevant.

## Phase 2 — Inspection

Before editing:

- inspect the relevant implementation
- inspect its callers
- inspect related types
- inspect state ownership
- inspect persistence/sync behavior
- inspect relevant tests
- inspect relevant documentation
- inspect recent related Git history when useful

## Phase 3 — Plan

Identify:

- files to change
- files that must remain untouched
- dependencies
- risks
- validation commands
- rollback strategy

Prefer the smallest viable change.

## Phase 4 — Implementation

Follow existing architecture.

Do not:

- rewrite stable systems
- introduce speculative abstractions
- rename unrelated files
- change persistence ownership
- change backend authority
- add dependencies without justification

## Phase 5 — Verification

Run the narrowest relevant checks first.

Then, where applicable:

- TypeScript build
- lint
- tests
- production build
- platform-specific validation

## Phase 6 — Diff review

Check:

- intended files only
- no accidental formatting churn
- no debugging artifacts
- no secrets
- no unrelated changes
- architecture preserved

## Phase 7 — Record

Record durable architectural discoveries in WellMate memory.

## Phase 8 — Commit

One logical change per commit.

Commit message must describe the actual change.

Never commit known broken application code unless explicitly requested.
