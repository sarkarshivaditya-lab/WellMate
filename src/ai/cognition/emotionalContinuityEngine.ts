// Emotional Continuity Engine — longitudinal tracker for user emotional state.
//
// IMPORTANT: This tracks USER emotional state, NOT AI emotion simulation.
// There is no AI sentiment here. This is a behavioral signal aggregator.
//
// Dimensions:
//   stress                  — how stressed the user appears across sessions
//   motivation              — intrinsic drive toward wellness goals
//   frustration             — friction / repeated failures / expressed annoyance
//   burnout                 — compound fatigue from sustained overload
//   encouragement_effectiveness — how well positive reinforcement lands
//
// Implementation:
//   - EMA (exponential moving average) smoothing per dimension
//   - Hysteresis: prevents micro-oscillations from causing noise
//   - Decay toward neutral (0.5) when no evidence (5-day half-life)
//   - Uncertainty tracking: low evidence = high uncertainty
//   - Shift detection: >0.2 change in 24h triggers an event

import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmotionalDimension =
  | "stress"
  | "motivation"
  | "frustration"
  | "burnout"
  | "encouragement_effectiveness";

export type EmotionalDimensionValue = {
  dimension: EmotionalDimension;
  value: number;              // 0-1 (higher = more of this dimension)
  trend: "rising" | "stable" | "falling";
  confidence: number;         // 0-1 (based on evidence count)
  lastUpdatedAt: number;
  evidenceCount: number;
  uncertainty: number;        // 0-1 (inverse of confidence after decay)
  lastShiftAt: number | null;
};

export type EmotionalProfile = {
  dimensions: Record<EmotionalDimension, EmotionalDimensionValue>;
  dominantDimension: EmotionalDimension | null;
  overallValence: number;       // -1 to +1
  lastUpdatedAt: number;
};

export type EmotionalContinuityReport = {
  profile: EmotionalProfile;
  hasActiveShift: boolean;
  dominantConcern: EmotionalDimension | null;
  overallValence: number;
  lowMomentumDimensions: EmotionalDimension[];
  lastUpdatedAt: number | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_emotional_continuity_v1";
const EMA_ALPHA = 0.25;                        // smoothing factor
const HYSTERESIS_THRESHOLD = 0.05;             // ignore changes smaller than this
const SHIFT_DETECTION_THRESHOLD = 0.2;         // shift triggers an event
const DECAY_HALF_LIFE_MS = 5 * 24 * 60 * 60 * 1000;  // decay toward 0.5 over 5 days
const NEUTRAL = 0.5;

const ALL_DIMENSIONS: EmotionalDimension[] = [
  "stress", "motivation", "frustration", "burnout", "encouragement_effectiveness",
];

// ── Default state ──────────────────────────────────────────────────────────────

function defaultDimension(dimension: EmotionalDimension): EmotionalDimensionValue {
  return {
    dimension,
    value: NEUTRAL,
    trend: "stable",
    confidence: 0.1,
    lastUpdatedAt: Date.now(),
    evidenceCount: 0,
    uncertainty: 0.9,
    lastShiftAt: null,
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

function loadState(): Record<EmotionalDimension, EmotionalDimensionValue> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object") return stored as Record<EmotionalDimension, EmotionalDimensionValue>;
  } catch { /* corrupt */ }

  const fresh: Partial<Record<EmotionalDimension, EmotionalDimensionValue>> = {};
  for (const dim of ALL_DIMENSIONS) fresh[dim] = defaultDimension(dim);
  return fresh as Record<EmotionalDimension, EmotionalDimensionValue>;
}

function saveState(state: Record<EmotionalDimension, EmotionalDimensionValue>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage full */ }
}

// ── Decay ─────────────────────────────────────────────────────────────────────

function applyDecay(dim: EmotionalDimensionValue): EmotionalDimensionValue {
  const ageMs = Date.now() - dim.lastUpdatedAt;
  if (ageMs < 60_000) return dim;  // no decay for < 1 minute

  const decayFactor = Math.exp(-Math.log(2) * ageMs / DECAY_HALF_LIFE_MS);
  const decayed = NEUTRAL + (dim.value - NEUTRAL) * decayFactor;
  const newUncertainty = Math.min(0.99, dim.uncertainty + (1 - decayFactor) * 0.3);

  return { ...dim, value: decayed, uncertainty: newUncertainty };
}

// ── Update ────────────────────────────────────────────────────────────────────

