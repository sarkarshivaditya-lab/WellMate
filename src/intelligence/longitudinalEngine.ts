// src/intelligence/longitudinalEngine.ts
// Weekly summaries and multi-week comparisons.
// Makes the app feel aware of time — progress is visible, not invisible.

import { getAllLocalMeals } from "@/data/local/mealsStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import { listHabits, listAllEntries } from "@/data/local/habitsStore";
import type { WeeklySummary, WeeklyComparison, TrendDirection } from "./types";

function startOfWeekIso(weeksAgo = 0): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToMonday - weeksAgo * 7);
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString("en-CA");
}

function endOfWeekIso(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toLocaleDateString("en-CA");
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function trend(current: number, previous: number, threshold = 0.1): TrendDirection {
  if (previous === 0) return current > 0 ? "up" : "stable";
  const delta = (current - previous) / previous;
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "stable";
}

// ── Single week summary ───────────────────────────────────────────────────────

export function computeWeeklySummary(weeksAgo = 0): WeeklySummary {
  const weekStart = startOfWeekIso(weeksAgo);
  const weekEnd = endOfWeekIso(weekStart);

  // Filter by date range
  const inRange = (dateIso: string) => dateIso >= weekStart && dateIso <= weekEnd;

  // Meals
  const meals = getAllLocalMeals().filter(
    (m) => !m.deletedAt && inRange(m.dateIso),
  );
  const mealsLogged = meals.length;

  // Exercise
  const exercises = getAllLocalExercises().filter(
    (e) => !e.deletedAt && inRange(e.dateIso),
  );
  const exerciseSessions = exercises.length;
  const exerciseCaloriesBurned = exercises.reduce(
    (sum, e) => sum + e.caloriesBurnedEst,
    0,
  );

  // Sleep
  const sleepLogs = getAllLocalSleep().filter((s) => {
    const dateIso = s.startIso.split("T")[0];
    return inRange(dateIso);
  });
  const sleepNights = sleepLogs.length;
  const sleepAvgQuality = sleepNights > 0 ? avg(sleepLogs.map((s) => s.rating)) : 0;
  const sleepAvgDurationMin =
    sleepNights > 0 ? avg(sleepLogs.map((s) => s.durationMin)) : 0;

  // Moods
  const moods = getAllLocalMoods().filter((m) => inRange(m.dateIso));
  const moodsLogged = moods.length;
  const moodAvg = moodsLogged > 0 ? avg(moods.map((m) => m.moodValue)) : 0;

  // Journal
  const journalEntries = getAllLocalJournalEntries().filter((j) =>
    inRange(j.dateIso),
  ).length;

  // Habits
  const habits = listHabits();
  const allEntries = listAllEntries();
  const habitEntries = allEntries.filter((e) => inRange(e.dateIso));
  const habitsCompleted = habitEntries.filter((e) => e.completed).length;
  const habitsPossible = habits.length * 7;

  return {
    weekStart,
    mealsLogged,
    exerciseSessions,
    exerciseCaloriesBurned,
    sleepNights,
    sleepAvgQuality: Math.round(sleepAvgQuality * 10) / 10,
    sleepAvgDurationMin: Math.round(sleepAvgDurationMin),
    moodsLogged,
    moodAvg: Math.round(moodAvg * 10) / 10,
    journalEntries,
    habitsCompleted,
    habitsPossible,
  };
}

// ── Week-over-week comparison ─────────────────────────────────────────────────

export function computeWeeklyComparison(): WeeklyComparison {
  const thisWeek = computeWeeklySummary(0);
  const lastWeek = computeWeeklySummary(1);

  return {
    thisWeek,
    lastWeek,
    trends: {
      sleep: trend(thisWeek.sleepNights, lastWeek.sleepNights),
      nutrition: trend(thisWeek.mealsLogged, lastWeek.mealsLogged),
      activity: trend(thisWeek.exerciseSessions, lastWeek.exerciseSessions),
      habits: trend(thisWeek.habitsCompleted, lastWeek.habitsCompleted),
      mood: trend(thisWeek.moodAvg, lastWeek.moodAvg, 0.05),
    },
  };
}

// ── Rolling averages (4 weeks) ────────────────────────────────────────────────

export type RollingTrend = {
  domain: string;
  weeks: number[];        // value per week, oldest first
  direction: TrendDirection;
  label: string;          // human-readable latest value
};

export function computeRollingTrends(): RollingTrend[] {
  const summaries = [3, 2, 1, 0].map((n) => computeWeeklySummary(n));

  const sleepValues = summaries.map((s) => s.sleepNights);
  const exerciseValues = summaries.map((s) => s.exerciseSessions);
  const nutritionValues = summaries.map((s) => s.mealsLogged);
  const habitValues = summaries.map((s) =>
    s.habitsPossible > 0
      ? Math.round((s.habitsCompleted / s.habitsPossible) * 100)
      : 0,
  );

  const latest = summaries[3]; // this week

  return [
    {
      domain: "sleep",
      weeks: sleepValues,
      direction: trend(latest.sleepNights, summaries[2].sleepNights),
      label: `${latest.sleepNights} night${latest.sleepNights !== 1 ? "s" : ""}`,
    },
    {
      domain: "activity",
      weeks: exerciseValues,
      direction: trend(latest.exerciseSessions, summaries[2].exerciseSessions),
      label: `${latest.exerciseSessions} session${latest.exerciseSessions !== 1 ? "s" : ""}`,
    },
    {
      domain: "nutrition",
      weeks: nutritionValues,
      direction: trend(latest.mealsLogged, summaries[2].mealsLogged),
      label: `${latest.mealsLogged} meal${latest.mealsLogged !== 1 ? "s" : ""}`,
    },
    {
      domain: "habits",
      weeks: habitValues,
      direction: trend(habitValues[3], habitValues[2]),
      label: `${habitValues[3]}% completed`,
    },
  ];
}

// ── Weekly insight text ───────────────────────────────────────────────────────
// Returns a human-readable 1-2 sentence weekly summary.

export function generateWeeklySummaryText(comparison: WeeklyComparison): string {
  const { thisWeek, trends } = comparison;
  const parts: string[] = [];

  if (thisWeek.sleepNights === 0 && thisWeek.exerciseSessions === 0 && thisWeek.mealsLogged === 0) {
    return "No data logged this week yet. Start with anything — even one entry helps.";
  }

  // Sleep
  if (thisWeek.sleepNights > 0) {
    const h = Math.floor(thisWeek.sleepAvgDurationMin / 60);
    const m = thisWeek.sleepAvgDurationMin % 60;
    parts.push(
      `Sleep: ${thisWeek.sleepNights} night${thisWeek.sleepNights !== 1 ? "s" : ""} logged, averaging ${h}h${m > 0 ? ` ${m}m` : ""}.`,
    );
  }

  // Exercise
  if (thisWeek.exerciseSessions > 0) {
    parts.push(
      `${thisWeek.exerciseSessions} workout${thisWeek.exerciseSessions !== 1 ? "s" : ""} completed${thisWeek.exerciseCaloriesBurned > 0 ? `, burning ~${thisWeek.exerciseCaloriesBurned} kcal` : ""}.`,
    );
  }

  // Habits
  if (thisWeek.habitsPossible > 0 && thisWeek.habitsCompleted > 0) {
    const pct = Math.round((thisWeek.habitsCompleted / thisWeek.habitsPossible) * 100);
    parts.push(`Habits: ${pct}% completion this week.`);
  }

  // Trend sentiment
  const improvingCount = Object.values(trends).filter((t) => t === "up").length;
  const decliningCount = Object.values(trends).filter((t) => t === "down").length;

  if (improvingCount > decliningCount && improvingCount >= 2) {
    parts.push("Across the board, this week is trending upward compared to last week.");
  } else if (decliningCount > improvingCount && decliningCount >= 2) {
    parts.push("A few areas are lower than last week — that's normal across most weeks.");
  }

  return parts.join(" ");
}
