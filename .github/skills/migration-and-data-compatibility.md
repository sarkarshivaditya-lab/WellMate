# Migration + Data Compatibility Skill

Scope: persisted client data, Convex schemas/functions, API payloads, auth claims, routes, and configuration.

Rules:
- Assume deployed users may have older persisted data and older app sessions.
- Prefer backwards-compatible readers and additive writers before destructive format changes.
- Version persisted formats when shape changes are material.
- Never silently discard malformed or legacy data.
- For Convex changes, preserve existing documents/function contracts or provide a migration-compatible path.
- For route/config changes, retain aliases or fallback behavior when existing clients may depend on them.
- Define rollback behavior before making irreversible migrations.
- Update documentation and .memory whenever compatibility assumptions change.
