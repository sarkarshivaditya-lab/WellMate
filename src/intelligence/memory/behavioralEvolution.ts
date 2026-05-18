// src/intelligence/memory/behavioralEvolution.ts
// Detects behavioral shifts by comparing a 30-day recent window
// against a 60-day baseline (days 31–90).
// Observations use calm, non-prescriptive language.

import {
  computeWindowMetrics,
  classifyTrend,
  dateIsoNDaysAgo,
  todayIso,
} from "./temporalAnalysis";
import type { BehavioralDelta, MemoryDomain, ConfidenceLevel } from "./types";

function relativeChangePct(recent: number, baseline: number): number {
  if (baseline === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - baseline) / Math.abs(baseline)) * 100);
}

function delta(
  domain: MemoryDomain,
  metric: string,
  recentVal: number,
  baselineVal: number,
  threshold: number,
  upObservation: string,
  downObservation: string,
  confidence: ConfidenceLevel
): BehavioralDelta | null {
  const direction = classifyTrend(recentVal, baselineVal, threshold);
  if (direction === "stable") return null;
  return {
    domain,
    metric,
    recentValue: recentVal,
    baselineValue: baselineVal,
    changePercent: relativeChangePct(recentVal, baselineVal),
    direction,
    observation: direction === "up" ? upObservation : downObservation,
    confidence,
  };
}

export function computeBehavioralDeltas(): BehavioralDelta[] {
  const today = todayIso();
  const recent = computeWindowMetrics(dateIsoNDaysAgo(29), today);
  const baseline = computeWindowMetrics(dateIsoNDaysAgo(89), dateIsoNDaysAgo(30));

  const deltas: BehavioralDelta[] = [];

  // Sleep duration
  if (baseline.sleep.nightsLogged >= 5 && recent.sleep.nightsLogged >= 5) {
    const d = delta(
      "sleep",
      "avg_sleep_duration_min",
      Math.round(recent.sleep.avgDurationMin),
      Math.round(baseline.sleep.avgDurationMin),
      0.08,
      "Sleep duration has lengthened compared to the previous period.",
      "Sleep duration has shortened compared to the previous period.",
      recent.sleep.nightsLogged >= 15 ? "high" : "medium"
    );
    if (d) deltas.push(d);
  }

  // Sleep quality
  if (baseline.sleep.nightsLogged >= 5 && recent.sleep.nightsLogged >= 5) {
    const d = delta(
      "sleep",
      "avg_sleep_quality",
      Math.round(recent.sleep.avgQuality * 10) / 10,
      Math.round(baseline.sleep.avgQuality * 10) / 10,
      0.1,
      "Sleep quality ratings have been higher recently.",
      "Sleep quality ratings have been lower recently.",
      "medium"
    );
    if (d) deltas.push(d);
  }

  // Active days per month
  if (baseline.activity.activeDays >= 2) {
    const d = delta(
      "activity",
      "active_days",
      recent.activity.activeDays,
      baseline.activity.activeDays,
      0.2,
      "You've been active more days per month recently.",
      "The number of active days has been lower recently.",
      "medium"
    );
    if (d) deltas.push(d);
  }

  // Nutrition logging rate (stored as 0-100 percentage)
  if (baseline.nutrition.daysLogged >= 5) {
    const d = delta(
      "nutrition",
      "nutrition_logging_rate",
      Math.round(recent.nutrition.loggingRate * 100),
      Math.round(baseline.nutrition.loggingRate * 100),
      0.2,
      "Meal logging has become more consistent recently.",
      "Meal logging frequency has decreased recently.",
      "low"
    );
    if (d) deltas.push(d);
  }

  // Habit completion rate
  if (baseline.habits.totalCompleted >= 5 && recent.habits.totalCompleted >= 5) {
    const d = delta(
      "habits",
      "habit_completion_rate",
      recent.habits.completionRate,
      baseline.habits.completionRate,
      0.15,
      "Habit follow-through has strengthened recently.",
      "Habit completion rate has been lower recently.",
      "medium"
    );
    if (d) deltas.push(d);
  }

  // Average mood
  if (baseline.mood.entriesLogged >= 5 && recent.mood.entriesLogged >= 5) {
    const d = delta(
      "mood",
      "avg_mood",
      Math.round(recent.mood.avgMood * 10) / 10,
      Math.round(baseline.mood.avgMood * 10) / 10,
      0.08,
      "Mood scores have been trending higher recently.",
      "Mood scores have been slightly lower recently.",
      "medium"
    );
    if (d) deltas.push(d);
  }

  // Hydration
  if (baseline.hydration.daysLogged >= 5 && recent.hydration.daysLogged >= 5) {
    const d = delta(
      "hydration",
      "avg_hydration_cups",
      Math.round(recent.hydration.avgCupsPerDay * 10) / 10,
      Math.round(baseline.hydration.avgCupsPerDay * 10) / 10,
      0.15,
      "Daily hydration intake has increased.",
      "Daily hydration intake has decreased.",
      "low"
    );
    if (d) deltas.push(d);
  }

  return deltas;
}
