// src/design/tokens.ts
// WellMate canonical design token registry.
//
// Single source of truth for:
//   - Typography role strings
//   - Spacing constants
//   - Surface class strings
//   - Module semantic color registry
//   - Wellness signal colors
//
// Philosophy: extract patterns that already exist in the codebase.
// Never invent. Never redesign. Systematize what works.

// ─── Typography roles ─────────────────────────────────────────────────────────
// Every text role in the app, named by PURPOSE not by size.
// Consuming components: import { typography } from "@/design/tokens"

export const typography = {
  // Page-level labels
  pageTitle:    "text-[22px] font-semibold leading-tight tracking-tight",
  pageSubtitle: "text-[13px] text-muted-foreground leading-snug",

  // Section headers — ALL-CAPS category labels above content groups
  sectionLabel: "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground",

  // Card-level headings
  cardTitle:    "text-base font-semibold tracking-tight",
  cardSubtitle: "text-sm text-muted-foreground",

  // Insight / intelligence surface headings
  insightTitle: "text-sm font-semibold leading-tight",
  insightBody:  "text-[11px] text-muted-foreground leading-snug",

  // Metric / numeric display
  metricLarge:  "text-3xl font-bold tabular-nums",
  metricMedium: "text-xl font-semibold tabular-nums",
  metricSmall:  "text-sm font-semibold tabular-nums",

  // Micro labels — field names, column headers, signal labels
  microLabel:   "text-[10px] font-medium uppercase tracking-wide text-muted-foreground",

  // Body text
  bodyDefault:  "text-sm leading-relaxed",
  bodySmall:    "text-xs text-muted-foreground",
  bodyTiny:     "text-[11px] text-muted-foreground leading-relaxed",

  // Timeline / list item copy
  listPrimary:   "text-sm font-medium leading-tight",
  listSecondary: "text-[11px] text-muted-foreground",

  // Timestamp / relative time
  timestamp:    "text-[10px] text-muted-foreground",
} as const satisfies Record<string, string>;

export type TypographyRole = keyof typeof typography;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Named spacing values for consistent rhythm.
// Maps to Tailwind spacing scale directly.

export const spacing = {
  // Card internal padding
  cardInner:   "px-4 py-4",      // intelligence cards, compact cards
  cardInnerLg: "px-5 py-5",      // standard Card (CardContent uses px-6)
  cardInnerSm: "px-3 py-2.5",    // list row items, inline cells

  // Section vertical gaps
  sectionGap:     "space-y-8",   // top-level page sections
  contentGap:     "space-y-6",   // content groups within a page
  listGap:        "space-y-3",   // list items
  tightGap:       "space-y-2",   // dense lists, signal grids
  inlineGap:      "space-y-1.5", // form field sub-items

  // Grid
  signalGrid:  "grid grid-cols-2 gap-2",  // score card signal chips
  statGrid3:   "grid grid-cols-3 gap-4",  // 3-col metric rows
  domainGrid4: "grid grid-cols-4 gap-2",  // wellness domain pills
} as const satisfies Record<string, string>;

export type SpacingToken = keyof typeof spacing;

// ─── Surface hierarchy ────────────────────────────────────────────────────────
// Four named surface levels. Use these instead of inline class strings.
//
//  ambient   — the lightest touch; list rows, inset cells
//  standard  — the default Card (bg-card, ring shadow, hover lift)
//  elevated  — intelligence/insight surfaces (translucent, backdrop-blur)
//  overlay   — modals, sheets, floating panels

export const surface = {
  // Ambient — lightest row treatment; use for list items inside a Card
  ambient:
    "rounded-xl bg-muted/40 border border-border/20",

  // Semi-ambient — slightly more distinct; timeline items, relation cards
  semiAmbient:
    "rounded-xl bg-card/60 border border-border/30",

  // Elevated — intelligence / insight card surface (primary for new AI surfaces)
  elevated: [
    "rounded-2xl border border-border/40",
    "bg-card/80 backdrop-blur-sm",
    "shadow-[0_1px_3px_rgba(20,60,50,0.05),_0_4px_16px_rgba(20,60,50,0.08)]",
  ].join(" "),

  // Standard — matches the <Card> component (opaque, ring shadow, hover lift)
  // Use <Card> directly; this string is for reference only
  standard:
    "rounded-2xl bg-card ring-1 ring-black/[0.05] card-shadow-rest",

  // Overlay — for floating panels, not modals (modals use shadcn/Dialog)
  overlay: [
    "rounded-2xl border border-border bg-card",
    "shadow-[0_4px_16px_rgba(20,60,50,0.10),_0_1px_4px_rgba(20,60,50,0.06)]",
  ].join(" "),
} as const satisfies Record<string, string>;

