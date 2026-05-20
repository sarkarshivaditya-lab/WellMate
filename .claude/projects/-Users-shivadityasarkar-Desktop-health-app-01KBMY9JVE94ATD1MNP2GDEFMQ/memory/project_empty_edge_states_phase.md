---
name: project-empty-edge-states-phase
description: Empty states + edge states systemization — what was built, what's reused, and remaining gaps
metadata:
  type: project
---

Phase shipped: empty states + edge states systemization (resilience UX).

**Why:** Elevate WellMate from functional to emotionally resilient — calm under failures.

## NEW infrastructure (React hooks)
- `src/hooks/useConnectivity.ts` — wraps `subscribeToConnectivity()`, returns `ConnectivityState`
- `src/hooks/useSyncStatus.ts` — wraps `subscribeToSyncStatus()`, returns `{ status, summary }`

## NEW UI components
- `src/components/OfflineBanner.tsx` — slim global banner; offline shows "data is safe" msg, reconnect shows brief "Back online" flash then hides. Wired into AppShell.
- `src/components/SyncPulse.tsx` — amber strip for dead-letter ops (failed remote sync). Hidden when offline (OfflineBanner covers it). Taps to /profile. Only shows when deadletterCount > 0.

## MODIFIED files
- `AppShell.tsx` — adds OfflineBanner + SyncPulse above main content
- `AppErrorBoundary.tsx` — hides raw error from users, shows calm "Something unexpected happened" + error ID for support, uses design system classes
- `NotFound.tsx` — warmer 404: "This page doesn't exist" with back/home buttons
- `PeriodTracker.tsx` — offline fallback when connectivity=offline+Convex undefined (shows calm placeholder instead of perpetual skeleton)
- `FoodLog.tsx` — standardized to `Empty` component (was inline div)
- `ExerciseLog.tsx` — standardized to `Empty` component (was inline div)
- `Sleep.tsx` — standardized to `Empty` component (was inline div), improved avg card empty tone
- `PhysicalDashboard.tsx` — improved TodayActivitySummary empty tone
- `Overview.tsx` (mental) — mood check-in text changed from accusatory "You haven't checked in" → "How are you feeling today?"; journal empty state improved with sub-description

## Reused infrastructure (never recreated)
- `connectivity.ts`, `syncStatus.ts`, `hydration.ts` — used as-is
- `Empty` / `ErrorState` component families — extended to new pages
- Motion tokens, haptics — unchanged
- AppErrorBoundary already existed; we improved aesthetics only

## Remaining gaps (not addressed in this phase)
- `syncStatus.ts` reads from legacy `syncQueue.ts`, not new `operationQueue.ts` — SyncPulse may show stale zeros until syncStatus is updated
- No subscription expired variant in GatedFeatureBanner
- No first-week experience system (progressive disclosure, new user hints)
- No conflict resolution UI for multi-device scenarios
- Permission denial flows (notifications, health) not yet implemented
- Hydration state machine (degraded/corrupted) not yet surfaced in UI

**How to apply:** When adding new data-driven pages, use `Empty` component with `border-none bg-transparent` override when inside CardContent. Wire offline fallback for any Convex-dependent component using `useConnectivity()`.
