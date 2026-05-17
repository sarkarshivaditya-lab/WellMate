// Motion presets — reusable Tailwind class-string combinations.
// Use these instead of scattering raw duration/easing strings across components.
//
// All classes reference either:
//   - .transition-premium  (defined in index.css — the platform standard)
//   - .animate-wm-*        (defined in index.css — named entrance/ambient sequences)
//   - Tailwind utilities   (skeleton-shimmer, animate-spin, etc.)

export const motion = {
  // ─── Core interaction ──────────────────────────────────────────────────────
  // Apply to any tappable or hoverable element
  interactive: 'transition-premium',

  // ─── Entrance animations ───────────────────────────────────────────────────
  // Named keyframe sequences — always apply with `both` fill (built into the class)
  enter: {
    route:    'animate-wm-route-in',  // Full-page fade (0.22s) — route changes
    tab:      'animate-wm-tab-in',    // Tab panel rise (0.18s) — tab switches
    icon:     'animate-wm-icon-in',   // Scale-in bounce (0.65s) — completion badges
    content1: 'animate-wm-fade-1',   // Staggered slot 1 (0.5s, 0.25s delay)
    content2: 'animate-wm-fade-2',   // Staggered slot 2 (0.5s, 0.40s delay)
    content3: 'animate-wm-fade-3',   // Staggered slot 3 (0.5s, 0.55s delay)
    content4: 'animate-wm-fade-4',   // Staggered slot 4 (0.5s, 0.70s delay)
  },

  // ─── Ambient motion ────────────────────────────────────────────────────────
  // Passive loops — must not compete with content for attention
  ambient: {
    float:    'animate-wm-float',      // Vertical oscillation (6s) — decorative elements
    floatAlt: 'animate-wm-float-alt', // Phase-offset float (7.5s) — secondary elements
    glow:     'animate-wm-glow',       // Opacity/scale pulse (3.5s) — soft highlights
  },

  // ─── Loading states ────────────────────────────────────────────────────────
  loading: {
    skeleton: 'skeleton-shimmer', // Gradient sweep (1.6s) — placeholder content
    spin:     'animate-spin',     // Continuous rotation — network activity indicators
  },

  // ─── Press + hover feedback ────────────────────────────────────────────────
  press: {
    standard: 'active:scale-[0.97]',                      // Button/card tap compression
    card:     'hover:-translate-y-0.5 hover:card-shadow-hover', // Card lift on hover
  },
} as const;

// ─── Layer semantics ──────────────────────────────────────────────────────────
// Describes the motion "weight" of different UI layers.
// Heavier layers move slower and more deliberately.

export const layer = {
  // Micro — sub-100ms, invisible-fast (hover dots, icon swaps)
  micro: { duration: '100ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  // Component — 200ms, the platform standard (buttons, cards, inputs)
  component: { duration: '200ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  // Container — 300ms, deliberate (progress, accordion, panels)
  container: { duration: '300ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  // Screen — 220ms pure fade, no Y movement (full page transitions)
  screen: { duration: '220ms', easing: 'ease-out' },
  // Overlay — 200ms slide+fade (modals, sheets, drawers)
  overlay: { duration: '200ms', easing: 'ease-out' },
  // Ambient — 3.5s–7.5s loops (passive decorative, never urgent)
  ambient: { duration: '6000ms', easing: 'ease-in-out' },
} as const;

export type LayerToken = keyof typeof layer;
