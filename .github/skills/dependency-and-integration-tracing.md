# Dependency + Integration Tracing Skill

For complex multilevel edits, trace beyond direct imports.

Map:
- entry points -> providers -> route/page -> hook -> service/adapter -> persistence -> sync -> Convex/backend -> external integration
- environment variables and build-time mode switches
- browser vs Capacitor execution paths
- authentication/session boundaries
- error boundaries, retries, timers, listeners, and async callbacks

Rules:
- Search for consumers before changing exported types/functions.
- Search for producers before changing persisted shapes or backend contracts.
- Track both static imports and string/key-based coupling such as localStorage keys, route paths, environment variables, and event names.
- Treat CI/build scripts and Capacitor configuration as part of the runtime contract.
- When an edit crosses layers, verify each boundary independently.
