# WellMate Liquid Glass Design System

## Status

Normative design-engineering specification for the upcoming visual rebuild. Documentation only; no runtime changes are made by this skill package.

## Design intent

WellMate should feel calm, spatial, premium and unmistakably green. Liquid Glass is primarily a functional-layer material. Content remains stable, information-dense and readable.

## Token integration rule

Implement future tokens in `src/design/tokens.ts` and/or the existing CSS variable layer in `src/index.css`. Do not create a second competing token registry.

## Color tokens

| Token | Role | Starting direction |
|---|---|---|
| `wm-green-900` | strongest branded text/action | deep existing WellMate green |
| `wm-green-700` | primary brand action | current `--primary` family |
| `wm-green-500` | selected/highlight tint | muted mid green |
| `wm-green-200` | soft material wash | pale green |
| `wm-green-50` | lightest wash | near-surface green-gray |
| `wm-neutral-950` | strongest text | current foreground family |
| `wm-neutral-600` | supporting text | current muted-foreground family |
| `wm-white` | low-alpha edge highlight | white only as optical highlight |
| `wm-emergency-600` | emergency/destructive | current red/destructive family |
| `wm-warning-600` | caution | current amber family |

These conceptual names must resolve through the existing semantic palette rather than hardcoded replacement colors.

## Glass surfaces

| Token | Target background alpha | Blur target | Intended use |
|---|---:|---:|---|
| `glass-primary` | ~0.70–0.84 | 14–22px | persistent functional surfaces |
| `glass-secondary` | ~0.58–0.76 | 10–18px | secondary controls |
| `glass-elevated` | ~0.78–0.92 | 14–24px | transient surfaces |
| `glass-subtle` | ~0.45–0.64 | 6–12px | small affordances over rich backdrops |
| `glass-solid` | 1.00 | 0 | fallback, emergency, dense content |

These are implementation starting ranges, not hard visual requirements. Tune from actual compositing and contrast results.

## Tint

- `glass-tint-brand`: restrained WellMate green for selected/prominent controls.
- `glass-tint-neutral`: neutral green-gray for default functional glass.
- `glass-tint-warning`: warning-only.
- `glass-tint-emergency`: avoid translucent treatment; prefer solid critical surface.

Tint does not replace semantic state.

## Borders

| Token | Purpose |
|---|---|
| `glass-border-rest` | subtle material edge |
| `glass-border-active` | hover/selected edge |
| `glass-border-focus` | keyboard focus |
| `glass-border-critical` | critical/emergency separation; normally paired with solid fill |

## Highlights

- `glass-highlight-top`: faint leading/top edge.
- `glass-highlight-inner`: restrained inner light for elevated functional materials.
- `glass-specular`: brief interaction highlight only; not a perpetual shine.

## Shadows

- `glass-shadow-subtle`: compact floating control.
- `glass-shadow-standard`: primary functional surface.
- `glass-shadow-elevated`: sheet/popover/dialog.
- `glass-shadow-critical`: separation without decorative glow.

Use low-chroma shadows, subtly green-biased only where the current WellMate palette already supports it.

## Radius

| Token | Target | Use |
|---|---:|---|
| `radius-control` | 12–14px | buttons, inputs, chips |
| `radius-card` | 18–20px | major surfaces |
| `radius-sheet` | 22–24px | sheets/dialogs |
| `radius-pill` | 9999px | pill semantics |
| `radius-circle` | 50% | circular controls |

## Spacing

Prefer the existing `spacing` registry. Conceptual glass insets:

- `glass-inset-xs`: 8px
- `glass-inset-sm`: 12px
- `glass-inset-md`: 16px
- `glass-inset-lg`: 20px
- `glass-gap-sm`: 8px
- `glass-gap-md`: 12px
- `glass-gap-lg`: 16px
- `glass-section-gap`: 24px

## Typography

Reuse existing roles:

- pageTitle
- sectionLabel
- cardTitle
- metricLarge / metricMedium
- bodyDefault / bodySmall

For glass overlays, hierarchy comes from type scale/weight/spacing—not translucent text.

## Motion

Reuse existing motion tokens:

| Token | Glass use |
|---|---|
| instant | critical state changes |
| quick | press/hover acknowledgment |
| standard | regular control state change |
| calm | sheets/panels |
| ambient | rare reveal |
| breathe | loading only |

## Layers

Keep current z-index contracts and formalize semantics:

| Layer | Meaning |
|---:|---|
| 0 | background |
| 10 | content |
| 20 | functional shell |
| 30 | persistent navigation |
| 40 | floating transient |
| 50 | modal overlay/surface |
| 60 | emergency-critical interruption, only where required |

Do not use z-index escalation as a generic stacking fix.

## Surface recipe

A functional glass surface is conceptually:

`translucent fill + bounded backdrop effect + single edge + optional highlight + elevation shadow`

It does not automatically include mesh gradients, animated shine, chromatic aberration or large glow.

## State matrix

| State | Material | Primary treatment | Motion |
|---|---|---|---|
| default | named glass | normal contrast | none/minimal |
| hover | same | small highlight | quick |
| focus | same | strong focus edge/ring | none |
| pressed | same | denser/darker fill | quick |
| selected | brand tinted | strong contrast | standard |
| disabled | more opaque | readable subdued | none |
| emergency | solid critical | strongest contrast | instant |

## Emergency treatment

Emergency UI is allowed to be spatial, but the critical control itself should be solid and high contrast. Keep timer, status, location and instructions on stable surfaces. Never use red ambient glow as the meaning of "emergency."

## Fallback ladder

1. Full glass.
2. Reduced/low-blur glass.
3. Translucent solid surface.
4. Opaque semantic surface.
5. High-contrast emergency/accessibility variant.
