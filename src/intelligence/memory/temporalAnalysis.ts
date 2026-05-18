// src/intelligence/memory/temporalAnalysis.ts
// Multi-window metric computation for longitudinal memory.
// All computations are deterministic and local-first.

import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalMeals } from "@/data/local/mealsStore";
import { listAllEntries } from "@/data/local/habitsStore";
import { getAllLocalHydration } from "@/data/local/hydrationStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";

export type WindowMetrics = {
  windowStart: string;
  windowEnd: string;
  days: number;
  sleep: {
    nightsLogged: number;
    avgDurationMin: number;
    avgQuality: number;
    bedtimeConsistencyScore: number; // 0-100, higher = more consistent
  };
  activity: {
    sessionsLogged: number;
    activeDays: number;
    totalDurationMin: number;
    totalCaloriesBurned: number;
  };
  nutrition: {
    daysLogged: number;
    loggingRate: number; // 0-1
    avgDailyCalories: number;
    avgDailyProteinG: number;
  };
  habits: {
    completionRate: number; // 0-100
    bestStreak: number;
    totalCompleted: number;
  };
  mood: {
    entriesLogged: number;
    avgMood: number;
    volatility: number; // std dev of moodValue
    loggingRate: number; // entries per day
  };
  hydration: {
    daysLogged: number;
    avgCupsPerDay: number;
    loggingRate: number; // 0-1
  };
  journal: {
    entriesWritten: number;
    writingRate: number; // entries per day
  };
};

export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function dateIsoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function inWindow(dateStr: string, windowStart: string, windowEnd: string): boolean {
  return dateStr >= windowStart && dateStr <= windowEnd;
}

function uniqueDates(dates: string[]): string[] {
  return [...new Set(dates)];
}

