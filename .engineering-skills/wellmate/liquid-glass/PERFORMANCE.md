# WellMate Liquid Glass Performance

## Objective

Use spatial depth without turning the application into a continuous filter pipeline. Mobile scroll performance and battery behavior take precedence over visual fidelity.

## Backdrop-filter budget

`backdrop-filter` affects the content behind translucent surfaces.

Rules:

- use on a small number of functional containers;
- never per-row in long lists;
- avoid nested filtered descendants;
- keep filtered bounds as small as practical;
- raise opacity/reduce blur as density rises;
- preserve a solid fallback.

## Scrolling and data surfaces

For habits, journal, meals, timelines, search results and other potentially long lists:

- use solid or near-opaque rows;
- keep shadows shallow;
- avoid animated gradients/filter stacks per item;
- prefer one functional glass toolbar/parent over many blurred children.

## Compositing and animation

Prefer transform/opacity for animation.

Be cautious with:

- `filter` / `backdrop-filter`;
- large blur radii;
- animated box-shadow;
- animated background gradients;
- large fixed translucent surfaces over scrolling content.

Do not add `will-change` broadly; use it only after measurement.

## Media and backgrounds

Prefer CSS gradients or optimized static imagery. Lazy-load non-critical media. Never make a functional control depend on a video background.

## Mobile validation

Test extended scrolling, navigation, sheets/dialogs, large lists, low-power/thermally constrained devices, and representative mobile-class hardware.

## Progressive enhancement

Fallback sequence:

1. full glass;
2. reduced/low-blur glass;
3. translucent solid surface;
4. opaque semantic surface.

The fallback must never look like a broken component.

## Engineering review thresholds

These are practical budgets, not browser specifications:

- approximately six blurred containers maximum in a typical mobile viewport;
- zero per-item blur in long/virtualized lists;
- no continuous blur animation;
- no full-screen blur without a product-critical, measured reason;
- no new dependency solely for glass before CSS/Web APIs and existing Motion are evaluated.

## Review checklist

Count visible glass surfaces, find all backdrop filters, detect nested filters, inspect long-list behavior, test fixed-surface scrolling, test dialogs/sheets with live content underneath, and test mobile performance.
