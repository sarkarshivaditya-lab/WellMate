# Release + Change-Control Skill

Every substantial change is treated as a controlled release increment.

Before edit:
- Establish current commit/branch and affected subsystem baseline.
- Identify deployment-critical surfaces: auth, routing, Convex, persistence/sync, payments, emergency flow, CI/build, Capacitor.
- Define explicit invariants that must remain true.

During edit:
- Make coherent multi-file changes rather than symptom patches.
- Keep unrelated cleanup out of the change.
- Do not modify generated code directly.
- Do not change production environment defaults casually.

After edit:
- Run the repository's available validation gates.
- Inspect git diff and affected dependency paths.
- Record files changed, behavior changed, compatibility preserved, tests run, and known residual risks in .memory.
- Do not call a change complete when only compilation succeeds.
