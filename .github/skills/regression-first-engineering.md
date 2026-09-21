# Regression-First Engineering Skill

The deployed behavior of WellMate is the primary compatibility contract.

Rules:
- Build on existing behavior; do not replace working paths merely because a newer pattern is cleaner.
- Before changing a legacy path, map every caller, side effect, storage key, environment switch, and downstream integration.
- Preserve current URLs, route semantics, authentication behavior, data formats, localStorage keys, Convex contracts, environment variable names, and public component APIs unless the task explicitly requires a migration.
- Prefer additive changes, compatibility adapters, feature flags, or staged migrations over abrupt replacement.
- Never remove a legacy implementation until its consumers are proven migrated and the old deployment behavior has an equivalent path.
- Compare the pre-change and post-change dependency graph for affected subsystems.
- Treat production build success as necessary but insufficient: regression-check behavior at runtime where practical.
- For risky changes, establish a baseline before editing and record any intentionally changed behavior in .memory.

Required verification gates:
1. Baseline: current branch builds/tests and affected flow is understood.
2. Static: lint + TypeScript + tests + build.
3. Integration: exercise affected route/API/auth/sync/native path.
4. Compatibility: verify old callers and persisted data remain valid.
5. Recovery: verify reload/offline/reconnect/error paths when relevant.
