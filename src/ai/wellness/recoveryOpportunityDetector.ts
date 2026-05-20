// Recovery Opportunity Detector — finds windows where small support could help significantly.
//
// This is positive-timing intelligence, not alarm intelligence.
//
// Recovery windows occur when:
//   - Physical: sleep recovery readiness > 70, rest after exercise load
//   - Motivational: motivation trend is rising after a low period
//   - Emotional: stress is falling, burnout is lower than recent peak
//   - Behavioral: one successful habit day after a streak break
//   - Goal: a stalled goal thread shows recent positive evidence
//
// Each opportunity has:
//   - category: what kind of recovery
//   - confidence: how certain we are
//   - window: "now" | "today" | "this_week"
//   - suggestion: what would help (informational, never prescriptive)

import { computeSleepRecoveryReadiness } from "@/intelligence/sleepIntelligence";
import { computeRecoveryScore } from "@/intelligence/recoveryHeuristics";
import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { getActiveGoalThreads } from "@/ai/cognition/goalThreadTracker";
import { buildRecommendationContext } from "@/recommendations/recommendationContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecoveryCategory =
  | "physical_recovery"
  | "motivational_rebound"
  | "emotional_stabilization"
  | "habit_restart"
  | "goal_momentum"
  | "stress_reduction"
  | "sleep_improvement";

export type RecoveryWindow = "now" | "today" | "this_week";

export type RecoveryOpportunity = {
  id: string;
  category: RecoveryCategory;
  confidence: number;         // 0-1
  window: RecoveryWindow;
  headline: string;           // 3-6 words, positive framing
  suggestion: string;         // 1-2 sentence support suggestion (never prescriptive)
  supportingSignals: string[];
  detectedAt: number;
};

export type RecoveryOpportunityReport = {
  opportunities: RecoveryOpportunity[];
  hasActiveWindow: boolean;
  topCategory: RecoveryCategory | null;
  lastComputedAt: number | null;
};

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;  // 3 hours
let _cached: RecoveryOpportunityReport | null = null;
let _cachedAt = 0;

// ── Detector functions ────────────────────────────────────────────────────────

function detectPhysicalRecovery(): RecoveryOpportunity | null {
  try {
    const readiness = computeSleepRecoveryReadiness();
    const recovery = computeRecoveryScore();
    if (readiness.score > 70) {
      return {
        id: "physical_recovery",
        category: "physical_recovery",
        confidence: Math.min(0.9, readiness.score / 100),
        window: "now",
        headline: "Good recovery readiness",
        suggestion: "Your sleep data suggests your body has had a chance to recover. This could be a comfortable time for activity if you feel up to it.",
        supportingSignals: [readiness.label, `Recovery: ${recovery.score}/100`],
        detectedAt: Date.now(),
      };
    }
  } catch { /* data unavailable */ }
  return null;
}

function detectMotivationalRebound(emotional: ReturnType<typeof getEmotionalProfile>): RecoveryOpportunity | null {
  const motivation = emotional.dimensions.motivation;
  if (motivation.trend === "rising" && motivation.value > 0.4 && motivation.evidenceCount > 1) {
    return {
      id: "motivational_rebound",
      category: "motivational_rebound",
      confidence: Math.min(0.8, motivation.confidence),
      window: "today",
      headline: "Motivation trending up",
      suggestion: "There are signs of rising motivation. If you've been waiting for a good moment to revisit a goal, this could be it.",
      supportingSignals: [`Motivation: ${(motivation.value * 100).toFixed(0)}%`, "Trend: rising"],
      detectedAt: Date.now(),
    };
  }
  return null;
}

