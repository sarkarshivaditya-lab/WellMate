# Convex Engineering Skill

Scope: convex/**/*.ts and frontend code calling Convex.

Before editing:
- Inspect the Convex schema, generated API/types, and all callers of the function being changed.
- Keep authorization server-side. Resolve identity with `ctx.auth.getUserIdentity()` and scope user data to the authenticated identity.
- Preserve argument validators; prefer explicit Convex validators over untyped inputs.
- Treat mutations as idempotent when they participate in retries or offline synchronization.
- Never rely on client-side authentication or route guards for data authorization.
- Do not manually edit `convex/_generated/*`; regenerate through Convex tooling when needed.
- For sync-sensitive mutations, understand local queueing, retry, conflict, and replay behavior before changing server semantics.

Current architecture notes:
- User documents are keyed by `tokenIdentifier` through the `by_token` index.
- Local-first sync is an explicit architectural contract documented in `RELIABILITY.md`.