export function recordEmotionalSignal(
  dimension: EmotionalDimension,
  rawValue: number,               // 0-1
  confidence: number,             // 0-1
): void {
  const state = loadState();
  const dim = applyDecay(state[dimension]);

  const clampedValue = Math.max(0, Math.min(1, rawValue));
  const previous = dim.value;

  // EMA smoothing
  const newValue = dim.value * (1 - EMA_ALPHA) + clampedValue * EMA_ALPHA;

  // Hysteresis: ignore small movements
  if (Math.abs(newValue - previous) < HYSTERESIS_THRESHOLD) {
    state[dimension] = { ...dim, lastUpdatedAt: Date.now() };
    saveState(state);
    return;
  }

  // Trend determination
  const trend: EmotionalDimensionValue["trend"] =
    newValue > previous + 0.05 ? "rising" :
    newValue < previous - 0.05 ? "falling" : "stable";

  // Confidence update (EMA of evidence)
  const newConfidence = Math.min(0.95, dim.confidence * 0.85 + confidence * 0.15);
  const newEvidenceCount = dim.evidenceCount + 1;
  const newUncertainty = Math.max(0.05, 1 - newConfidence);

  // Shift detection
  let lastShiftAt = dim.lastShiftAt;
  const shiftMagnitude = Math.abs(newValue - previous);
  if (shiftMagnitude >= SHIFT_DETECTION_THRESHOLD) {
    lastShiftAt = Date.now();
    emitCognitionEvent("emotional_shift", {
      dimension,
      from: previous,
      to: newValue,
      magnitude: shiftMagnitude,
    });
  }

  state[dimension] = {
    dimension,
    value: newValue,
    trend,
    confidence: newConfidence,
    lastUpdatedAt: Date.now(),
    evidenceCount: newEvidenceCount,
    uncertainty: newUncertainty,
    lastShiftAt,
  };

  saveState(state);
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getEmotionalProfile(): EmotionalProfile {
  const rawState = loadState();
  const dimensions: Record<EmotionalDimension, EmotionalDimensionValue> = {} as Record<EmotionalDimension, EmotionalDimensionValue>;

  for (const dim of ALL_DIMENSIONS) {
    dimensions[dim] = applyDecay(rawState[dim]);
  }

  // Dominant dimension (highest value with sufficient confidence)
  const confident = ALL_DIMENSIONS.filter((d) => dimensions[d].confidence > 0.3);
  const dominant = confident.length > 0
    ? confident.reduce((max, d) => dimensions[d].value > dimensions[max].value ? d : max)
    : null;

  // Overall valence: motivation and encouragement_effectiveness push positive,
  // stress/burnout/frustration push negative
  const valence =
    (dimensions.motivation.value * 0.4 + dimensions.encouragement_effectiveness.value * 0.2) -
    (dimensions.stress.value * 0.25 + dimensions.burnout.value * 0.25 + dimensions.frustration.value * 0.15);

  return {
    dimensions,
    dominantDimension: dominant,
    overallValence: Math.max(-1, Math.min(1, (valence - 0.5) * 2)),
    lastUpdatedAt: Math.max(...ALL_DIMENSIONS.map((d) => dimensions[d].lastUpdatedAt)),
  };
}

export function detectEmotionalShift(): boolean {
  const state = loadState();
  const recentShiftWindow = 24 * 60 * 60 * 1000;  // 24 hours
  return ALL_DIMENSIONS.some(
    (d) => state[d].lastShiftAt !== null && Date.now() - (state[d].lastShiftAt ?? 0) < recentShiftWindow,
  );
}

export function getEmotionalContinuityReport(): EmotionalContinuityReport {
  const profile = getEmotionalProfile();
  const { dimensions } = profile;

  const lowMomentum = ALL_DIMENSIONS.filter(
    (d) => dimensions[d].value < 0.3 && dimensions[d].confidence > 0.3,
  );

  const dominantConcern = ["stress", "burnout", "frustration"].reduce<EmotionalDimension | null>(
    (max, d) => {
      const dim = d as EmotionalDimension;
      if (!max) return dim;
      return dimensions[dim].value > dimensions[max].value ? dim : max;
    },
    null,
  );

  return {
    profile,
    hasActiveShift: detectEmotionalShift(),
    dominantConcern,
    overallValence: profile.overallValence,
    lowMomentumDimensions: lowMomentum,
    lastUpdatedAt: profile.lastUpdatedAt,
  };
}

export function resetEmotionalContinuity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ok */ }
}
