---
name: wellmate-memory
description: Maintain durable project memory so future WellMate work does not require rediscovering established architecture and decisions.
---

# WellMate Engineering Memory

## Purpose

Capture durable facts that materially reduce future rediscovery.

Memory must contain facts, not conversational speculation.

## Record

Capture:

- architecture decisions
- locked systems
- canonical data ownership
- fragile subsystems
- known regressions
- important dependency behavior
- platform-specific behavior
- validation requirements
- major feature state
- significant debugging discoveries
- rollback points
- rejected architectural approaches when the rejection prevents future mistakes

## Do not record

Do not store:

- temporary thoughts
- trivial implementation details
- secrets
- credentials
- personal sensitive information
- facts that can be trivially rediscovered

## Memory rule

Before making a significant change:

1. Read relevant existing memory.
2. Compare it against the current code.
3. Update memory only when a durable fact changes.

After discovering an important failure:

- record the root cause
- record the affected subsystem
- record the successful resolution
- record validation performed

## Source of truth

Memory never overrides source code or `CLAUDE.md`.

If memory conflicts with the repository:

1. inspect the repository
2. resolve the discrepancy
3. update memory
