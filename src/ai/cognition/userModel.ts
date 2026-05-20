// User Model — evolving probabilistic model of the user's behavioral patterns.
//
// This is NOT profile storage (onboarding data lives in useLocalProfile).
// This is the AI's learned understanding of WHO the user is from observed behavior.
//
// Each dimension has: value, confidence, trend, evidenceCount, lastUpdated.
// Updating: Bayesian-flavored EMA — confidence rises with consistent evidence,
//   falls with contradictions or staleness.
//
// The AI should gradually become better calibrated, not creepily omniscient.
// Dimensions with confidence < 0.4 are flagged as uncertain.
// Dimensions unseen for > 30 days decay toward the prior (0.5 neutral).

import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type UserModelDimension =
  | "motivation_level"      // 0=demotivated, 1=highly motivated
  | "adherence_trend"       // 0=declining, 1=consistent
  | "emotional_tendency"    // 0=anxious, 1=optimistic
  | "recovery_pattern"      // 0=slow recovery, 1=quick recovery
  | "energy_rhythm"         // 0=evening person, 1=morning person
  | "stress_level"          // 0=low stress, 1=high stress
  | "burnout_risk"          // 0=low risk, 1=critical risk
  | "habit_resilience"      // 0=fragile, 1=strong
  | "engagement_depth"      // 0=surface, 1=deep engagement
  | "coaching_preference";  // 0=direct, 1=encouraging

export type DimensionValue = {
  dimension: UserModelDimension;
  value: number;             // 0-1 normalized
  confidence: number;        // 0-1
  trend: "improving" | "stable" | "declining" | "unknown";
  evidenceCount: number;
  lastUpdatedAt: number;
  contradictions: number;    // how often evidence contradicted this dimension
};

export type UserEvidence = {
  dimension: UserModelDimension;
  observation: string;       // e.g., "completed_habit" | "missed_habit_3x" | "mood_positive"
  value: number;             // 0-1 normalized evidence value
  weight: number;            // 0-1 how reliable this evidence is
  timestamp: number;
};

export type UserModelReport = {
  totalDimensions: number;
  highConfidenceDimensions: number;   // confidence >= 0.6
  averageConfidence: number;
  staleDimensions: number;            // not updated in >14 days
  lastUpdatedAt: number | null;
  dimensions: DimensionValue[];
  dominantMotivation: string | null;
  coachingStylePreference: string;
  burnoutRisk: "low" | "moderate" | "high";
};

// ── Prior values (neutral starting points) ─────────────────────────────────────

const DIMENSION_PRIORS: Record<UserModelDimension, number> = {
  motivation_level: 0.6,     // assume motivated by default
  adherence_trend: 0.5,
  emotional_tendency: 0.5,
  recovery_pattern: 0.5,
  energy_rhythm: 0.5,
  stress_level: 0.3,         // assume low-moderate stress by default
  burnout_risk: 0.2,         // assume low risk by default
  habit_resilience: 0.5,
  engagement_depth: 0.4,
  coaching_preference: 0.5,
};

const LEARNING_RATE = 0.2;       // how much each new evidence shifts the value
const CONFIDENCE_GAIN = 0.08;    // confidence added per consistent observation
const CONFIDENCE_LOSS = 0.15;    // confidence lost per contradicting observation
const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const STALE_DECAY_RATE = 0.02;   // per day toward prior

const MODEL_KEY = "ai_user_model_v2";

// ── Model state ────────────────────────────────────────────────────────────────

function loadModel(): Map<UserModelDimension, DimensionValue> {
  try {
    const raw = JSON.parse(localStorage.getItem(MODEL_KEY) ?? "null") as Record<UserModelDimension, DimensionValue> | null;
    if (!raw) return buildDefaultModel();
    return new Map(Object.entries(raw) as [UserModelDimension, DimensionValue][]);
  } catch { return buildDefaultModel(); }
}

function buildDefaultModel(): Map<UserModelDimension, DimensionValue> {
  const model = new Map<UserModelDimension, DimensionValue>();
  for (const [dim, prior] of Object.entries(DIMENSION_PRIORS) as [UserModelDimension, number][]) {
    model.set(dim, {
      dimension: dim, value: prior, confidence: 0.1,
      trend: "unknown", evidenceCount: 0, lastUpdatedAt: 0, contradictions: 0,
    });
  }
  return model;
}

function saveModel(model: Map<UserModelDimension, DimensionValue>): void {
  try {
    const obj: Record<string, DimensionValue> = {};
    for (const [k, v] of model) obj[k] = v;
    localStorage.setItem(MODEL_KEY, JSON.stringify(obj));
  } catch { /* */ }
}

let _model = loadModel();
let _lastUpdatedAt: number | null = null;

// ── Stale decay ────────────────────────────────────────────────────────────────

export function applyUserModelDecay(): void {
  const now = Date.now();
  for (const [dim, dv] of _model) {
    if (dv.lastUpdatedAt === 0) continue;
    const staleDays = (now - dv.lastUpdatedAt) / (24 * 60 * 60 * 1000);
    if (staleDays < 14) continue;
    // Decay value toward prior
    const prior = DIMENSION_PRIORS[dim];
    dv.value = dv.value * (1 - STALE_DECAY_RATE) + prior * STALE_DECAY_RATE;
    // Decay confidence
    dv.confidence = Math.max(0.05, dv.confidence - 0.01);
    _model.set(dim, dv);
  }
  saveModel(_model);
}

