// WellMate Motion System
//
// Single import path for all motion infrastructure.
//
// Usage:
//   import { duration, easing, motion, haptics } from '@/motion';
//   import { useReducedMotion } from '@/hooks/useReducedMotion';
//
// Architecture:
//   tokens.ts   → raw values (durations, easings, stagger math, property sets)
//   presets.ts  → reusable Tailwind class-string combinations + layer semantics
//   haptics.ts  → Web Vibration API wrappers with semantic intent names
//   MOTION.md   → full interaction language documentation
//
// AI surface rule:
//   All future AI overlay surfaces inherit this motion system.
//   Never introduce AI-specific timing or easing outside these tokens.
//   The calm pacing here IS the WellMate interaction voice.

export * from './tokens';
export * from './presets';
export * from './haptics';
