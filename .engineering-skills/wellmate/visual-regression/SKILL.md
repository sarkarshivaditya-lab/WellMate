---
name: wellmate-visual-regression
description: Validate WellMate visual changes through controlled baselines, repeatable rendering, comparison, accessibility checks and targeted repair.
---

# WellMate Visual Regression

This skill prevents the Liquid Glass rebuild from becoming an uncontrolled visual rewrite. Visual work must be intentional, measurable and reversible.

## Required loop

```
inspect current UI
↓
establish baseline
↓
make controlled visual change
↓
render
↓
compare against baseline
↓
identify regression
↓
repair
↓
render again
↓
repeat until stable
```

## Inspect current UI

Record the route/component, viewport, layout structure, content density, existing design tokens, fixed/sticky layers, interactive states and any known intentional behavior.

Start with the smallest representative baseline set rather than capturing the entire application at once.

## Establish baseline

Capture representative states for:

- overview/dashboard
- physical dashboard
- mental overview
- habits
- profile/settings
- one dialog or sheet
- emergency-critical state when present

At minimum use 360×800, 390×844, 430×932, tablet portrait/landscape, and 1366×768/1440×900 desktop widths. Include supported appearance and accessibility modes.

## Make one controlled visual change

Prefer one design concern per iteration:

- material hierarchy
- navigation treatment
- typography
- spacing
- radii
- borders/highlights
- shadows/depth
- motion
- responsive behavior

Do not combine unrelated layout rewrites with material changes.

## Render

Use the repository's supported browser/test tooling when available.

Inspect:

- initial and populated states
- scrolling
- hover/focus/pressed states
- dialogs/sheets
- loading/error states
- reduced-motion behavior
- reduced-transparency/high-contrast variants

## Compare

Check for regressions in:

- layout geometry
- spacing
- typography/wrapping
- component dimensions
- contrast
- borders and highlights
- shadows
- translucency/blur
- clipping and overflow
- z-index/layering
- fixed/sticky positioning
- safe-area behavior
- animation start/end state
- interaction affordances

Do not use "looks nicer" as the acceptance criterion. Ask whether the intended change occurred without harming function or hierarchy.

## Repair

Fix the smallest root cause.

Examples:

- wrapping drift → repair container sizing/type metrics, not global scaling;
- glass disappears behind scroll → inspect stacking/containment before increasing z-index;
- focus is hidden → repair the focus layer;
- sheet clips → repair visual-viewport/safe-area behavior;
- list performance degrades → remove per-item backdrop filters first.

After repair, render the same baseline set again.

## Accessibility checks

Every visual iteration must include:

- focus-visible
- keyboard order
- target size
- contrast
- high contrast where supported
- reduced motion
- reduced transparency where supported
- large text/zoom
- screen-reader-visible labels and semantics

## Emergency checks

For every emergency-related visual change verify:

- emergency red remains semantic;
- primary emergency CTA remains solid and high contrast;
- timer/state/instructions remain instantly readable;
- cancel/escalate controls remain distinct;
- no animation delays or blocks action;
- touch and keyboard access remain available.

## Performance checks

For Liquid Glass changes verify:

- visible glass-container count is reasonable;
- no per-row blur has been introduced;
- nested filters are avoided;
- blur/shadow are not continuously animated;
- scrolling remains smooth;
- mobile-class devices are considered;
- opaque fallbacks remain available.

## Comparison rules

- Ignore anti-aliasing noise unless it represents a real layout or contrast shift.
- Treat cumulative spacing drift, changed wrapping, clipping, lost focus rings, changed target sizes and contrast loss as regressions.
- Document intentional differences in the implementation change.
- Keep one stable baseline per meaningful milestone so rollback is straightforward.

## Completion gate

A visual iteration is stable only when:

1. intended hierarchy is present;
2. layout and wrapping are stable;
3. contrast is verified;
4. interaction states work;
5. responsive behavior is verified;
6. motion and reduced-motion behavior are verified;
7. emergency UI is verified when applicable;
8. no obvious performance red flag was introduced;
9. the diff remains inside the intended scope.