# Reliability + Safe Edit Skill

WellMate has a documented reliability architecture in `RELIABILITY.md`. Treat it as an implementation contract unless a change explicitly revises that contract.

Rules:
- One canonical owner per state domain. Do not create duplicate stores or parallel sync engines.
- Preserve the single sync execution path unless the architecture is intentionally redesigned.
- Use `safeRead/safeWrite`, `atomicWrite`, `commitMutation`, hydration gates, and connectivity helpers according to their documented roles.
- Assume app restarts, tab duplication, offline periods, reconnects, retries, and interrupted writes are normal cases.
- Preserve idempotency and replay protection when changing mutations or queues.
- Update `RELIABILITY.md` whenever an architectural invariant, known risk, or recovery behavior materially changes.
- Run deterministic tests plus lint/typecheck/build before considering a structural edit complete.
