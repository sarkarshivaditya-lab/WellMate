// src/intelligence/memory/memoryEventDetector.ts
// Detects meaningful wellness memory events by comparing time windows.
// All detections are threshold-based and explainable.
// Language is observational — no causal claims.

import {
  computeWindowMetrics,
  classifyTrend,
  dateIsoNDaysAgo,
  todayIso,
} from "./temporalAnalysis";
import type { MemoryEvent, MemoryDomain, ConfidenceLevel } from "./types";

function makeId(domain: MemoryDomain, type: string, windowStart: string): string {
  return `${domain}_${type}_${windowStart}`;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

export function detectRecentMemoryEvents(): MemoryEvent[] {
  const events: MemoryEvent[] = [];
  const today = todayIso();

  // recent = last 30 days; baseline = days 31–90 (the 60-day window before recent)
  const recentStart = dateIsoNDaysAgo(29);
  const baselineStart = dateIsoNDaysAgo(89);
  const baselineEnd = dateIsoNDaysAgo(30);

  const recent = computeWindowMetrics(recentStart, today);
  const baseline = computeWindowMetrics(baselineStart, baselineEnd);

  // ── Sleep stabilization ───────────────────────────────────────────────────
  if (recent.sleep.nightsLogged >= 10) {
    const trend = classifyTrend(
      recent.sleep.bedtimeConsistencyScore,
      baseline.sleep.bedtimeConsistencyScore,
      0.15
    );
    if (trend === "up" && recent.sleep.bedtimeConsistencyScore >= 65) {
      const confidence: ConfidenceLevel = recent.sleep.nightsLogged >= 20 ? "high" : "medium";
      events.push({
        id: makeId("sleep", "sleep_stabilization", recentStart),
        domain: "sleep",
        type: "sleep_stabilization",
        windowStart: recentStart,
        windowEnd: today,
        headline: "Your sleep timing has become more consistent over the past month.",
        detail:
          recent.sleep.bedtimeConsistencyScore >= 80
            ? "Bedtime patterns are notably regular — this tends to support deeper, more restorative sleep."
            : undefined,
        confidence,
        supportingSignals: [
          { label: "Bedtime consistency", value: `${recent.sleep.bedtimeConsistencyScore}/100` },
          { label: "Nights logged", value: `${recent.sleep.nightsLogged}` },
        ],
        trend: "positive",
        relatedDomains: ["sleep"],
      });
    }
  }

  // ── Sleep duration improvement ────────────────────────────────────────────
  if (recent.sleep.nightsLogged >= 8 && baseline.sleep.nightsLogged >= 5) {
    const trend = classifyTrend(
      recent.sleep.avgDurationMin,
      baseline.sleep.avgDurationMin,
      0.08
    );
    if (trend === "up" && recent.sleep.avgDurationMin >= 360) {
      events.push({
        id: makeId("sleep", "sleep_duration_improvement", recentStart),
        domain: "sleep",
        type: "sleep_duration_improvement",
        windowStart: recentStart,
        windowEnd: today,
        headline: `Sleep duration has increased — averaging ${fmtMins(Math.round(recent.sleep.avgDurationMin))} recently.`,
        confidence: "medium",
        supportingSignals: [
          { label: "Recent avg", value: fmtMins(Math.round(recent.sleep.avgDurationMin)) },
          { label: "Previous avg", value: fmtMins(Math.round(baseline.sleep.avgDurationMin)) },
        ],
        trend: "positive",
        relatedDomains: ["sleep"],
      });
    }
  }

  // ── Recovery improvement (activity up, sleep quality held) ───────────────
  if (
    recent.activity.activeDays >= 8 &&
    baseline.activity.activeDays >= 4 &&
    recent.sleep.nightsLogged >= 8
  ) {
    const activityTrend = classifyTrend(
      recent.activity.activeDays,
      baseline.activity.activeDays,
      0.2
    );
    if (activityTrend === "up" && recent.sleep.avgQuality >= 3.0) {
      events.push({
        id: makeId("activity", "recovery_improvement", recentStart),
        domain: "activity",
        type: "recovery_improvement",
        windowStart: recentStart,
        windowEnd: today,
        headline: "Activity has increased while sleep quality remained stable.",
        detail: "Your body appears to be adapting well to the recent increase in movement.",
        confidence: "medium",
        supportingSignals: [
          { label: "Active days (recent)", value: `${recent.activity.activeDays}` },
          { label: "Sleep quality", value: `${Math.round(recent.sleep.avgQuality * 10) / 10}/5` },
        ],
        trend: "positive",
        relatedDomains: ["activity", "sleep"],
      });
    }
  }

  // ── Habit consistency shift ───────────────────────────────────────────────
  if (recent.habits.totalCompleted >= 10 && baseline.habits.totalCompleted >= 5) {
    const trend = classifyTrend(
      recent.habits.completionRate,
      baseline.habits.completionRate,
      0.15
    );
    if (trend !== "stable") {
      const isUp = trend === "up";
      events.push({
        id: makeId("habits", "habit_consistency_shift", recentStart),
        domain: "habits",
        type: "habit_consistency_shift",
        windowStart: recentStart,
        windowEnd: today,
        headline: isUp
          ? `Habit follow-through has improved — ${recent.habits.completionRate}% completion this month.`
          : `Habit completion has been lower recently — ${recent.habits.completionRate}% this period.`,
        confidence: "medium",
        supportingSignals: [
          { label: "Recent completion", value: `${recent.habits.completionRate}%` },
          { label: "Previous period", value: `${baseline.habits.completionRate}%` },
        ],
        trend: isUp ? "positive" : "negative",
        relatedDomains: ["habits"],
      });
    }
  }

  // ── Nutrition logging consistency ─────────────────────────────────────────
  if (recent.nutrition.daysLogged >= 10) {
    const trend = classifyTrend(
      recent.nutrition.loggingRate,
      baseline.nutrition.loggingRate,
      0.2
    );
    if (trend === "up" && recent.nutrition.loggingRate >= 0.5) {
      events.push({
        id: makeId("nutrition", "nutrition_logging_consistency", recentStart),
        domain: "nutrition",
        type: "nutrition_logging_consistency",
        windowStart: recentStart,
        windowEnd: today,
        headline: "Meal logging has been more consistent this month.",
        confidence: "medium",
        supportingSignals: [
          { label: "Days logged", value: `${recent.nutrition.daysLogged}` },
          { label: "Logging rate", value: `${Math.round(recent.nutrition.loggingRate * 100)}%` },
        ],
        trend: "positive",
        relatedDomains: ["nutrition"],
      });
    }
  }

  // ── Mood stabilization ────────────────────────────────────────────────────
  if (recent.mood.entriesLogged >= 10 && baseline.mood.entriesLogged >= 5) {
    const volatilityReduced =
      baseline.mood.volatility > 0 &&
      recent.mood.volatility < baseline.mood.volatility * 0.75;
    if (volatilityReduced && recent.mood.volatility < 1.0) {
      events.push({
        id: makeId("mood", "mood_stabilization", recentStart),
        domain: "mood",
        type: "mood_stabilization",
        windowStart: recentStart,
        windowEnd: today,
        headline: "Mood has been more consistent recently.",
        confidence: "medium",
        supportingSignals: [
          { label: "Recent volatility", value: recent.mood.volatility.toFixed(2) },
          { label: "Previous volatility", value: baseline.mood.volatility.toFixed(2) },
          { label: "Avg mood", value: `${Math.round(recent.mood.avgMood * 10) / 10}/5` },
        ],
        trend: "positive",
        relatedDomains: ["mood"],
      });
    }
  }

  // ── Hydration consistency ─────────────────────────────────────────────────
  if (recent.hydration.loggingRate >= 0.5 && recent.hydration.daysLogged >= 10) {
    const trend = classifyTrend(
      recent.hydration.avgCupsPerDay,
      baseline.hydration.avgCupsPerDay,
      0.15
    );
    if (trend === "up" || (trend === "stable" && recent.hydration.avgCupsPerDay >= 6)) {
      events.push({
        id: makeId("hydration", "hydration_consistency", recentStart),
        domain: "hydration",
        type: "hydration_consistency",
        windowStart: recentStart,
        windowEnd: today,
        headline: "You've maintained more consistent hydration this month.",
        confidence: "low",
        supportingSignals: [
          {
            label: "Avg cups/day",
            value: `${Math.round(recent.hydration.avgCupsPerDay * 10) / 10}`,
          },
          { label: "Days tracked", value: `${recent.hydration.daysLogged}` },
        ],
        trend: "positive",
        relatedDomains: ["hydration"],
      });
    }
  }

  // ── Activity increase / decrease ──────────────────────────────────────────
  if (recent.activity.sessionsLogged >= 5 && baseline.activity.sessionsLogged >= 2) {
    const trend = classifyTrend(
      recent.activity.activeDays,
      baseline.activity.activeDays,
      0.25
    );
    if (trend !== "stable") {
      const isUp = trend === "up";
      events.push({
        id: makeId("activity", isUp ? "activity_increase" : "activity_decrease", recentStart),
        domain: "activity",
        type: isUp ? "activity_increase" : "activity_decrease",
        windowStart: recentStart,
        windowEnd: today,
        headline: isUp
          ? `Activity has increased — ${recent.activity.activeDays} active days this month.`
          : "Activity has been lower this month compared to the previous period.",
        confidence: "medium",
        supportingSignals: [
          { label: "Active days (recent)", value: `${recent.activity.activeDays}` },
          { label: "Active days (prev)", value: `${baseline.activity.activeDays}` },
        ],
        trend: isUp ? "positive" : "negative",
        relatedDomains: ["activity"],
      });
    }
  }

  return events;
}