export function computeWindowMetrics(windowStart: string, windowEnd: string): WindowMetrics {
  const days = Math.max(
    1,
    Math.round((new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 86400000) + 1
  );

  // --- Sleep ---
  const sleepLogs = getAllLocalSleep().filter(
    (s) => inWindow(s.startIso.slice(0, 10), windowStart, windowEnd)
  );
  const avgDurationMin = sleepLogs.length
    ? sleepLogs.reduce((s, l) => s + l.durationMin, 0) / sleepLogs.length
    : 0;
  const avgQuality = sleepLogs.length
    ? sleepLogs.reduce((s, l) => s + l.rating, 0) / sleepLogs.length
    : 0;

  // Bedtime consistency: std dev of time-of-night in minutes from 6PM anchor
  const bedtimeMins = sleepLogs
    .map((s) => {
      const t = new Date(s.startIso);
      const h = t.getHours();
      const m = t.getMinutes();
      // Normalize bedtime relative to 6PM (18:00) anchor; midnight wraps to +360
      return h >= 18 ? (h - 18) * 60 + m : (h + 6) * 60 + m;
    })
    .filter((v) => v >= 0 && v <= 720); // plausible 6PM–6AM window

  const bedtimeStdDevMin = stdDev(bedtimeMins);
  // 0 stddev → 100, ≥120 min stddev → 0
  const bedtimeConsistencyScore = Math.max(
    0,
    Math.round(100 - (bedtimeStdDevMin / 120) * 100)
  );

  // --- Activity ---
  const exercises = getAllLocalExercises().filter(
    (e) => !e.deletedAt && inWindow(e.dateIso, windowStart, windowEnd)
  );
  const activeDays = new Set(exercises.map((e) => e.dateIso)).size;

  // --- Nutrition ---
  const meals = getAllLocalMeals().filter(
    (m) => !m.deletedAt && inWindow(m.dateIso, windowStart, windowEnd)
  );
  const nutritionDays = uniqueDates(meals.map((m) => m.dateIso));
  const caloriesByDay = new Map<string, number>();
  const proteinByDay = new Map<string, number>();
  for (const meal of meals) {
    caloriesByDay.set(meal.dateIso, (caloriesByDay.get(meal.dateIso) ?? 0) + meal.totalCalories);
    proteinByDay.set(meal.dateIso, (proteinByDay.get(meal.dateIso) ?? 0) + meal.totalProteinG);
  }
  const avgDailyCalories = nutritionDays.length
    ? [...caloriesByDay.values()].reduce((s, v) => s + v, 0) / nutritionDays.length
    : 0;
  const avgDailyProteinG = nutritionDays.length
    ? [...proteinByDay.values()].reduce((s, v) => s + v, 0) / nutritionDays.length
    : 0;

  // --- Habits ---
  const habitEntries = listAllEntries().filter(
    (e) => inWindow(e.dateIso, windowStart, windowEnd)
  );
  const completedEntries = habitEntries.filter((e) => e.completed);
  const completionRate = habitEntries.length
    ? Math.round((completedEntries.length / habitEntries.length) * 100)
    : 0;

  // Best streak: consecutive days with at least one completed habit
  const completedDays = [...new Set(completedEntries.map((e) => e.dateIso))].sort();
  let bestStreak = 0;
  let currentStreak = 0;
  let prevDate: string | null = null;
  for (const d of completedDays) {
    if (prevDate) {
      const diff = Math.round(
        (new Date(d).getTime() - new Date(prevDate).getTime()) / 86400000
      );
      currentStreak = diff === 1 ? currentStreak + 1 : 1;
    } else {
      currentStreak = 1;
    }
    bestStreak = Math.max(bestStreak, currentStreak);
    prevDate = d;
  }

  // --- Mood ---
  const moods = getAllLocalMoods().filter(
    (m) => inWindow(m.dateIso, windowStart, windowEnd)
  );
  const avgMood = moods.length
    ? moods.reduce((s, m) => s + m.moodValue, 0) / moods.length
    : 0;
  const moodVolatility = stdDev(moods.map((m) => m.moodValue));

  // --- Hydration ---
  const hydrationLogs = getAllLocalHydration().filter(
    (h) => inWindow(h.dateIso, windowStart, windowEnd)
  );
  const hydrationDays = uniqueDates(hydrationLogs.map((h) => h.dateIso));
  const totalCups = hydrationLogs.reduce((s, h) => s + h.cupsConsumed, 0);
  const avgCupsPerDay = hydrationDays.length ? totalCups / hydrationDays.length : 0;

  // --- Journal ---
  const journalEntries = getAllLocalJournalEntries().filter(
    (e) => inWindow(e.dateIso, windowStart, windowEnd)
  );

  return {
    windowStart,
    windowEnd,
    days,
    sleep: {
      nightsLogged: sleepLogs.length,
      avgDurationMin,
      avgQuality,
      bedtimeConsistencyScore,
    },
    activity: {
      sessionsLogged: exercises.length,
      activeDays,
      totalDurationMin: exercises.reduce((s, e) => s + e.durationMinutes, 0),
      totalCaloriesBurned: exercises.reduce((s, e) => s + e.caloriesBurnedEst, 0),
    },
    nutrition: {
      daysLogged: nutritionDays.length,
      loggingRate: nutritionDays.length / days,
      avgDailyCalories,
      avgDailyProteinG,
    },
    habits: {
      completionRate,
      bestStreak,
      totalCompleted: completedEntries.length,
    },
    mood: {
      entriesLogged: moods.length,
      avgMood,
      volatility: moodVolatility,
      loggingRate: moods.length / days,
    },
    hydration: {
      daysLogged: hydrationDays.length,
      avgCupsPerDay,
      loggingRate: hydrationDays.length / days,
    },
    journal: {
      entriesWritten: journalEntries.length,
      writingRate: journalEntries.length / days,
    },
  };
}

export function compute7dMetrics(): WindowMetrics {
  return computeWindowMetrics(dateIsoNDaysAgo(6), todayIso());
}

export function compute30dMetrics(): WindowMetrics {
  return computeWindowMetrics(dateIsoNDaysAgo(29), todayIso());
}

export function compute90dMetrics(): WindowMetrics {
  return computeWindowMetrics(dateIsoNDaysAgo(89), todayIso());
}

// Returns "up" / "down" / "stable" based on relative change.
// threshold: fractional change required to be non-stable (default 10%)
export function classifyTrend(
  recent: number,
  baseline: number,
  threshold = 0.1
): "up" | "down" | "stable" {
  if (baseline === 0) return recent > 0 ? "up" : "stable";
  const delta = (recent - baseline) / Math.abs(baseline);
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "stable";
}

export function computeDataSpanDays(): number {
  const allDates: string[] = [
    ...getAllLocalSleep().map((s) => s.startIso.slice(0, 10)),
    ...getAllLocalExercises().filter((e) => !e.deletedAt).map((e) => e.dateIso),
    ...getAllLocalMoods().map((m) => m.dateIso),
    ...getAllLocalMeals().filter((m) => !m.deletedAt).map((m) => m.dateIso),
    ...listAllEntries().map((e) => e.dateIso),
    ...getAllLocalHydration().map((h) => h.dateIso),
    ...getAllLocalJournalEntries().map((e) => e.dateIso),
  ].filter(Boolean);

  if (allDates.length === 0) return 0;
  const sorted = [...allDates].sort();
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  return (
    Math.round((new Date(latest).getTime() - new Date(earliest).getTime()) / 86400000) + 1
  );
}