// ── Evidence accumulation ──────────────────────────────────────────────────────

export function recordUserEvidence(evidence: UserEvidence): void {
  const dv = _model.get(evidence.dimension);
  if (!dv) return;

  const prevValue = dv.value;
  const prior = DIMENSION_PRIORS[evidence.dimension];
  const weightedValue = evidence.value * evidence.weight + prior * (1 - evidence.weight);

  // EMA update
  dv.value = dv.value * (1 - LEARNING_RATE * evidence.weight) + weightedValue * LEARNING_RATE * evidence.weight;
  dv.evidenceCount++;
  dv.lastUpdatedAt = evidence.timestamp;
  _lastUpdatedAt = evidence.timestamp;

  // Contradiction detection
  const delta = Math.abs(evidence.value - prevValue);
  if (delta > 0.35 && dv.evidenceCount > 3) {
    dv.contradictions++;
    dv.confidence = Math.max(0.05, dv.confidence - CONFIDENCE_LOSS);
  } else {
    dv.confidence = Math.min(1, dv.confidence + CONFIDENCE_GAIN * evidence.weight);
    dv.contradictions = Math.max(0, dv.contradictions - 0.5);
  }

  // Trend
  const valueDelta = dv.value - prevValue;
  dv.trend = Math.abs(valueDelta) < 0.03 ? "stable" : valueDelta > 0 ? "improving" : "declining";

  _model.set(evidence.dimension, dv);
  saveModel(_model);

  emitCognitionEvent("user_model_updated", {
    dimension: evidence.dimension,
    observation: evidence.observation,
    newValue: dv.value,
    confidence: dv.confidence,
    trend: dv.trend,
  });
}

// ── Retrieval ──────────────────────────────────────────────────────────────────

export function getDimension(dim: UserModelDimension): DimensionValue | null {
  return _model.get(dim) ?? null;
}

export function getHighConfidenceDimensions(minConfidence = 0.6): DimensionValue[] {
  return [..._model.values()].filter((d) => d.confidence >= minConfidence);
}

export function getCoachingContext(): string {
  const high = getHighConfidenceDimensions();
  if (!high.length) return "";

  const parts: string[] = [];
  const motivation = _model.get("motivation_level");
  const burnout = _model.get("burnout_risk");
  const coaching = _model.get("coaching_preference");
  const resilience = _model.get("habit_resilience");

  if (motivation && motivation.confidence > 0.4) {
    parts.push(`motivation: ${motivation.value > 0.6 ? "high" : motivation.value > 0.35 ? "moderate" : "low"}`);
  }
  if (burnout && burnout.confidence > 0.4 && burnout.value > 0.5) {
    parts.push("burnout risk: elevated — use supportive tone");
  }
  if (coaching && coaching.confidence > 0.5) {
    parts.push(`coaching style: ${coaching.value > 0.6 ? "encouraging" : coaching.value < 0.4 ? "direct" : "balanced"}`);
  }
  if (resilience && resilience.confidence > 0.4) {
    parts.push(`habit resilience: ${resilience.value > 0.6 ? "strong" : "needs support"}`);
  }

  return parts.join("; ");
}

// ── Contradiction tracking ────────────────────────────────────────────────────

export function getContradictoryDimensions(): DimensionValue[] {
  return [..._model.values()].filter((d) => d.contradictions >= 2);
}

// ── Report ────────────────────────────────────────────────────────────────────

export function getUserModelReport(): UserModelReport {
  const now = Date.now();
  const dims = [..._model.values()];
  const highConf = dims.filter((d) => d.confidence >= 0.6);
  const stale = dims.filter((d) => d.lastUpdatedAt > 0 && now - d.lastUpdatedAt > STALE_THRESHOLD_MS);
  const avgConf = dims.reduce((s, d) => s + d.confidence, 0) / dims.length;

  const burnout = _model.get("burnout_risk");
  const coaching = _model.get("coaching_preference");

  const burnoutRisk: "low" | "moderate" | "high" =
    burnout && burnout.value > 0.65 ? "high" : burnout && burnout.value > 0.4 ? "moderate" : "low";

  const coachingStyle = coaching
    ? coaching.value > 0.65 ? "encouraging" : coaching.value < 0.35 ? "direct" : "balanced"
    : "balanced";

  return {
    totalDimensions: dims.length,
    highConfidenceDimensions: highConf.length,
    averageConfidence: Math.round(avgConf * 100) / 100,
    staleDimensions: stale.length,
    lastUpdatedAt: _lastUpdatedAt,
    dimensions: dims.sort((a, b) => b.confidence - a.confidence),
    dominantMotivation: getCoachingContext() || null,
    coachingStylePreference: coachingStyle,
    burnoutRisk,
  };
}

export function resetUserModel(): void {
  _model = buildDefaultModel();
  _lastUpdatedAt = null;
  try { localStorage.removeItem(MODEL_KEY); } catch { /* */ }
}
