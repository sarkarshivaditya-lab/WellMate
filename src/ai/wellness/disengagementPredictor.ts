// Disengagement Predictor — predicts user disengagement BEFORE dropout occurs.
//
// IMPORTANT: This module exists to support the user, NOT to optimize retention.
// The distinction: support = notice struggle and offer help.
// Manipulation = create anxiety, guilt, or FOMO to drive re-engagement.
// This module NEVER uses the latter.
//
// Signals used:
//   - App usage frequency (analytics retention)
//   - Logging rate decline across wellness entities
//   - Emotional fatigue (burnout + frustration dimensions)
//   - Goal thread abandonment rate
//   - Wellness score decline
//   - Avoidance signals (visiting AI but not logging)
//
// Output:
//   - risk score 0-1
//   - confidence 0-1
//   - probable causes (up to 3)
//   - suggested intervention strategy (informational, non-manipulative)

import { getRetentionMetrics } from "@/analytics/retentionEngine";
import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { getGoalThreadReport } from "@/ai/cognition/goalThreadTracker";
import { buildRecommendationContext } from "@/recommendations/recommendationContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DisengagementCause =
  | "emotional_fatigue"
  | "habit_decay"
  | "burnout"
  | "goal_abandonment"
  | "logging_fatigue"
  | "wellness_decline"
  | "reduced_engagement"
  | "motivational_collapse";

export type InterventionStrategy =
  | "gentle_check_in"       // low-pressure awareness
  | "reduce_goal_pressure"  // simplify, not amplify
  | "celebrate_small_wins"  // positive reinforcement
  | "offer_recovery_path"   // rest is valid
  | "rebuild_consistency"   // small steps back
  | "acknowledge_struggle"  // validation without judgment
  | "suggest_rest"          // recovery-first
  | "no_intervention";      // user is fine

export type DisengagementPrediction = {
  riskScore: number;              // 0-1
  confidence: number;             // 0-1
  riskLevel: "low" | "moderate" | "high";
  probableCauses: DisengagementCause[];
  suggestedStrategy: InterventionStrategy;
  strategyReason: string;
  predictedAt: number;
};

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;  // 4 hours
let _cached: DisengagementPrediction | null = null;
let _cachedAt = 0;

// ── Signal scoring ────────────────────────────────────────────────────────────

function scoreEngagementDecline(retention: ReturnType<typeof getRetentionMetrics>): { score: number; cause?: DisengagementCause } {
  const thisWeek = retention.activeDaysThisWeek;
  const lastWeek = retention.activeDaysLastWeek;
  if (lastWeek === 0) return { score: 0 };
  const decline = (lastWeek - thisWeek) / lastWeek;
  if (decline > 0.5) return { score: 0.7, cause: "reduced_engagement" };
  if (decline > 0.25) return { score: 0.4, cause: "reduced_engagement" };
  if (thisWeek === 0 && lastWeek >= 3) return { score: 0.8, cause: "reduced_engagement" };
  return { score: 0 };
}

function scoreLoggingDecline(retention: ReturnType<typeof getRetentionMetrics>): { score: number; cause?: DisengagementCause } {
  const consistency = retention.entityConsistency;
  const tracked = Object.values(consistency).filter((v) => v !== undefined) as number[];
  if (tracked.length === 0) return { score: 0 };
  const avgConsistency = tracked.reduce((a, b) => a + b, 0) / tracked.length;
  const logRate = avgConsistency / 30;   // days out of 30
  if (logRate < 0.1) return { score: 0.8, cause: "logging_fatigue" };
  if (logRate < 0.25) return { score: 0.5, cause: "logging_fatigue" };
  return { score: 0 };
}

function scoreEmotionalFatigue(emotional: ReturnType<typeof getEmotionalProfile>): { score: number; cause?: DisengagementCause } {
  const burnout = emotional.dimensions.burnout.value;
  const frustration = emotional.dimensions.frustration.value;
  const motivation = emotional.dimensions.motivation.value;

  if (burnout > 0.7) return { score: 0.85, cause: "burnout" };
  if (frustration > 0.65 && motivation < 0.4) return { score: 0.7, cause: "emotional_fatigue" };
  if (motivation < 0.3 && emotional.dimensions.motivation.confidence > 0.4) {
    return { score: 0.6, cause: "motivational_collapse" };
  }
  if (burnout > 0.5 || frustration > 0.5) return { score: 0.3, cause: "emotional_fatigue" };
  return { score: 0 };
}

