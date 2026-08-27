# WellMate Liquid Glass Research

Research is separated into official design guidance, implementation research, and WellMate-specific decisions.

## OFFICIAL DESIGN GUIDANCE

### Apple — Human Interface Guidelines: Materials

https://developer.apple.com/design/human-interface-guidelines/materials

Findings:

- Liquid Glass is a dynamic material used for functional controls/navigation such as tab bars and sidebars.
- Apple distinguishes Liquid Glass from standard materials used in the content layer.
- Apple explicitly advises against indiscriminate use of Liquid Glass in the content layer.
- Custom Liquid Glass should be used sparingly.
- The clear variant is intended for visually rich backgrounds.
- Legibility must remain intact under accessibility settings such as increased contrast/reduced transparency.

Applied to WellMate: functional layers first; stable content surfaces remain available.

### Apple — Liquid Glass overview

https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass

Findings:

- the system combines optical glass properties with fluidity;
- adopting Liquid Glass does not require an existing app to be rebuilt from scratch;
- hierarchy, harmony, adaptability, restrained color and predictable actions remain core principles.

Applied to WellMate: enhance existing architecture rather than replace it.

### Apple — Applying Liquid Glass to custom views

https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

Findings:

- custom Liquid Glass can blur background content, reflect surrounding color/light and respond to interaction;
- custom effects can vary shape and tint;
- Apple recommends limiting visible effects because too many effect containers can degrade performance.

Applied to WellMate: bound the number of glass containers and treat blur as a budget.

### Apple — Accessibility

https://developer.apple.com/design/human-interface-guidelines/accessibility

Findings:

- Apple recommends minimum contrast standards and stronger contrast variants for accessibility needs;
- visual subtlety must not reduce readability.

Applied to WellMate: contrast is measured on the composited material.

### W3C — WCAG 2.2

https://www.w3.org/TR/wcag/

Findings:

- focus visibility and contrast are explicit accessibility requirements;
- accessibility validation must not depend on the visual effect itself.

Applied to WellMate: glass is presentation, not semantics.

## IMPLEMENTATION RESEARCH

### rdev/liquid-glass-react

https://github.com/rdev/liquid-glass-react

Useful observations:

- React implementation explores refraction, edge behavior, frosty level and interaction effects;
- its README notes partial Safari/Firefox support for displacement/refraction behavior.

Caveat: third-party implementation, not Apple authority, and not a reason to add a dependency now.

### callstack/liquid-glass

https://github.com/callstack/liquid-glass

Useful observations:

- React Native implementation provides regular/clear modes, tinting and interaction;
- demonstrates platform-aware fallback patterns.

Caveat: it targets React Native/iOS rather than WellMate's React/Vite/Capacitor web stack.

### MDN — backdrop-filter

https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter

Useful observations:

- backdrop effects operate on the area behind a translucent/partially transparent element;
- modern browser support is broad, but older devices/browsers can differ.

### MDN — prefers-reduced-transparency

https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-transparency

Useful observations:

- the media feature can represent a user preference to minimize transparency;
- current support is limited/experimental, so it should not be the only accessibility fallback.

## WELLMATE-SPECIFIC DECISIONS

1. Use Liquid Glass primarily for functional layers.
2. Keep dashboards, metrics, charts, lists and sensitive profile content solid/near-opaque by default.
3. Preserve WellMate green as the brand anchor and reserve red for semantic emergency/destructive use.
4. Extend the existing token/motion/component systems rather than introducing a new design framework.
5. Treat CSS backdrop blur/refraction as progressive enhancement with opaque fallbacks.
6. Do not use per-row blur in long scrolling lists.
7. Preserve AppShell, BottomNav, PageLayout and Radix dialog/sheet boundaries.
8. Accessibility and emergency readability override aesthetic fidelity.

## Rejected approaches

- "every card is frosted glass";
- blue/purple generic AI aesthetic;
- replacement of the current UI primitive library;
- adding a runtime Liquid Glass dependency before implementation proves it necessary;
- continuous refraction/shine as the default interaction behavior.
