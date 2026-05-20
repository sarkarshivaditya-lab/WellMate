// Wellness Trajectory Engine — models longitudinal wellness direction.
//
// Uses 4-week rolling trends across sleep, activity, nutrition, habits,
// emotional state, and burnout to understand WHERE the user is heading.
//
// Outputs per-domain slope + composite trajectory with:
//   - momentum score (0-1): how much velocity in a direction
//   - stability score (0-1): consistency regardless of direction
//   - deterioration flag: sustained negative slope
//   - recovery flag: improving after prior decline
//
// Data sources:
//   - computeRollingTrends() — 4-week window per domain
//   - buildRecommendationContext(null) — snapshot of all wellness signals
//   - getEmotionalProfile() — emotional trajectory
//
// This module is read-only. It does NOT write to any store.
// Results are cached with a 2-hour TTL.

import { computeRollingTrends } from "@/intelligence/longitudinalEngine";
import { buildRecommendationContext } from "@/recommendations/recommendationContext";
import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type WellnessDomain =
  | "sleep" | "activity" | "nutrition" | "habits"
  | "emotional" | "burnout" | "recovery" | "engagement";

export type TrajectoryDirection = "improving" | "stable" | "declining" | "volatile" | "unknown";

export type DomainTrajectory = {
  domain: WellnessDomain;
  direction: TrajectoryDirection;
  slope: number;              // -1 to +1 normalized slope over 4 weeks
  momentum: number;           // 0-1: how much velocity in current direction
  stability: number;          // 0-1: consistency regardless of direction
  currentScore: number;       // 0-100
  trend4wk: number[];         // weekly values, oldest first
  isDeterioration: boolean;   // sustained decline (slope < -0.15 for 2+ weeks)
  isRecovery: boolean;        // improving after prior decline
};

export type WellnessTrajectory = {
  domains: DomainTrajectory[];
  compositeDirection: TrajectoryDirection;
  compositeSlope: number;     // -1 to +1
  compositeMomentum: number;  // 0-1
  burnoutProgression: number; // 0-1; rising = escalating burnout
  stressAccumulation: number; // 0-1
  motivationDecay: number;    // 0-1; rising = decaying motivation
  recoveryTrend: number;      // 0-1; rising = recovering
  dominantConcern: WellnessDomain | null;
  positiveSignals: WellnessDomain[];
  negativeSignals: WellnessDomain[];
  computedAt: number;
};

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 2 * 60 * 60 * 1000;  // 2 hours
let _cached: WellnessTrajectory | null = null;
let _cachedAt = 0;

// ── Slope computation ──────────────────────────────────────────────────────────

