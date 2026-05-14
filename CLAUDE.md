# WELLMATE — AUTHORITATIVE ENGINEERING CONTEXT

## PROJECT OVERVIEW

WellMate is a production-grade health and wellness application.

Stack:

- Frontend: React + TypeScript + Vite
- Backend: Convex
- Auth: Auth0
- Architecture: Offline-first, local-first, privacy-first, deferred server sync

This is a mobile-first application.

---

# CORE ARCHITECTURE RULES

## OFFLINE-FIRST IS ABSOLUTE

The app MUST remain fully functional offline.

Rules:

- Local state is always the primary source of truth
- Server sync is deferred
- UI must never depend directly on network availability
- Never block user interaction on API completion
- Never introduce network-first logic
- Never tightly couple UI state to Convex responses

---

# LOCAL-FIRST PRIVACY ARCHITECTURE

WellMate follows a strict local-first privacy-oriented wellness architecture.

Core principle:
Sensitive wellness and onboarding profile data are device-resident by default.

The local onboarding/profile system is the canonical source of truth unless explicitly stated otherwise.

Examples of local-first data:

- onboarding_profile
- onboarding_draft
- BMI inputs
- height/weight
- activity level
- wellness goals
- local AI context
- temporary emotional context
- draft wellness state

Rules:

- Never make onboarding completion dependent on backend mutations
- Never block profile rendering on Convex queries
- Never require authenticated backend sync for onboarding-derived functionality
- Never delete local profile state after backend sync
- Never treat Convex user records as authoritative for onboarding profile data
- Never introduce network-gated onboarding flows
- Never make the UI depend on getCurrentUser() for local wellness calculations
- Never introduce server-required hydration for profile rendering
- Never introduce automatic remote persistence of sensitive onboarding data unless explicitly requested

Backend sync philosophy:

- Backend sync is additive and optional
- Local state remains authoritative
- Convex sync must never destabilize the app
- Failed backend sync must never break rendering
- Local calculations must always function independently

Auth philosophy:

- Auth0/Convex authentication exist for:
  - identity
  - sessions
  - permissions
  - optional future sync

Authentication must NOT become a hard dependency for:

- onboarding rendering
- profile rendering
- local wellness calculations
- offline functionality

Future architecture direction:

- Privacy-first wellness intelligence
- Local-first AI context handling
- Device-resident sensitive wellness memory where feasible
- Optional cloud synchronization only when explicitly implemented

---

# DO NOT REWRITE EXISTING ARCHITECTURE

Do NOT:

- Replace state management patterns
- Introduce Redux/Zustand/MobX/etc unless explicitly requested
- Replace sync architecture
- Replace routing architecture
- Replace Convex integration patterns
- Reorganize folders unnecessarily
- Rewrite stable components "for cleanliness"

Implement within existing architecture.

---

# LOCKED FILES

These files/systems are considered locked unless explicitly requested:

- src/pages/Onboarding.tsx
- src/hooks/useLocalProfile.ts
- existing sync architecture
- existing local storage persistence model
- local-first onboarding architecture
- onboarding_profile canonical ownership model

Do not modify locked systems without permission.

---

# UI/UX RULES

The app is:

- mobile-first
- touch-first
- modern
- smooth
- minimal
- production-grade

Requirements:

- maintain responsive layouts
- maintain spacing consistency
- preserve touch target sizes
- avoid clutter
- avoid excessive animations
- prioritize readability
- preserve smooth perceived performance
- maintain calm wellness-oriented aesthetics

Preferred visual direction:

- soft premium wellness
- layered dark surfaces
- subtle gradients
- restrained glow effects
- premium typography hierarchy
- modern spacing rhythm
- elegant transitions
- accessible contrast

Avoid:

- cyberpunk aesthetics
- aggressive neon
- cluttered dashboards
- over-animated interfaces
- visual noise

---

# TYPESCRIPT RULES

Requirements:

- strict typing
- avoid any
- avoid type suppression
- no unnecessary abstractions
- no overengineering

Always:

- reuse existing types when possible
- preserve type safety
- ensure build passes

---

# CONVEX RULES

Do NOT:

- break existing schema assumptions
- create duplicate data flows
- bypass sync architecture
- tightly couple Convex queries to rendering
- reintroduce Convex-owned onboarding state
- make local profile rendering depend on Convex auth readiness
- promote onboarding data to mandatory backend ownership
- introduce server-authoritative onboarding flows

Always:

- preserve offline-first behavior
- maintain deferred sync compatibility
- preserve local-first rendering
- gracefully handle backend failures
- treat local onboarding data as canonical

---

# IMPLEMENTATION RULES

Before making changes:

1. Identify all affected files
2. Check for downstream dependencies
3. Avoid regression risks
4. Preserve architecture consistency
5. Preserve local-first data ownership

After changes:

- ensure TypeScript passes
- ensure imports are clean
- ensure no dead code introduced
- ensure no duplicate components created
- ensure offline functionality still works
- ensure onboarding/profile rendering still functions without backend availability

Always preserve:

- local-first rendering
- offline-safe profile access
- graceful backend failure behavior
- local onboarding canonical ownership

---

# CODING STYLE

Prefer:

- simple readable code
- maintainable implementations
- small focused components
- predictable logic
- low-complexity solutions
- stable rendering behavior

Avoid:

- unnecessary cleverness
- premature optimization
- giant components
- deeply nested logic
- speculative abstractions

---

# WORKFLOW RULES

When implementing:

- modify only what is necessary
- avoid speculative refactors
- avoid unrelated cleanup
- avoid renaming files unless requested
- preserve stable architecture boundaries

Always explain:

- affected files
- architecture impact
- possible regressions
- validation steps
- offline/local-first implications

Never silently:

- change persistence ownership
- move local logic to backend
- introduce auth-gated rendering
- introduce server-authoritative behavior

---

# CURRENT PROJECT STRUCTURE

Frontend:

- src/components
- src/hooks
- src/adapters
- src/pages
- src/pages/mental
- src/pages/physical

Backend:

- convex/users.ts
- convex/habits.ts
- convex/meals.ts
- convex/moods.ts
- convex/journal.ts
- convex/sleep.ts
- convex/subscriptions.ts
- convex/aiCoach.ts
- convex/aiMentalCoach.ts

---

# PRIORITY

Priority order:

1. Stability
2. Privacy-first local ownership
3. Offline reliability
4. Architecture consistency
5. Mobile UX
6. Performance
7. Visual polish

Never sacrifice:

- local-first guarantees
- privacy-first principles
- offline reliability
- stability

for aesthetics or architectural experimentation.
