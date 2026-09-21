# Auth + Session Engineering Skill

Scope: Auth0, OIDC, Capacitor callback handling, route guards, and session synchronization.

Before editing authentication:
- Trace the complete flow: app boot -> provider setup -> login initiation -> authorization redirect -> callback handling -> token/session state -> Convex identity -> post-login routing.
- Treat browser and Capacitor-native flows as separate transport paths with a shared identity contract.
- Preserve the current return-to location across authentication.
- Prevent duplicate login launches and callback re-processing.
- Keep redirect URIs centralized; do not scatter hard-coded callback URLs.
- Surface actionable authentication errors without leaking tokens, authorization codes, or secrets.
- Verify both authenticated and unauthenticated routes, cold-start callback handling, reloads, and interrupted redirects.
- Changes to auth must be tested as a full flow, not only by inspecting the login button.
