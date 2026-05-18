// src/intelligence/recoveryHeuristics.ts
// Lightweight, deterministic fatigue and recovery estimation.
// Based on exercise load, consecutive workout days, and sleep quality.
// Tone: calm and supportive — never alarmist.

import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalSleep } from "@/data/local/sleepStore";
import type { WellnessScore, OvertrainingSignal, SignalItem } from "./types";

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function dateIsoToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

function dateIsoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

// ── Consecutive workout days ──────────────────────────────────────────────────

function countConsecutiveWorkoutDays(): number {
  const exercises = getAllLocalExercises().filter((e) => !e.deletedAt);
  const datesWithExercise = new Set(exercises.map((e) => e.dateIso));

  let streak = 0;
  let i = 0;

  // Check today first, then go back
  while (true) {
    const d = dateIsoDaysAgo(i);
    if (datesWithExercise.has(d)) {
      streak++;
      i++;
    } else if (i === 0) {
      // No exercise today — check from yesterday
      i = 1;
    } else {
      break;
    }
  }

  return streak;
}

// ── Exercise load in last N days ──────────────────────────────────────────────

function exerciseLoadKcal(days: number): number {
  const cutoff = cutoffIso(days);
  return getAllLocalExercises()
    .filter((e) => !e.deletedAt && e.dateIso >= cutoff)
    .reduce((sum, e) => sum + e.caloriesBurnedEst, 0);
}

// ── Overtraining detection ────────────────────────────────────────────────────

export function detectOvertraining(): OvertrainingSignal {
  const consecutiveDays = countConsecutiveWorkoutDays();
  const load3d = exerciseLoadKcal(3);
  const recentSleep = getAllLocalSleep()
    .filter((s) => s.startIso >= cutoffIso(3))
    .sort((a, b) => b.startIso.localeCompare(a.startIso));

  const avgSleepQuality = recentSleep.length > 0
    ? avg(recentSleep.map((s) => s.rating))
    : 3; // assume neutral if no data

  // Overtraining signal fires when:
  // - 5+ consecutive workout days, OR
  // - 3+ days of heavy load (>300 kcal/day avg) AND poor sleep quality
  const heavyLoad = load3d / 3 > 300;
  const poorSleep = avgSleepQuality < 2.8;

  if (consecutiveDays >= 5 && poorSleep) {
    return {
      detected: true,
      consecutiveWorkoutDays: consecutiveDays,
      reason: `${consecutiveDays} consecutive workout days with low sleep quality suggests your body needs a rest day.`,
    };
  }

  if (heavyLoad && poorSleep && consecutiveDays >= 3) {
    return {
      detected: true,
      consecutiveWorkoutDays: consecutiveDays,
      reason: "High exercise load and low sleep quality over the past 3 days — a rest or light day would help recovery.",
    };
  }

  return { detected: false, consecutiveWorkoutDays: consecutiveDays };
}

// ── Recovery Score ────────────────────────────────────────────────────────────

export function computeRecoveryScore(): WellnessScore {
  const exercises7 = getAllLocalExercises().filter(
    (e) => !e.deletedAt && e.dateIso >= cutoffIso(7),
  );
  const sleep7 = getAllLocalSleep().filter((s) => s.startIso >= cutoffIso(7));

  if (exercises7.length === 0 && sleep7.length === 0) {
    return {
      score: 0,
      level: "low",
      headline: "No activity data yet",
      explanation: "Log exercise and sleep to unlock recovery insights. Even a few entries reveal meaningful patterns.",
      signals: [],
      trend: "stable",
      dataQuality: "insufficient",
    };
  }

  const signals: SignalItem[] = [];
  let score = 60; // neutral baseline

  // ── Consecutive workout days (reduces score after 3+) ────────────────────
  const consecutiveDays = countConsecutiveWorkoutDays();
  const consecutivePenalty = Math.max(0, (consecutiveDays - 3) * 10);
  score -= consecutivePenalty;

  if (consecutiveDays > 0) {
    signals.push({
      label: "Active days in a row",
      value: `${consecutiveDays} day${consecutiveDays !== 1 ? "s" : ""}`,
      positive: consecutiveDays <= 3,
    });
  }

  // ── Sleep quality contribution ────────────────────────────────────────────
  if (sleep7.length > 0) {
    const avgQ = avg(sleep7.slice(-3).map((s) => s.rating));
    const sleepBonus = Math.round(((avgQ - 1) / 4) * 30);
    score += sleepBonus - 15; // neutral at ~2.5 rating

    signals.push({
      label: "Recent sleep quality",
      value: `${avgQ.toFixed(1)}/5`,
      positive: avgQ >= 3,
    });
  }

  // ── Exercise load last 3 days ─────────────────────────────────────────────
  const load3 = exerciseLoadKcal(3);
  const avgDailyLoad = load3 / 3;

  let loadLabel: string;
  if (avgDailyLoad < 150) {
    loadLabel = "Light";
    score += 10;
  } else if (avgDailyLoad < 350) {
    loadLabel = "Moderate";
    // No change
  } else {
    loadLabel = "Heavy";
    score -= 10;
  }

  if (exercises7.length > 0) {
    signals.push({
      label: "3-day exercise load",
      value: loadLabel,
      positive: avgDailyLoad < 350,
    });
  }

  // ── Rest day this week ────────────────────────────────────────────────────
  const exerciseDates = new Set(exercises7.map((e) => e.dateIso));
  const daysThisWeek = 7;
  const restDays = daysThisWeek - exerciseDates.size;

  if (restDays >= 2) {
    score += 5;
    signals.push({
      label: "Rest days this week",
      value: `${restDays}`,
      positive: true,
    });
  } else if (exercises7.length > 0 && restDays === 0) {
    score -= 5;
  }

  // ── Overtraining check ────────────────────────────────────────────────────
  const { detected: overtrained } = detectOvertraining();

  score = Math.min(100, Math.max(0, score));
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  // ── Trend ─────────────────────────────────────────────────────────────────
  const load7 = exerciseLoadKcal(7);
  const prevLoad7 = exerciseLoadKcal(14) - load7;
  const trend: WellnessScore["trend"] =
    prevLoad7 > 0
      ? Math.abs(load7 / prevLoad7 - 1) < 0.15
        ? "stable"
        : load7 < prevLoad7
          ? "up"   // less load = more recovery
          : "down"
      : "stable";

  // ── Headline + explanation ────────────────────────────────────────────────
  let headline: string;
  let explanation: string;

  if (overtrained) {
    headline = "Consider a recovery day";
    explanation = `Your body is showing signs of accumulated fatigue. A rest day or gentle movement (stretching, walking) will allow for proper recovery before your next session.`;
  } else if (score >= 70) {
    headline = "Well recovered";
    explanation = `Your exercise load and sleep quality suggest your body has recovered well. ${consecutiveDays >= 3 ? "You've been consistently active — a rest day soon will help maintain this momentum." : "You're in a good position for your next session."}`;
  } else if (score >= 50) {
    headline = "Moderate recovery";
    explanation = `${consecutiveDays >= 3 ? `After ${consecutiveDays} consecutive workout days, ` : ""}Your body is still recovering. Moderate-intensity activity is appropriate — avoid pushing to maximum effort today.`;
  } else {
    headline = "Recovery is the priority";
    explanation = `Your recent activity load combined with sleep quality suggests your body would benefit most from rest, light stretching, or a gentle walk today.`;
  }

  return {
    score,
    level,
    headline,
    explanation,
    signals,
    trend,
    dataQuality: exercises7.length + sleep7.length >= 3 ? "sufficient" : "partial",
  };
}
