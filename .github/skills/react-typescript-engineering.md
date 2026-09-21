# React + TypeScript Engineering Skill

Scope: src/**/*.ts and src/**/*.tsx.

Before editing:
- Trace imports, route ownership, providers, hooks, and side effects before changing behavior.
- Prefer existing abstractions over introducing parallel state, storage, sync, or auth paths.
- Preserve TypeScript strictness and existing path aliases.
- Keep components focused; move reusable behavior into hooks/lib modules when appropriate.
- Treat React effects, subscriptions, timers, async callbacks, and event listeners as lifecycle-sensitive resources. Every setup must have deterministic cleanup.
- Do not weaken types with `any`, broad casts, or non-null assertions unless the repository already requires a boundary-specific escape hatch and it is documented.
- Preserve accessibility: semantic controls, labels, keyboard behavior, focus management, and loading/error states.

Change discipline:
1. Map the dependency chain.
2. Identify all callers and state owners.
3. Make the smallest coherent architectural change, not isolated symptom patches.
4. Run lint, TypeScript, tests, and build after changes.
5. For multi-file TSX changes, review hooks, rendering behavior, accessibility, and unnecessary re-renders.

Project-specific:
- React 19 + Vite 7 + TypeScript 5.9.
- React Router is the route boundary.
- Auth0 is the browser authentication boundary.
- Convex is the backend boundary.
- `@/*` maps to `src/*`; `@/convex/*` maps to `convex/*`.
