# WellMate Interaction Language

Motion design specification for the WellMate platform.

---

## Philosophy

WellMate motion communicates **state, confidence, and calm** — never excitement or urgency.

Every animation serves one purpose: reduce cognitive load by making system behavior legible.
Motion must never compete with the user's attention or create anxiety.

This is a wellness product. The interaction language is emotionally regulated.

---

## Architecture

```
src/motion/tokens.ts    → Raw values (durations, easings, stagger, property sets)
src/motion/presets.ts   → Tailwind class-string combinations + layer semantics
src/motion/haptics.ts   → Web Vibration API wrappers with semantic names
src/hooks/useReducedMotion.ts → Accessibility hook
src/index.css           → @keyframes, .transition-premium, CSS motion tokens, reduced-motion
```

---

## Timing Tokens

| Token      | Value  | Semantic purpose |
|------------|--------|-----------------|
| `instant`  | 0ms    | Immediate state (errors, critical updates — no delay) |
| `quick`    | 100ms  | Hover enter, micro acknowledgment |
| `standard` | 200ms  | **PRIMARY** — all interactive elements (platform baseline) |
| `calm`     | 300ms  | Deliberate transitions, progress fills, accordion |
| `ambient`  | 500ms  | Content reveals, onboarding stagger tail |
| `breathe`  | 1600ms | Passive loading (skeleton shimmer) — reassuringly slow |
| `blink`    | 1000ms | Precise periodic signals (OTP caret) |

**Rule:** Never introduce a raw millisecond value. Use a token.

---

## Easing Tokens

| Token    | Curve                       | Use case |
|----------|-----------------------------|----------|
| `spring` | `cubic-bezier(0.16,1,0.3,1)` | **PRIMARY** — interactive elements. Fast start, soft landing (iOS-caliber) |
| `smooth` | `ease-out`                  | Exits, dismissals, page fade |
| `gentle` | `ease-in-out`               | Ambient loops, continuous background motion |
| `linear` | `linear`                    | Structural/mechanical (sidebar width, progress bar) |

**Rule:** Default to `spring`. Only diverge with explicit reason.

---

## Transition Hierarchy

Different UI layers move at different weights. Heavier layers move slower and more deliberately.

| Layer       | Duration | Easing   | Examples |
|-------------|----------|----------|---------|
| Micro        | 100ms    | spring   | Hover badge, icon swap, dot indicator |
| Component    | 200ms    | spring   | Buttons, cards, inputs, badges |
| Container    | 300ms    | spring   | Progress bar fill, accordion, panel |
| Screen       | 220ms    | smooth   | Route transitions (pure fade, no Y) |
| Overlay      | 200ms    | smooth   | Modals, bottom sheets, drawers |
| Ambient      | 3.5–7.5s | gentle   | Decorative floats, glow pulses |

**Rule:** Content never moves faster than its container.

---

## Entrance Animation Semantics

| Class                  | Duration | Description |
|------------------------|----------|-------------|
| `animate-wm-route-in`  | 220ms    | Full-page entrance — pure opacity fade, no Y movement. Keeps navigation feeling instant. |
| `animate-wm-tab-in`    | 180ms    | Tab panel mount — soft 5px rise. Signals content swap without page-level drama. |
| `animate-wm-icon-in`   | 650ms    | Completion badge scale-in — 0→1 with slight overshoot (1.07). Earned for meaningful moments only. |
| `animate-wm-fade-1–4`  | 500ms    | Staggered content reveal — 0.25s/0.40s/0.55s/0.70s delays. For onboarding flows and multi-step reveals. |

**Rule:** Never apply entrance animations to content that is already visible. Only on mount.

---

## Ambient Motion Rules

Ambient animations run continuously. They must never distract.

| Class                   | Duration | Rule |
|-------------------------|----------|------|
| `animate-wm-float`      | 6s       | Decorative elements only — never content |
| `animate-wm-float-alt`  | 7.5s     | Secondary decorative elements — offset phase |
| `animate-wm-glow`       | 3.5s     | Soft background highlights only |

**Rules:**
- Never apply float/glow to user content (text, metrics, cards with data)
- Maximum 2–3 ambient elements on screen simultaneously
- All ambient motion stops under `prefers-reduced-motion`

---

## Interaction Semantics

### Taps
- Must feel **immediate** — standard (200ms) or quick (100ms)
- Tap compression: `active:scale-[0.97]` — subtle, not dramatic
- No delay before visual feedback
- Haptic: `haptics.light()` for navigation taps, `haptics.complete()` for data-saving actions

### Hover
- Optional enhancement — touch is the primary input
- Card lift: `hover:-translate-y-0.5` — barely perceptible elevation
- Never use hover to reveal critical information (inaccessible on touch)

### Modal entrance
- Slides from bottom, 200ms, `ease-out`
- Backdrop: `fade-in-0` — immediate opacity appearance
- Feels **calm** — user initiated this, no urgency

### Dismissal
- Mirror the entrance direction, 200ms, `ease-out`
- Feels **soft** — the gesture continues the physics of the open
- Haptic: `haptics.dismiss()` on swipe-to-dismiss

### Destructive actions
- Double confirmation — no haptic on first tap
- `haptics.caution()` on first confirm trigger
- `haptics.destructive()` on final irreversible confirm
- Animation: `standard` duration — deliberate, not rushed

### Success confirmation
- `animate-wm-icon-in` for visual milestone badge
- `haptics.success()` for significant milestones (goal achieved, streak milestone)
- `haptics.complete()` for routine completions (meal logged, habit checked)

