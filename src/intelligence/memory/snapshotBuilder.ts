// src/intelligence/memory/snapshotBuilder.ts
// Builds monthly LongitudinalSnapshot objects from raw local data.
// Each snapshot is an atomic unit of longitudinal memory.

import { computeWindowMetrics } from "./temporalAnalysis";
import type { LongitudinalSnapshot } from "./types";

function monthStartIso(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function monthEndIso(year: number, month: number): string {
  const d = new Date(year, month + 1, 0); // day 0 of next month = last day of this month
  return d.toLocaleDateString("en-CA");
}

export function buildMonthlySnapshot(year: number, month: number): LongitudinalSnapshot {
  const start = monthStartIso(year, month);
  const end = monthEndIso(year, month);
  const m = computeWindowMetrics(start, end);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  return {
    monthKey,
    monthStart: start,
    monthEnd: end,
    sleep: {
      nightsLogged: m.sleep.nightsLogged,
      avgDurationMin: Math.round(m.sleep.avgDurationMin),
      avgQuality: Math.round(m.sleep.avgQuality * 10) / 10,
      bedtimeConsistencyScore: m.sleep.bedtimeConsistencyScore,
    },
    activity: {
      sessionsLogged: m.activity.sessionsLogged,
      totalDurationMin: m.activity.totalDurationMin,
      totalCaloriesBurned: m.activity.totalCaloriesBurned,
      activeDays: m.activity.activeDays,
    },
    nutrition: {
      daysLogged: m.nutrition.daysLogged,
      avgDailyCalories: Math.round(m.nutrition.avgDailyCalories),
      avgDailyProteinG: Math.round(m.nutrition.avgDailyProteinG),
    },
    habits: {
      completionRate: m.habits.completionRate,
      bestStreak: m.habits.bestStreak,
      totalCompleted: m.habits.totalCompleted,
    },
    mood: {
      entriesLogged: m.mood.entriesLogged,
      avgMood: Math.round(m.mood.avgMood * 10) / 10,
      volatility: Math.round(m.mood.volatility * 100) / 100,
    },
    hydration: {
      daysLogged: m.hydration.daysLogged,
      avgCupsPerDay: Math.round(m.hydration.avgCupsPerDay * 10) / 10,
    },
    journal: {
      entriesWritten: m.journal.entriesWritten,
    },
  };
}

function snapshotHasData(s: LongitudinalSnapshot): boolean {
  return (
    s.sleep.nightsLogged > 0 ||
    s.activity.sessionsLogged > 0 ||
    s.nutrition.daysLogged > 0 ||
    s.habits.totalCompleted > 0 ||
    s.mood.entriesLogged > 0 ||
    s.hydration.daysLogged > 0 ||
    s.journal.entriesWritten > 0
  );
}

// Returns snapshots for the past N months, chronological (oldest first).
// Only includes months that contain at least one logged entry.
export function buildRecentMonthlySnapshots(months = 12): LongitudinalSnapshot[] {
  const now = new Date();
  const result: LongitudinalSnapshot[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const snapshot = buildMonthlySnapshot(d.getFullYear(), d.getMonth());
    if (snapshotHasData(snapshot)) {
      result.push(snapshot);
    }
  }

  return result;
}
