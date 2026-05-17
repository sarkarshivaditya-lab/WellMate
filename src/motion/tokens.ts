// Motion token system — single source of truth for all animation timing in WellMate.
// Every duration, easing, and stagger value in the codebase derives from here.
//
// Philosophy: motion communicates state — not excitement.
// Calm, breathable, intentional.

// ─── Duration ────────────────────────────────────────────────────────────────

export const duration = {
  instant:  0,     // No animation — immediate state (errors, critical updates)
  quick:    100,   // Hover enter, micro acknowledgment
  standard: 200,   // PRIMARY — all interactive elements (.transition-premium baseline)
  calm:     300,   // Deliberate transitions, progress fill
  ambient:  500,   // Content reveals, onboarding stagger tail
  breathe:  1600,  // Passive loading (skeleton shimmer) — slow enough to feel stable
  blink:    1000,  // Precise periodic signals (OTP caret)
} as const satisfies Record<string, number>;

export type DurationToken = keyof typeof duration;

// CSS millisecond strings — for inline style={{ transitionDuration }} objects
export const ms: Record<DurationToken, string> = {
  instant:  '0ms',
  quick:    '100ms',
  standard: '200ms',
  calm:     '300ms',
  ambient:  '500ms',
  breathe:  '1600ms',
  blink:    '1000ms',
} as const;

// ─── Easing ──────────────────────────────────────────────────────────────────

export const easing = {
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)', // PRIMARY — fast start, soft landing (iOS-caliber)
  smooth: 'ease-out',                        // Exits and dismissals (decelerating)
  gentle: 'ease-in-out',                     // Ambient loops, continuous motion
  linear: 'linear',                          // Structural/mechanical (sidebar width)
} as const satisfies Record<string, string>;

export type EasingToken = keyof typeof easing;

// ─── Stagger ─────────────────────────────────────────────────────────────────

// Entrance sequences for lists and onboarding flows.
// Usage: delay(ms) = stagger.base + index * stagger.interval
export const stagger = {
  base:     250, // First item delay (ms)
  interval: 150, // Step between subsequent items (ms)
} as const;

// Compute stagger delay for a given index
export function staggerDelay(index: number): number {
  return stagger.base + index * stagger.interval;
}

// ─── Transition property sets ─────────────────────────────────────────────────

// Scoped property targeting — avoids over-transitioning unrelated properties
export const properties = {
  interactive: 'opacity, transform, width, box-shadow, background-color, color, border-color',
  visual:      'opacity, background-color, color, border-color',
  layout:      'width, height, transform',
  shadow:      'box-shadow',
  opacity:     'opacity',
} as const;

export type PropertyToken = keyof typeof properties;
