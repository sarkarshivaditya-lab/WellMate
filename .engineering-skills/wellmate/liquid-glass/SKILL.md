---
name: wellmate-liquid-glass
description: Govern implementation of WellMate's Liquid Glass visual system inside the existing React + TypeScript + Vite application without changing product architecture or emergency safety behavior.
---

# WellMate Liquid Glass

This is a design-engineering contract for the next frontend visual rebuild. It is not permission to rebuild application architecture, and it is not a mandate to make every surface translucent.

## Governing principles

1. Hierarchy before effect: distinguish functional controls/navigation from content.
2. Content remains the hero: dense wellness content stays stable and readable.
3. Green remains the identity: use WellMate's existing green family, not generic blue/purple AI styling.
4. Depth is layered: backdrop, material, edge, highlight, and shadow each have a job.
5. Tint means emphasis: reserve branded tint for selected/prominent controls and purposeful branded moments.
6. Emergency clarity wins: emergency red is semantic and must not become decorative glow.
7. Progressive enhancement: every important glass surface has an opaque fallback.
8. Existing architecture stays intact: extend current tokens, Radix primitives, layout, and Motion systems.
9. Motion communicates state, not excitement.
10. Accessibility and performance are acceptance criteria, not polish.

## Existing WellMate systems to extend

- `src/design/tokens.ts`: canonical typography, spacing, surfaces and semantic color registry.
- `src/index.css`: CSS variables, utility classes, motion/reduced-motion behavior.
- `src/motion/`: durations, easing, presets, haptics and reduced-motion integration.
- `src/components/ui/`: shared Radix/shadcn-style primitives.
- `src/components/layout/`: AppShell, PageLayout, BottomNav.
- `src/pages/`: route-level compositions.

Do not create a parallel token registry or duplicate component library.

## Material hierarchy

| Material | Primary use | Behavior |
|---|---|---|
| Primary functional glass | persistent navigation, key floating controls | moderate translucency, bounded blur, clear edge, high contrast |
| Secondary glass | compact functional controls/toolbars | lower tint and blur, quieter elevation |
| Elevated glass | transient sheets/popovers/dialogs | higher opacity, stronger edge separation and shadow |
| Subtle glass | small affordances over rich backdrops | minimal blur and decoration |
| Solid fallback | emergency, dense content, unsupported/accessibility modes | opaque semantic surface |

Do not use glass merely because something is a Card.

## Color and green treatment

The existing primary token is the brand anchor (`--primary`, currently HSL 166 / 38% / 35%). Build the glass ramp from the same family:

- deep green: readable branded text and strong actions;
- primary green: core WellMate action;
- mid green: selected/highlight tint;
- pale green: restrained material wash;
- neutral green-gray: default glass;
- emergency red: `--destructive`/red family only for emergency, destructive and true error semantics.

Never shift the core visual system into cobalt, violet, cyan or purple gradients.

## Component architecture

Construct a glass component from five layers:

1. semantic component/layout;
2. named material token;
3. optical treatment (fill + backdrop effect + edge + optional highlight + shadow);
4. interaction state;
5. fallback state.

Keep effects in named token/class definitions rather than arbitrary inline values.

## Typography and spacing

Reuse existing semantic typography roles unless a measured accessibility/usability problem requires change. Do not lower text opacity merely to make glass appear lighter.

Use the existing spacing rhythm in `src/design/tokens.ts`. As a working reference, 8px/12px/16px/20px/24px increments are appropriate for compact to primary surfaces. Preserve existing page spacing where it already works.

Keep interactive targets at least 44px where the target itself is the control.

## Shape

Use a constrained radius vocabulary:

- controls: 10–14px
- standard surfaces: 16–20px
- sheets/dialogs: 20–24px
- pill: 9999px only for pill semantics
- circular control: 50% only when the control is semantically round

Do not create arbitrary radii per component.

## Borders, highlights, shadows and layering

A glass edge should separate, not look like an opaque sticker.

Use a single low-opacity edge at rest, a stronger edge for selected/focus states, and a restrained internal/top highlight where it improves depth. Avoid double borders.

Use soft low-chroma shadows for elevation. Avoid neon glow.

Think in explicit planes:

`background → content → functional glass → transient overlay → emergency-critical`

Persistent functional controls may float above content. Content should not be buried under stacked translucent cards.

## Blur and translucency

Blur is a supporting optical effect.

- Prefer moderate blur on small functional surfaces.
- Raise opacity as content density rises.
- Avoid strong blur across large content areas.
- Never rely on blur to guarantee text contrast.
- Avoid nested blurred descendants.
- Provide an opaque fallback.

## Interaction and motion

Every interactive glass control needs default, hover (pointer only), focus-visible, pressed, selected/current, and disabled states. State must not be communicated by opacity alone.

Reuse `src/motion/tokens.ts`:

- 100ms quick feedback
- 200ms standard interaction
- 300ms calm panel transition
- longer ambient motion only for rare decorative reveals

Prefer opacity/transform transitions. Do not continuously animate blur on many elements. Every new animation must honor `prefers-reduced-motion`. Emergency actions must never wait for decorative animation.

## Responsive behavior

Mobile-first is mandatory:

- narrow screens: higher opacity, lower visual complexity;
- phone: one strong persistent functional glass layer is preferable to many floating panels;
- landscape phone: reduce decoration before reducing usability;
- tablet/desktop: allow larger functional planes, not more glass everywhere;
- preserve existing safe-area handling;
- keep sheets inside the visual viewport.

## Accessibility

- Target WCAG AA contrast for normal text (4.5:1) and large text/UI contexts (3:1 where applicable).
- Keep a visible `:focus-visible` state that survives glass highlights.
- Preserve native semantics, labels, ARIA state, keyboard order, and Radix accessibility behavior.
- Preserve 44px-class touch targets.
- Use opaque/high-contrast fallbacks for reduced transparency and high-contrast modes.
- Reduced-motion must remove non-essential movement.
- Do not put critical instructions over moving/noisy backgrounds.

Golden Hour emergency interaction must remain instantly readable and usable under stress.

## Performance

Treat `backdrop-filter` as a finite rendering budget.

- Never apply expensive blur to hundreds of rows.
- Avoid nested backdrop filters.
- Keep filtered areas small and functional.
- Avoid continuously animating filter, blur, or large shadows.
- Prefer transform/opacity for animation.
- Avoid `will-change` unless measured.
- Prefer CSS/optimized static backgrounds over looping media.
- Test long lists and mobile scrolling.
- Use solid fallbacks where effects are unsupported or too expensive.

Practical review threshold: roughly six simultaneous blurred glass containers in a typical mobile viewport, with zero per-item blur in long lists. This is an engineering budget, not a platform specification.

## Explicit prohibitions

Do not:

- indiscriminately blur;
- make every Card translucent;
- use unreadable translucent text;
- use excessive decorative glass;
- use excessive animation;
- turn WellMate into a purple/blue generic AI interface;
- sacrifice emergency readability for aesthetics;
- replace working functionality merely to achieve glass effects;
- add a glass package before proving a real need;
- duplicate existing design/motion token systems.

## Future implementation sequence

1. confirm content/functional hierarchy;
2. normalize tokens in the existing registry;
3. implement functional glass;
4. map existing components;
5. implement states;
6. add responsive behavior;
7. add optical refinement;
8. validate accessibility;
9. validate performance;
10. run visual regression.

Do not jump directly to refraction or decorative effects.
