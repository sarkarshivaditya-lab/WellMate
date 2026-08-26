---
name: wellmate-orchestration
description: Convert a natural-language WellMate development request into a controlled engineering execution plan.
---

# WellMate Orchestration

## Mission

Translate user intent into safe, bounded engineering work.

Never interpret a vague request as permission for broad refactoring.

## Execution chain

1. Parse the user's requested outcome.
2. Identify the feature/system involved.
3. Determine whether the request is:
   - investigation
   - bug fix
   - feature
   - UX change
   - architecture change
   - refactor
   - documentation
   - tooling
4. Identify affected files and systems.
5. Check `CLAUDE.md` for architectural and locked-system constraints.
6. Search for downstream dependencies.
7. Research external documentation only when needed.
8. Produce an implementation plan.
9. Make the smallest necessary change.
10. Validate the result.
11. Review the diff for unintended changes.
12. Update engineering memory when a durable fact was discovered.
13. Create a clean, focused commit.

## Safety gates

Before implementation:

- Never modify locked systems without explicit permission.
- Never replace existing architecture for convenience.
- Never introduce network-first behavior.
- Never move local-first data ownership to the backend.
- Never perform unrelated cleanup.
- Never silently expand scope.

After implementation:

- TypeScript/build must pass.
- Imports must be clean.
- No dead code should be introduced.
- No duplicate implementation should be introduced.
- Offline behavior must remain intact.
- Local profile/onboarding behavior must remain independent of backend availability.

## Failure handling

If validation fails:

1. Identify the failure.
2. Determine whether the failure was caused by the change.
3. Fix the root cause when within scope.
4. Re-run validation.
5. If the change becomes unsafe or scope expands materially, stop and report.

Never hide a failing validation step.
