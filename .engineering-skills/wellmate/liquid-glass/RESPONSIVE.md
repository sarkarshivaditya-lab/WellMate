# WellMate Liquid Glass Responsive System

## Mobile-first contract

WellMate is mobile-first and also runs through Capacitor. Mobile behavior is the reference; larger viewports expand spacing and functional planes without changing semantics.

## Narrow mobile: roughly 360–430px

- keep page titles readable;
- preserve 44px-class targets;
- prefer one persistent functional glass surface over multiple floating panes;
- prevent compressed labels;
- increase material opacity and reduce decoration as width decreases;
- keep sheets within the visual viewport;
- keep critical copy on stable backgrounds.

## Phone

- persistent BottomNav remains the main navigation plane;
- compact top search/profile surface remains functional, not decorative;
- content cards remain stable;
- horizontal scrolling is reserved for content that benefits from it.

## Landscape phone

- reduce decorative effects before reducing content/action space;
- keep primary actions visible;
- prevent tall floating surfaces from covering the core content;
- preserve safe-area handling.

## Tablet

Allow more horizontal structure and larger functional planes. Do not multiply glass surfaces merely because space is available.

## Desktop

Functional layers may become wider toolbars/rails where information architecture supports it. Preserve the same green material vocabulary and keyboard behavior. Do not invent a sidebar solely to show glass.

## Safe areas

Keep existing `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` contracts. Critical controls must not sit in clipped areas.

## Material density by viewport

| Viewport | Opacity | Blur | Decoration |
|---|---|---|---|
| narrow mobile | higher | low/moderate | minimal |
| phone | moderate-high | moderate | restrained |
| tablet | moderate | moderate | restrained |
| desktop | moderate | moderate-high for selected functional planes | spatial, not noisy |

## Breakpoint behavior

Change padding, columns, surface width and navigation geometry at breakpoints. Do not change semantic hierarchy.

## Responsive failure modes

Prevent:

- clipped glass text;
- sub-44px controls;
- inaccessible collapsed navigation;
- sheets extending past the visual viewport;
- fixed glass surfaces covering emergency actions;
- transparent content becoming harder to scan;
- overflow from decorative absolute-positioned elements.

## Review matrix

Inspect at 360×800, 390×844, 430×932, tablet portrait/landscape, 1366×768, 1440×900 and 1920×1080, plus landscape mobile and large-text/zoom.