export type SurfaceLevel = keyof typeof surface;

// ─── Module color registry ────────────────────────────────────────────────────
// Single source of truth for wellness domain colors.
// Used in: ActivityTimeline, QuickAdd entity tabs, search results, future AI surfaces.
//
// Domain mapping:
//   meal      → amber   (nourishment, warmth)
//   exercise  → blue    (energy, activity)
//   sleep     → indigo  (rest, depth)
//   mood      → emerald (emotional ground, nature)
//   journal   → violet  (reflection, thought)
//   habit     → rose    (consistency, care)
//   nutrition → amber   (alias for meal context)
//   recovery  → sky     (restoration)

export const moduleColors = {
  meal: {
    text:   "text-amber-600 dark:text-amber-400",
    bg:     "bg-amber-500/10",
    border: "border-amber-500/20",
    signal: "bg-amber-500/8 border border-amber-500/15",
  },
  exercise: {
    text:   "text-blue-600 dark:text-blue-400",
    bg:     "bg-blue-500/10",
    border: "border-blue-500/20",
    signal: "bg-blue-500/8 border border-blue-500/15",
  },
  sleep: {
    text:   "text-indigo-600 dark:text-indigo-400",
    bg:     "bg-indigo-500/10",
    border: "border-indigo-500/20",
    signal: "bg-indigo-500/8 border border-indigo-500/15",
  },
  mood: {
    text:   "text-emerald-600 dark:text-emerald-400",
    bg:     "bg-emerald-500/10",
    border: "border-emerald-500/20",
    signal: "bg-emerald-500/8 border border-emerald-500/15",
  },
  journal: {
    text:   "text-violet-600 dark:text-violet-400",
    bg:     "bg-violet-500/10",
    border: "border-violet-500/20",
    signal: "bg-violet-500/8 border border-violet-500/15",
  },
  habit: {
    text:   "text-rose-600 dark:text-rose-400",
    bg:     "bg-rose-500/10",
    border: "border-rose-500/20",
    signal: "bg-rose-500/8 border border-rose-500/15",
  },
  navigation: {
    text:   "text-muted-foreground",
    bg:     "bg-muted",
    border: "border-border",
    signal: "bg-muted border border-border/30",
  },
  action: {
    text:   "text-muted-foreground",
    bg:     "bg-muted",
    border: "border-border",
    signal: "bg-muted border border-border/30",
  },
} as const;

export type WellnessModule = keyof typeof moduleColors;

// ─── Wellness signal colors ───────────────────────────────────────────────────
// Positive/negative/neutral signal semantics.
// Used in score card signal chips, trend icons, recovery indicators.

export const signalColors = {
  positive: {
    surface: "bg-emerald-500/8 border border-emerald-500/15",
    text:    "text-emerald-700 dark:text-emerald-300",
    icon:    "text-emerald-500",
  },
  caution: {
    surface: "bg-amber-500/8 border border-amber-500/15",
    text:    "text-amber-700 dark:text-amber-300",
    icon:    "text-amber-500",
  },
  neutral: {
    surface: "bg-muted/40 border border-border/20",
    text:    "text-muted-foreground",
    icon:    "text-muted-foreground/60",
  },
} as const;

export type SignalPolarity = keyof typeof signalColors;

// ─── Score level colors ───────────────────────────────────────────────────────
// Maps ScoreLevel from intelligence/types.ts to display colors.
// ScoreRing.tsx uses its own inline version; this is the shared form.

export const scoreLevelColors = {
  high: {
    text:   "text-emerald-600 dark:text-emerald-400",
    stroke: "stroke-emerald-500 dark:stroke-emerald-400",
    bg:     "bg-emerald-500/10",
  },
  medium: {
    text:   "text-amber-600 dark:text-amber-400",
    stroke: "stroke-amber-500 dark:stroke-amber-400",
    bg:     "bg-amber-500/10",
  },
  low: {
    text:   "text-muted-foreground",
    stroke: "stroke-muted-foreground/60",
    bg:     "bg-muted/40",
  },
} as const;

export type ScoreLevelToken = keyof typeof scoreLevelColors;

// ─── Press scale semantics ────────────────────────────────────────────────────
// Standardized active press scales for different touch targets.

export const pressScale = {
  button:    "active:scale-[0.97]",  // buttons, CTAs
  card:      "active:scale-[0.98]",  // cards, list items
  fab:       "active:scale-[0.95]",  // FABs, floating buttons
  pill:      "active:scale-[0.97]",  // pill tabs, filter chips
} as const;