function scoreGoalAbandonment(threads: ReturnType<typeof getGoalThreadReport>): { score: number; cause?: DisengagementCause } {
  const total = threads.activeThreads + threads.stalledThreads + threads.abandonedThreads + threads.completedThreads;
  if (total === 0) return { score: 0 };
  const abandonRate = threads.abandonedThreads / total;
  const stallRate = threads.stalledThreads / total;
  if (abandonRate > 0.5) return { score: 0.7, cause: "goal_abandonment" };
  if (stallRate > 0.5 && threads.activeThreads === 0) return { score: 0.5, cause: "goal_abandonment" };
  return { score: stallRate * 0.3 };
}

function scoreWellnessDecline(ctx: ReturnType<typeof buildRecommendationContext>): { score: number; cause?: DisengagementCause } {
  if (ctx.compositeScore < 35) return { score: 0.5, cause: "wellness_decline" };
  if (ctx.compositeScore < 45 && ctx.compositeLevel === "low") return { score: 0.3, cause: "wellness_decline" };
  return { score: 0 };
}

// ── Strategy selection ────────────────────────────────────────────────────────

function selectStrategy(
  riskLevel: "low" | "moderate" | "high",
  causes: DisengagementCause[],
  emotional: ReturnType<typeof getEmotionalProfile>,
): { strategy: InterventionStrategy; reason: string } {
  if (riskLevel === "low") return { strategy: "no_intervention", reason: "User engagement is healthy" };

  const burnout = emotional.dimensions.burnout.value;
  const motivation = emotional.dimensions.motivation.value;

  if (burnout > 0.7 || causes.includes("burnout")) {
    return { strategy: "suggest_rest", reason: "Burnout signals are elevated — rest is the most supportive response" };
  }
  if (causes.includes("motivational_collapse")) {
    return { strategy: "celebrate_small_wins", reason: "Motivation is low — small recognition may help more than goal pressure" };
  }
  if (causes.includes("emotional_fatigue")) {
    return { strategy: "acknowledge_struggle", reason: "Validation without judgment is more helpful than advice here" };
  }
  if (causes.includes("goal_abandonment") && motivation > 0.5) {
    return { strategy: "offer_recovery_path", reason: "Goals stalled but motivation exists — offering a path back may help" };
  }
  if (causes.includes("logging_fatigue")) {
    return { strategy: "reduce_goal_pressure", reason: "Logging burden appears high — simplifying may re-engage" };
  }
  if (causes.includes("reduced_engagement") && riskLevel === "moderate") {
    return { strategy: "gentle_check_in", reason: "Usage has decreased — a low-pressure awareness prompt may help" };
  }
  if (riskLevel === "high") {
    return { strategy: "acknowledge_struggle", reason: "Multiple disengagement signals — acknowledgment first, then support" };
  }

  return { strategy: "rebuild_consistency", reason: "Small, achievable steps to rebuild momentum" };
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function predictDisengagement(forceRefresh = false): DisengagementPrediction {
  const now = Date.now();
  if (!forceRefresh && _cached && now - _cachedAt < CACHE_TTL_MS) return _cached;

  const retention = getRetentionMetrics();
  const emotional = getEmotionalProfile();
  const threads = getGoalThreadReport();
  const ctx = buildRecommendationContext(null);

  const signals = [
    scoreEngagementDecline(retention),
    scoreLoggingDecline(retention),
    scoreEmotionalFatigue(emotional),
    scoreGoalAbandonment(threads),
    scoreWellnessDecline(ctx),
  ];

  // Aggregate score: max signal × 0.5 + average × 0.5
  const scores = signals.map((s) => s.score);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const riskScore = Math.min(1, maxScore * 0.6 + avgScore * 0.4);

  // Collect causes above threshold
  const probableCauses = signals
    .filter((s) => s.score >= 0.3 && s.cause)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.cause as DisengagementCause)
    .slice(0, 3);

  // Confidence: based on how much data we have
  const hasGoodData = retention.activeDaysLast30 > 5 && emotional.dimensions.motivation.confidence > 0.3;
  const confidence = hasGoodData ? Math.min(0.85, 0.4 + riskScore * 0.45) : 0.25;

  const riskLevel: DisengagementPrediction["riskLevel"] =
    riskScore > 0.6 ? "high" : riskScore > 0.35 ? "moderate" : "low";

  const { strategy: suggestedStrategy, reason: strategyReason } = selectStrategy(riskLevel, probableCauses, emotional);

  _cached = {
    riskScore,
    confidence,
    riskLevel,
    probableCauses,
    suggestedStrategy,
    strategyReason,
    predictedAt: now,
  };
  _cachedAt = now;
  return _cached;
}

export function getDisengagementPrediction(): DisengagementPrediction | null {
  return _cached;
}

export function invalidateDisengagementCache(): void {
  _cached = null;
  _cachedAt = 0;
}
