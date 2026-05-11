# WELLMATE — AUTHORITATIVE ENGINEERING CONTEXT

## PROJECT OVERVIEW

WellMate is a production-grade health and wellness application.

Stack:
- Frontend: React + TypeScript + Vite
- Backend: Convex
- Auth: Auth0
- Architecture: Offline-first, local-source-of-truth, deferred server sync

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

These files are considered locked unless explicitly requested:

- src/pages/Onboarding.tsx
- existing sync architecture
- existing local storage persistence model

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

Always:
- preserve offline-first behavior
- maintain deferred sync compatibility

---

# IMPLEMENTATION RULES

Before making changes:
1. Identify all affected files
2. Check for downstream dependencies
3. Avoid regression risks
4. Preserve architecture consistency

After changes:
- ensure TypeScript passes
- ensure imports are clean
- ensure no dead code introduced
- ensure no duplicate components created

---

# CODING STYLE

Prefer:
- simple readable code
- maintainable implementations
- small focused components
- predictable logic

Avoid:
- unnecessary cleverness
- premature optimization
- giant components
- deeply nested logic

---

# WORKFLOW RULES

When implementing:
- modify only what is necessary
- avoid speculative refactors
- avoid unrelated cleanup
- avoid renaming files unless requested

Always explain:
- affected files
- architecture impact
- possible regressions
- validation steps

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
2. Offline reliability
3. Architecture consistency
4. Mobile UX
5. Performance
6. Visual polish

Never sacrifice stability for aesthetics.