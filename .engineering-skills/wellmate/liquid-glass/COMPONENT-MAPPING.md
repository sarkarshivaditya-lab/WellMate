# WellMate Liquid Glass Component Mapping

This mapping reflects the current repository architecture: AppShell/PageLayout/BottomNav under `src/components/layout`; shared Radix-style primitives under `src/components/ui`; domain pages under `src/pages`; physical/mental subroutes; and the existing design/motion token systems.

| Architecture area | Current examples | Planned material | Rationale / constraints |
|---|---|---|---|
| Persistent top shell | `AppShell.tsx` / TopSearchBar | Secondary glass | Functional plane above scrolling content. Preserve high-contrast search/profile actions. |
| Bottom navigation | `BottomNav.tsx` | Primary functional glass | Best existing fit; current code already has translucency/blur, active green tint, safe-area handling and 44px minimum targets. Refine rather than replace. |
| Page header | `PageLayout.tsx` | Solid or near-opaque / subtle glass | Contains title and sync state; too much transparency reduces hierarchy. |
| Standard content Card | `components/ui/card.tsx` | Solid by default | Current Card is intentionally opaque and elevated; preserve it as a stable content material. |
| Intelligence/metric cards | WellnessScoreCard, SleepScoreCard, HabitMomentumCard, WeeklySummaryCard, RecentChangesCard | Solid/near-opaque; selective subtle | Charts and metrics need stable contrast. One featured insight can carry stronger treatment. |
| Small signals | insight-card, signal-pill, trend-badge, stat-cell | Subtle glass selectively | Small semantic affordances can carry light material; semantic contrast must remain intact. |
| Primary buttons | Button + variants | Brand-tinted glass selectively | Primary actions must remain high contrast. Glass is an enhancement, not a requirement. |
| Secondary buttons | Button variants | Secondary glass or solid | Useful over rich backgrounds; keep stable when contrast is uncertain. |
| Icon controls | search/profile/close and shared icon buttons | Secondary/subtle glass | Good fit when target remains 44px-class and label/ARIA semantics are preserved. |
| Inputs | `input.tsx`, form primitives | Solid/near-opaque | Stable affordance and text contrast matter more than transparency. |
| Dialogs | `dialog.tsx` | Elevated glass selectively | Keep Radix mechanics. Increase opacity with content density. |
| Sheets | `sheet.tsx` | Elevated glass / near-opaque | Strong spatial candidate; preserve visual-viewport and safe-area behavior. |
| Navigation menus | Radix navigation/menu primitives | Primary/secondary glass | Functional layer candidate, especially on desktop. |
| Floating actions | WellMateLauncher, quick actions | Primary/secondary glass | Fits functional-floating role; prevent overlap with BottomNav/emergency controls. |
| Profile/health data | Profile, HealthProfileSection, DataOwnershipCard | Solid/near-opaque | Sensitive information should be calm and stable. |
| Onboarding | `Onboarding.tsx` | Mostly solid/subtle | Locked file/system; visual treatment must not alter ownership or flow semantics. |
| Welcome/Transition | Welcome.tsx, Transition.tsx | Subtle/elevated atmospheric treatment | Can carry more mood, but motion/reduced-motion rules remain mandatory. |
| Physical dashboard | PhysicalDashboard and children | Mixed | Functional controls may float; data/log/chart content stays stable. |
| Mental dashboard | mental/Overview and related pages | Mixed | Same content/functional separation. |
| Lists | habits, journal, meals, timelines | Solid/near-opaque rows | Never apply per-row backdrop blur to potentially long lists. |
| Charts | SparkLine, WellnessBar, Recharts | Solid background | Protect data legibility and rendering performance. |
| Settings | profile/settings controls | Mostly solid + selective functional glass | Prioritize scanability and predictable controls. |
| Status indicators | OfflineBanner, SyncPulse, signal/status pills | Semantic solid/subtle | State should be explicit through labels/icons/color, not translucency. |
| Emergency center | current/future emergency UI | Solid/high contrast | Explicit exception; spatial layering around the control, never aesthetic glass over the critical content. |

## Architecture notes

### AppShell

The persistent top search/profile bar is already separated from scrolling main content. This is the correct functional-layer boundary for a glass treatment.

### BottomNav

The existing BottomNav already uses translucency/backdrop blur, a green active tint, safe-area handling, and 44px minimum targets. The rebuild should refine the material rather than reimplement routing semantics.

### PageLayout

The page header already uses a near-opaque card/blur treatment and includes sync status controls. Keep it stable enough for scanability; do not make it transparent simply to increase the glass effect.

### Card

The shared Card is an opaque content-layer primitive with green-tinted elevation. Preserve this as the primary solid content surface after the rebuild.

### Radix overlays

Dialog and Sheet already supply accessibility-oriented interaction mechanics. Keep those mechanics and only modify visual treatment in the later implementation phase.

### Domain pages

Physical and mental experiences combine metrics, charts, logs, insights and controls. Treat these as compositions of stable content plus a small number of functional glass planes, not as a grid of frosted cards.

## Mapping decision test

Before applying glass ask:

1. Is the component primarily functional?
2. Does showing content behind it improve orientation?
3. Can text and controls remain readable over every supported background?
4. Is the effect important enough to justify its rendering cost?
5. Is there an opaque fallback?

A "no" to the first two is a strong reason to keep the component solid.