### Loading transitions
- Use `skeleton-shimmer` (not spinners) for content placeholders
- Spinners only for active network requests (search, send)
- Loading should feel **stable** — shimmer is slow and regular, not urgent

---

## Loading Choreography

**Principle:** Loading should feel reassuring, not anxious.

| Pattern | When | Implementation |
|---------|------|---------------|
| Skeleton shimmer | Content loading, initial hydration | `.skeleton-shimmer` (1.6s gradient sweep) |
| Spinner | Active network request (search, AI query) | `animate-spin` (Tailwind) |
| Progress bar | Determinate progress (onboarding step) | `transition-all duration-500 ease-out` |
| Deferred reveal | Data arrives after layout | `animate-wm-fade-1` or `animate-wm-tab-in` |

**Rules:**
- Never show a spinner for < 300ms (flicker is worse than no indicator)
- Skeleton layout must match the real content layout (no shape mismatch)
- Loading state must be stable — never jitter or re-trigger on fast networks

---

## Haptic Semantics

Physical feedback for mobile web users. Always falls back silently on desktop.

| Function               | Pattern      | When to use |
|------------------------|--------------|-------------|
| `haptics.light()`      | 8ms          | Button taps, settings toggles, navigation |
| `haptics.complete()`   | [20, 12, 20] | Meal logged, habit checked, journal saved |
| `haptics.success()`    | [30, 18, 60] | Goal achieved, streak milestone, meaningful moment |
| `haptics.gentle()`     | [10, 8, 10]  | Quiet reinforcement — check-in complete, reminder acknowledged |
| `haptics.caution()`    | [70, 35, 70] | Pre-confirmation warning before destructive action |
| `haptics.destructive()`| 180ms        | Final irreversible confirm (delete entry, reset data) |
| `haptics.dismiss()`    | 8ms          | Sheet dismissed, modal cancelled |

**Rules:**
- Never call haptics on scroll or passive hover
- Never call haptics more than once per user gesture
- Ambient/decorative events: no haptic
- Haptics follow reduced-motion intent — if user prefers less motion, skip haptics too

---

## Gesture Response

Currently CSS-only (no Framer Motion / React Gesture Handler).

| Gesture | Behavior | Notes |
|---------|---------|-------|
| Tap | `active:scale-[0.97]` compression | 200ms spring release |
| Hover | `-translate-y-0.5` lift | Touch fallback: no effect |
| Swipe (Radix) | Radix-managed (Sheet, Drawer, Dialog) | Direction-matched slide-out |
| Scroll | Native — no JS interception | Never lock scroll |

**Future gesture rule:** Any custom swipe/drag handler must use the `standard` (200ms) or `calm` (300ms) release timing. Never faster than quick (100ms) for drag release — feels abrupt.

---

## Reduced Motion

Honors `prefers-reduced-motion: reduce` at both CSS and JS levels.

**CSS behavior** (index.css):
- Entrance animations (`wm-fade-*`, `wm-tab-in`, `wm-route-in`, `wm-icon-in`) → instant reveal, no movement
- Ambient loops (`wm-float`, `wm-float-alt`, `wm-glow`) → stopped
- Skeleton shimmer → static muted swatch
- `.transition-premium` → collapsed to 100ms (state feedback preserved, no sweep)

**JS behavior** (useReducedMotion hook):
- Returns `true` when system requests reduced motion
- Use to skip JS-driven animations or conditional class application

**Rule:** Every new animation must have a reduced-motion fallback. Either the CSS `@media` block, or a `useReducedMotion` guard.

---

## AI Surface Compatibility

Future AI overlay surfaces (coach messages, contextual insights, conversational UI) must inherit this motion system. They are not a separate product — they are WellMate speaking.

**Requirements for AI surfaces:**
- Use `animate-wm-tab-in` or `animate-wm-fade-1` for panel/content appearance
- Use `animate-wm-route-in` for full-screen AI transitions
- Loading: skeleton shimmer for content placeholders, spinner for active generation
- Dismissal: `ease-out`, `standard` (200ms) — same as any other overlay
- No bespoke timing values — AI UI derives from the same tokens as everything else
- Haptics: `haptics.gentle()` for AI check-ins, `haptics.complete()` for AI-generated plan delivery

**The AI voice must sound like WellMate, not like a floating GPT overlay.**

---

## What Motion Should Never Do

- Create urgency without reason
- Compete for attention with content
- Cause layout shift or jank
- Differ per-component without architectural reason
- Run continuously at high speed
- Require network availability
- Block user interaction
- Animate destructive state changes faster than the user can read them

---

## Motion Debt

Remaining items that are tracked but not yet implemented:

| Item | Priority | Notes |
|------|---------|-------|
| Custom Radix animation durations | Low | Radix uses Tailwind defaults (~150ms). Could explicitly set to 200ms via `[data-state]` CSS for exact control. |
| JS-driven stagger for dynamic lists | Low | Current stagger is static (1–4 slots). Long dynamic lists need a computed stagger utility. |
| Page-level transition component | Medium | Route changes currently use instant navigation + `animate-wm-route-in` on mount. A dedicated `<PageTransition>` component would centralize this. |
| Drag/swipe gesture library | Future | CSS-only gestures are sufficient now. Framer Motion or React Gesture Handler would be added when AI surfaces need richer interactions. |
| Haptic integration in existing components | Medium | `haptics.*` functions exist but are not yet wired to buttons/cards/forms. |
| Dev motion panel (Dev.tsx) | Low | Token previews and timing diagnostics would help validate motion feel. |