function computeSlope(values: number[]): number {
  // Least-squares slope normalized to [-1, +1] range
  const n = values.length;
  if (n < 2) return 0;
  const validValues = values.filter((v) => v > 0);
  if (validValues.length < 2) return 0;

  const indices = values.map((_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((acc, xi, i) => acc + xi * values[i], 0);
  const sumX2 = indices.reduce((acc, xi) => acc + xi * xi, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  const rawSlope = (n * sumXY - sumX * sumY) / denom;
  const maxPossibleSlope = (values[values.length - 1] - values[0]) / (n - 1) || 1;
  return Math.max(-1, Math.min(1, rawSlope / (Math.abs(maxPossibleSlope) + 0.01)));
}

function computeStability(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const cv = Math.sqrt(variance) / (mean + 0.01);  // coefficient of variation
  return Math.max(0, Math.min(1, 1 - cv));
}

function computeMomentum(values: number[], slope: number): number {
  // Momentum = consistency of direction in recent 2 values vs earlier 2
  if (values.length < 3) return Math.abs(slope);
  const recent = values.slice(-2);
  const earlier = values.slice(0, 2);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const delta = (recentAvg - earlierAvg) / (Math.abs(earlierAvg) + 0.01);
  return Math.abs(Math.max(-1, Math.min(1, delta)));
}

function classifyDirection(slope: number, stability: number): TrajectoryDirection {
  if (stability < 0.3) return "volatile";
  if (Math.abs(slope) < 0.05) return "stable";
  if (slope > 0.15) return "improving";
  if (slope < -0.15) return "declining";
  return "stable";
}

// ── Domain trajectory builder ──────────────────────────────────────────────────

function buildDomainTrajectory(
  domain: WellnessDomain,
  trend4wk: number[],
  currentScore: number,
): DomainTrajectory {
  const slope = computeSlope(trend4wk);
  const stability = computeStability(trend4wk);
  const momentum = computeMomentum(trend4wk, slope);
  const direction = classifyDirection(slope, stability);

  // Deterioration: 2+ consecutive declining values
  const isDeterioration =
    trend4wk.length >= 3 &&
    trend4wk[trend4wk.length - 1] < trend4wk[trend4wk.length - 2] &&
    trend4wk[trend4wk.length - 2] < trend4wk[trend4wk.length - 3];

  // Recovery: improving after being below baseline
  const hasDecline = trend4wk.some((v, i) => i < trend4wk.length - 1 && v < trend4wk[i + 1] - 5);
  const isRecovery = hasDecline && slope > 0.1;

  return { domain, direction, slope, momentum, stability, currentScore, trend4wk, isDeterioration, isRecovery };
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeWellnessTrajectory(forceRefresh = false): WellnessTrajectory {
  const now = Date.now();
  if (!forceRefresh && _cached && now - _cachedAt < CACHE_TTL_MS) return _cached;

  const rollingTrends = computeRollingTrends();
  const ctx = buildRecommendationContext(null);
  const emotional = getEmotionalProfile();

  const trendMap = new Map(rollingTrends.map((t) => [t.domain, t]));

  // Build domain trajectories from rolling trends
  const sleepTrend = trendMap.get("Sleep")?.weeks ?? [50, 50, 50, 50];
  const exerciseTrend = trendMap.get("Exercise")?.weeks ?? [50, 50, 50, 50];
  const nutritionTrend = trendMap.get("Nutrition")?.weeks ?? [50, 50, 50, 50];
  const habitTrend = trendMap.get("Habits")?.weeks ?? [50, 50, 50, 50];

  // Emotional trajectory from 5-dimension EMA (last 4 weeks approximated from evidence counts)
  const motivationVal = emotional.dimensions.motivation.value * 100;
  const burnoutVal = emotional.dimensions.burnout.value * 100;
  const stressVal = emotional.dimensions.stress.value * 100;

  const domains: DomainTrajectory[] = [
    buildDomainTrajectory("sleep", sleepTrend, ctx.sleepScore),
    buildDomainTrajectory("activity", exerciseTrend, ctx.activityActiveDays30d * 3.3),
    buildDomainTrajectory("nutrition", nutritionTrend, ctx.nutritionLoggingRate30d * 100),
    buildDomainTrajectory("habits", habitTrend, ctx.habitsCompletionRate30d * 100),
    buildDomainTrajectory("emotional", [50, 50, motivationVal, motivationVal], motivationVal),
    buildDomainTrajectory("burnout", [20, 30, burnoutVal, burnoutVal], burnoutVal),
  ];

  // Composite slope (weighted average)
  const weights: Record<WellnessDomain, number> = {
    sleep: 0.25, activity: 0.2, nutrition: 0.15, habits: 0.2,
    emotional: 0.15, burnout: -0.05, recovery: 0.05, engagement: 0.05,
  };
  const compositeSlope = domains.reduce((acc, d) => acc + d.slope * (weights[d.domain] ?? 0.1), 0);
  const compositeMomentum = domains.reduce((acc, d) => acc + d.momentum, 0) / domains.length;
  const compositeDirection = classifyDirection(compositeSlope, 0.5);

  const negativeSignals = domains.filter((d) => d.isDeterioration || d.direction === "declining").map((d) => d.domain);
  const positiveSignals = domains.filter((d) => d.isRecovery || d.direction === "improving").map((d) => d.domain);

  const dominantConcern = negativeSignals.length > 0 ? negativeSignals[0] : null;

  _cached = {
    domains,
    compositeDirection,
    compositeSlope,
    compositeMomentum,
    burnoutProgression: emotional.dimensions.burnout.value,
    stressAccumulation: emotional.dimensions.stress.value,
    motivationDecay: 1 - emotional.dimensions.motivation.value,
    recoveryTrend: emotional.dimensions.encouragement_effectiveness.value,
    dominantConcern,
    positiveSignals,
    negativeSignals,
    computedAt: now,
  };
  _cachedAt = now;
  return _cached;
}

export function getWellnessTrajectory(): WellnessTrajectory | null {
  return _cached;
}

export function invalidateTrajectoryCache(): void {
  _cached = null;
  _cachedAt = 0;
}
