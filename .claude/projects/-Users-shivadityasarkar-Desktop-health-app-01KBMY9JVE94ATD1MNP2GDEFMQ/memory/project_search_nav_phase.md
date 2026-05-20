---
name: search-nav-phase
description: Search + Global Navigation Architecture phase — command palette, quick-add, activity timeline, wellness relations
metadata:
  type: project
---

Phase shipped 2026-05-18. All infrastructure is local-first, TypeScript-clean, build-passing.

## Files Created

- `src/search/searchTypes.ts` — SearchResult, SearchModule, SearchGroup types
- `src/search/searchIndex.ts` — searchAll(), getRecentActivity() — reads from all local stores
- `src/contexts/commandPaletteContext.tsx` — CommandPaletteProvider + useCommandPalette hook
- `src/hooks/useRecentActivity.ts` — Reactive cross-store recent activity
- `src/insights/wellnessRelations.ts` — computeWellnessRelations() — deterministic cross-module insights
- `src/components/search/WellmateCommandPalette.tsx` — cmdk-based palette; quick actions + recent + search + nav
- `src/components/quickadd/QuickAddSheet.tsx` — Bottom sheet with 6-entity quick-capture (mood/journal/exercise/sleep/meal/habit)
- `src/components/timeline/ActivityTimeline.tsx` — Unified recent activity feed component

## Files Modified

- `src/components/layout/AppShell.tsx` — Added CommandPaletteProvider, WellmateCommandPalette, SearchFab (bottom-left), KeyboardShortcut (Cmd+K)
- `src/analytics/types.ts` — Added command_palette_opened, search_performed, quick_add_used events; search + quick_add to FeatureName
- `src/pages/Index.tsx` — Added ActivityTimeline + wellness relation cards (computeWellnessRelations)

## Architecture

- SearchFab: fixed, z-40, left-4, bottom-[calc(env(safe-area-inset-bottom)+56px+12px)] — mirrors WellMateLauncher on right
- Palette trigger: SearchFab (mobile) + Cmd+K (desktop)
- Search: synchronous, from in-memory store snapshots, no network
- Wellness relations require min 3-6 data points before surfacing — never shows with empty data
- Analytics: emitAnalyticsEvent() used for palette open tracking; wired into existing eventBus

**Why:** search-nav-phase is the first step toward making WellMate feel like ONE connected wellness OS instead of isolated tabs.
**How to apply:** Future features should expose their data via the existing store subscription pattern (subscribeToX) so they appear in search/timeline automatically.
