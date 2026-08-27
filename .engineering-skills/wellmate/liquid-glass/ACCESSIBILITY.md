# WellMate Liquid Glass Accessibility

## Core requirement

Golden Hour emergency interaction must remain instantly readable and usable under stress. Aesthetic fidelity never overrides emergency comprehension.

## Contrast

Use WCAG AA as the web baseline:

- normal text: 4.5:1 minimum target;
- large text/UI contexts: 3:1 where the criterion applies;
- verify against the actual composited surface, not only the source token;
- never reduce text opacity to "blend" with glass.

## Focus

All custom interactive glass controls require visible `:focus-visible`.

The focus treatment must remain visible over highlights and backgrounds, use more than opacity alone, and never be hidden beneath overlays.

## Semantics

- keep native button/link/input semantics;
- preserve accessible labels for icon-only controls;
- preserve `aria-current`, `aria-expanded`, dialog semantics and Radix behavior;
- never make hover the only way to discover critical information.

## Touch and input

- preserve 44px-class targets;
- maintain comfortable spacing between emergency actions;
- do not shrink targets to make glass look delicate.

## Motion

Reuse the existing `prefers-reduced-motion` implementation in `src/motion/` and `src/hooks/useReducedMotion`.

Reduced-motion mode must:

- remove non-essential morphing/shine movement;
- stop ambient glass motion;
- keep state changes immediate/brief;
- retain visible feedback.

## Transparency preferences

`prefers-reduced-transparency` is not universally supported in current browsers, so it must be an enhancement rather than a dependency.

Provide explicit opaque/high-contrast fallbacks independent of the media query. Where reduced transparency is requested, promote glass to an opaque semantic surface.

## Higher contrast

Use stronger borders and more opaque fills when a user requests higher contrast. The broadly supported `prefers-contrast` media feature can reinforce this, but contrast must already be safe by default.

## Dynamic backgrounds

Never place critical instructions directly over moving/noisy backgrounds. Increase material opacity or move the content to a stable surface.

## Emergency states

- emergency red is semantic only;
- the primary emergency CTA is solid/high contrast;
- countdown/timer text is stable and never dependent on a transparent image;
- status information has explicit labels and icons;
- rapid flashing is prohibited;
- animation never delays escalation/cancellation;
- color is never the sole emergency signal.

## Required validation modes

Test normal appearance, high contrast, reduced motion, reduced transparency where supported, keyboard-only navigation, screen reader navigation, narrow widths, large text/zoom, scrolling beneath fixed functional surfaces, and the emergency state.

## Fail the glass treatment when

- important text loses contrast;
- focus is difficult to locate;
- target sizes shrink;
- screen-reader meaning changes;
- semantic state is only color/transparency;
- reduced-motion users receive unnecessary movement;
- emergency content becomes less scannable than the solid baseline.
