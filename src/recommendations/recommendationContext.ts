// src/recommendations/recommendationContext.ts
// Ingests signals from all intelligence layers into a unified context.
// This is the bridge between the intelligence layer and recommendation rules.

import {
  computeSleepScore,
  computeSleepDebt,
  computeSleepRecoveryReadiness,
} from "@/intelligence/sleepIntelligence";
import {
  computeRecoveryScore,
  detectOvertraining,
} from "@/intelligence/recoveryHeuristics";
import {
  computeWindowMetrics,
  classifyTrend,
  dateIsoNDaysAgo,
  todayIso,
} from "@/intelligence/memory/temporalAnalysis";
import type { WellnessMemoryContext } from "@/intelligence/memory/types";
import type { RecommendationContext } from "./types";

export function buildRecommendationContext(
  memoryCtx: WellnessMemoryContext | null
): RecommendationContext {
  const today = todayIso();

  // ── Real-time intelligence signals ───────────────────────────────────────
  const sleepScore = computeSleepScore();
  const sleepDebt = computeSleepDebt();
  const recoveryReadiness = computeSleepRecoveryReadiness();
  const recoveryScore = computeRecoveryScore();
  const overtraining = detectOvertraining();

  // ── 30-day vs prior-30-day window for trend comparison ───────────────────
  const recent30 = computeWindowMetrics(dateIsoNDaysAgo(29), today);
  const prior30 = computeWindowMetrics(dateIsoNDaysAgo(59), dateIsoNDaysAgo(30));

  const sleepTrend = classifyTrend(recent30.sleep.avgQuality, prior30.sleep.avgQuality, 0.1);
  const activityTrend = classifyTrend(recent30.activity.activeDays, prior30.activity.activeDays, 0.2);
  const nutritionTrend = classifyTrend(
    recent30.nutrition.loggingRate,
    prior30.nutrition.loggingRate,
    0.2
  );
  const habitsTrend = classifyTrend(
    recent30.habits.completionRate,
    prior30.habits.completionRate,
    0.15
  );
  const moodTrend = classifyTrend(recent30.mood.avgMood, prior30.mood.avgMood, 0.08);

  // ── Simplified composite (sleep 30% + recovery 25% + 45% neutral base) ───
  const compositeRaw = Math.round(
    sleepScore.score * 0.3 + recoveryScore.score * 0.25 + 50 * 0.45
  );
  const compositeLevel: "high" | "medium" | "low" =
    compositeRaw >= 65 ? "high" : compositeRaw >= 42 ? "medium" : "low";

  // ── Inferred energy state ─────────────────────────────────────────────────
  // Composite of recovery readiness, sleep score, and overtraining signal.
  let energyPoints = 0;
  if (recoveryReadiness.score >= 60) energyPoints += 2;
  else if (recoveryReadiness.score < 35) energyPoints -= 2;
  if (sleepScore.score >= 60) energyPoints += 1;
  else if (sleepScore.score < 35 && sleepScore.dataQuality !== "insufficient") energyPoints -= 1;
  if (overtraining.detected) energyPoints -= 2;
  if (recent30.mood.avgMood >= 3.5 && recent30.mood.entriesLogged >= 5) energyPoints += 1;
  else if (recent30.mood.avgMood > 0 && recent30.mood.avgMood < 2.5 && recent30.mood.entriesLogged >= 5)
    energyPoints -= 1;

  const energyState: "low" | "moderate" | "high" =
    energyPoints <= -2 ? "low" : energyPoints >= 3 ? "high" : "moderate";

  // ── Longitudinal signals from memory ─────────────────────────────────────
  const hasLongitudinalData = (memoryCtx?.dataSpanDays ?? 0) >= 14;

  const positiveDeltas = (memoryCtx?.behavioralDeltas ?? [])
    .filter((d) => d.direction === "up")
    .map((d) => d.observation);

  const negativeDeltas = (memoryCtx?.behavioralDeltas ?? [])
    .filter((d) => d.direction === "down")
    .map((d) => d.observation);

  const confidenceOrder: Record<string, number> = { high: 2, medium: 1, low: 0 };
  const topCorrelation = (memoryCtx?.correlations ?? [])
    .filter((c) => c.confidence === "medium" || c.confidence === "high")
    .sort((a, b) => (confidenceOrder[b.confidence] ?? 0) - (confidenceOrder[a.confidence] ?? 0))[0] ?? null;

  return {
    sleepScore: sleepScore.score,
    sleepDebtHours: sleepDebt.hoursDebt,
    sleepTrend,
    sleepBedtimeConsistency: recent30.sleep.bedtimeConsistencyScore,
    sleepAvgQuality: recent30.sleep.avgQuality,
    sleepAvgDurationMin: recent30.sleep.avgDurationMin,
    sleepRecoveryReadiness: recoveryReadiness.score,
    sleepNightsLogged30d: recent30.sleep.nightsLogged,

    recoveryScore: recoveryScore.score,
    overtrainingDetected: overtraining.detected,
    consecutiveWorkoutDays: overtraining.consecutiveWorkoutDays,

    activityActiveDays30d: recent30.activity.activeDays,
    activityTrend,

    nutritionLoggingRate30d: recent30.nutrition.loggingRate,
    nutritionTrend,

    habitsCompletionRate30d: recent30.habits.completionRate,
    habitsTrend,
    habitsBestStreak: recent30.habits.bestStreak,

    moodAvg30d: recent30.mood.avgMood,
    moodVolatility30d: recent30.mood.volatility,
    moodEntriesLogged30d: recent30.mood.entriesLogged,
    moodTrend,

    hydrationAvgCups30d: recent30.hydration.avgCupsPerDay,
    hydrationLoggingRate30d: recent30.hydration.loggingRate,

    compositeScore: compositeRaw,
    compositeLevel,

    hasLongitudinalData,
    positiveDeltas,
    negativeDeltas,
    topCorrelationInsight: topCorrelation?.insight ?? null,
    dataSpanDays: memoryCtx?.dataSpanDays ?? 0,

    energyState,
  };
}