function detectEmotionalStabilization(emotional: ReturnType<typeof getEmotionalProfile>): RecoveryOpportunity | null {
  const stress = emotional.dimensions.stress;
  const burnout = emotional.dimensions.burnout;
  const hasRecentShift = emotional.dimensions.stress.trend === "falling" && stress.value < 0.5;
  if (hasRecentShift && burnout.value < 0.4) {
    return {
      id: "emotional_stabilization",
      category: "emotional_stabilization",
      confidence: 0.65,
      window: "today",
      headline: "Stress levels easing",
      suggestion: "Stress signals appear to be decreasing. It might feel easier to reflect or engage with wellness goals now.",
      supportingSignals: [`Stress trend: falling`, `Burnout: ${(burnout.value * 100).toFixed(0)}%`],
      detectedAt: Date.now(),
    };
  }
  return null;
}

function detectHabitRestart(ctx: ReturnType<typeof buildRecommendationContext>): RecoveryOpportunity | null {
  if (ctx.habitsCompletionRate30d > 0.3 && ctx.habitsTrend === "up") {
    return {
      id: "habit_restart",
      category: "habit_restart",
      confidence: 0.6,
      window: "this_week",
      headline: "Habit momentum building",
      suggestion: "You've been completing habits more consistently recently. This upward pattern often builds on itself.",
      supportingSignals: [`Completion: ${(ctx.habitsCompletionRate30d * 100).toFixed(0)}%`, "Trend: up"],
      detectedAt: Date.now(),
    };
  }
  return null;
}

function detectGoalMomentum(): RecoveryOpportunity | null {
  const threads = getActiveGoalThreads();
  const progressing = threads.find((t) => t.status === "progressing" && t.salience > 0.5);
  if (progressing) {
    return {
      id: "goal_momentum",
      category: "goal_momentum",
      confidence: Math.min(0.75, progressing.salience),
      window: "this_week",
      headline: "Goal progress detected",
      suggestion: `Your "${progressing.name}" goal shows progress. Consistent small steps often lead to lasting change.`,
      supportingSignals: [`Progress: ${(progressing.progress * 100).toFixed(0)}%`, `Status: ${progressing.status}`],
      detectedAt: Date.now(),
    };
  }
  return null;
}

function detectSleepImprovement(ctx: ReturnType<typeof buildRecommendationContext>): RecoveryOpportunity | null {
  if (ctx.sleepTrend === "up" && ctx.sleepScore > 60) {
    return {
      id: "sleep_improvement",
      category: "sleep_improvement",
      confidence: 0.65,
      window: "this_week",
      headline: "Sleep trending better",
      suggestion: "Sleep quality has been improving. Better sleep tends to positively influence energy and mood throughout the day.",
      supportingSignals: [`Sleep score: ${ctx.sleepScore}`, "Trend: up"],
      detectedAt: Date.now(),
    };
  }
  return null;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function detectRecoveryOpportunities(forceRefresh = false): RecoveryOpportunityReport {
  const now = Date.now();
  if (!forceRefresh && _cached && now - _cachedAt < CACHE_TTL_MS) return _cached;

  const emotional = getEmotionalProfile();
  const ctx = buildRecommendationContext(null);

  const detectors = [
    detectPhysicalRecovery,
    () => detectMotivationalRebound(emotional),
    () => detectEmotionalStabilization(emotional),
    () => detectHabitRestart(ctx),
    detectGoalMomentum,
    () => detectSleepImprovement(ctx),
  ];

  const opportunities: RecoveryOpportunity[] = [];
  for (const detector of detectors) {
    try {
      const result = detector();
      if (result) opportunities.push(result);
    } catch { /* each detector is independent */ }
  }

  // Sort by confidence, limit to 3
  const sorted = opportunities.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const topCategory = sorted.length > 0 ? sorted[0].category : null;

  _cached = {
    opportunities: sorted,
    hasActiveWindow: sorted.some((o) => o.window === "now"),
    topCategory,
    lastComputedAt: now,
  };
  _cachedAt = now;
  return _cached;
}

export function getRecoveryOpportunityReport(): RecoveryOpportunityReport | null {
  return _cached;
}
