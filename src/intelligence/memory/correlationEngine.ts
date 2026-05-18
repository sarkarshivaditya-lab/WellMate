// src/intelligence/memory/correlationEngine.ts
// Longitudinal cross-domain correlation discovery over a 90-day window.
// All insights are observational — language uses "tends to", "often coincides with".
// Never asserts causation.

import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { listAllEntries } from "@/data/local/habitsStore";
import { getAllLocalHydration } from "@/data/local/hydrationStore";
import type { LongitudinalCorrelation } from "./types";

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
}

// Standard Pearson correlation coefficient for paired arrays.
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return 0;
  const xMean = avg(xs.slice(0, n));
  const yMean = avg(ys.slice(0, n));
  let num = 0;
  let xSq = 0;
  let ySq = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    xSq += dx * dx;
    ySq += dy * dy;
  }
  const denom = Math.sqrt(xSq * ySq);
  return denom === 0 ? 0 : num / denom;
}

export function computeLongitudinalCorrelations(): LongitudinalCorrelation[] {
  const correlations: LongitudinalCorrelation[] = [];
  const cutoff = cutoffIso(90);

  const sleeps = getAllLocalSleep().filter((s) => s.startIso.slice(0, 10) >= cutoff);
  const moods = getAllLocalMoods().filter((m) => m.dateIso >= cutoff);
  const exercises = getAllLocalExercises().filter((e) => !e.deletedAt && e.dateIso >= cutoff);
  const habitEntries = listAllEntries().filter((e) => e.dateIso >= cutoff);
  const hydrationLogs = getAllLocalHydration().filter((h) => h.dateIso >= cutoff);

  // Build date-keyed lookup maps
  const sleepQualityByDate = new Map<string, number>();
  const sleepDurationByDate = new Map<string, number>();
  for (const s of sleeps) {
    const d = s.startIso.slice(0, 10);
    sleepQualityByDate.set(d, s.rating);
    sleepDurationByDate.set(d, s.durationMin);
  }

  const moodByDate = new Map<string, number>();
  for (const m of moods) {
    moodByDate.set(m.dateIso, m.moodValue);
  }

  const exerciseDates = new Set(exercises.map((e) => e.dateIso));

  const habitsByDate = new Map<string, number>(); // date → completed count
  for (const e of habitEntries) {
    if (e.completed) {
      habitsByDate.set(e.dateIso, (habitsByDate.get(e.dateIso) ?? 0) + 1);
    }
  }

  const hydrationByDate = new Map<string, number>();
  for (const h of hydrationLogs) {
    hydrationByDate.set(h.dateIso, (hydrationByDate.get(h.dateIso) ?? 0) + h.cupsConsumed);
  }

  // ── Sleep quality × same-day mood ────────────────────────────────────────
  const sleepMoodDates = [...sleepQualityByDate.keys()].filter((d) => moodByDate.has(d));
  if (sleepMoodDates.length >= 7) {
    const sleepVals = sleepMoodDates.map((d) => sleepQualityByDate.get(d)!);
    const moodVals = sleepMoodDates.map((d) => moodByDate.get(d)!);
    const r = pearson(sleepVals, moodVals);

    if (r >= 0.3) {
      correlations.push({
        id: "sleep_quality_x_mood",
        domainA: "sleep",
        domainB: "mood",
        insight: "Days with higher sleep quality often coincide with better mood scores.",
        confidence: r >= 0.5 ? "medium" : "low",
        trend: "positive",
        windowDays: 90,
        sampleSize: sleepMoodDates.length,
      });
    }
  }

  // ── Exercise days → sleep quality (following night) ───────────────────────
  const exerciseDatesArr = [...exerciseDates];
  const sleepAfterExercise = exerciseDatesArr
    .map((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return sleepQualityByDate.get(next.toLocaleDateString("en-CA"));
    })
    .filter((q): q is number => q !== undefined);

  const sleepWithoutExercisePrev = [...sleepQualityByDate.entries()]
    .filter(([d]) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return !exerciseDates.has(prev.toLocaleDateString("en-CA"));
    })
    .map(([, q]) => q);

  if (sleepAfterExercise.length >= 5 && sleepWithoutExercisePrev.length >= 3) {
    const exAvg = avg(sleepAfterExercise);
    const noExAvg = avg(sleepWithoutExercisePrev);

    if (exAvg - noExAvg >= 0.3) {
      correlations.push({
        id: "activity_x_sleep_next_night",
        domainA: "activity",
        domainB: "sleep",
        insight: "Sleep quality tends to be higher the night after an active day.",
        confidence: sleepAfterExercise.length >= 10 ? "medium" : "low",
        trend: "positive",
        windowDays: 90,
        sampleSize: sleepAfterExercise.length,
      });
    }
  }

  // ── Habit completion × same-day mood ─────────────────────────────────────
  const habitMoodDates = [...habitsByDate.keys()].filter((d) => moodByDate.has(d));
  if (habitMoodDates.length >= 6) {
    const maxHabits = Math.max(...Array.from(habitsByDate.values()));
    const threshold = Math.ceil(maxHabits * 0.6);
    const highDays = habitMoodDates.filter((d) => (habitsByDate.get(d) ?? 0) >= threshold);
    const lowDays = habitMoodDates.filter((d) => (habitsByDate.get(d) ?? 0) < threshold);

    if (highDays.length >= 3 && lowDays.length >= 3) {
      const highMood = avg(highDays.map((d) => moodByDate.get(d)!));
      const lowMood = avg(lowDays.map((d) => moodByDate.get(d)!));

      if (highMood - lowMood >= 0.4) {
        correlations.push({
          id: "habits_x_mood",
          domainA: "habits",
          domainB: "mood",
          insight: "Mood scores tend to be higher on days with strong habit follow-through.",
          confidence: "medium",
          trend: "positive",
          windowDays: 90,
          sampleSize: habitMoodDates.length,
        });
      }
    }
  }

  // ── Hydration × sleep quality ─────────────────────────────────────────────
  const hydrationSleepDates = [...hydrationByDate.keys()].filter((d) =>
    sleepQualityByDate.has(d)
  );
  if (hydrationSleepDates.length >= 7) {
    const hydVals = hydrationSleepDates.map((d) => hydrationByDate.get(d)!);
    const sleepVals = hydrationSleepDates.map((d) => sleepQualityByDate.get(d)!);
    const r = pearson(hydVals, sleepVals);

    if (r >= 0.3) {
      correlations.push({
        id: "hydration_x_sleep_quality",
        domainA: "hydration",
        domainB: "sleep",
        insight: "Days with higher hydration appear associated with better sleep quality.",
        confidence: "low",
        trend: "positive",
        windowDays: 90,
        sampleSize: hydrationSleepDates.length,
      });
    }
  }

  // ── Weekly activity volume × sleep duration ───────────────────────────────
  // Group data into calendar weeks, then correlate avg sleep duration vs session count.
  const weekSleep = new Map<string, number[]>();
  const weekActivity = new Map<string, number>();

  for (const [date, dur] of sleepDurationByDate.entries()) {
    const d = new Date(date);
    const wk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-W${Math.ceil(d.getDate() / 7)}`;
    if (!weekSleep.has(wk)) weekSleep.set(wk, []);
    weekSleep.get(wk)!.push(dur);
  }

  for (const e of exercises) {
    const d = new Date(e.dateIso);
    const wk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-W${Math.ceil(d.getDate() / 7)}`;
    weekActivity.set(wk, (weekActivity.get(wk) ?? 0) + 1);
  }

  const sharedWeeks = [...weekSleep.keys()].filter((w) => weekActivity.has(w));
  if (sharedWeeks.length >= 4) {
    const sleepAvgs = sharedWeeks.map((w) => avg(weekSleep.get(w)!));
    const activityCounts = sharedWeeks.map((w) => weekActivity.get(w)!);
    const r = pearson(activityCounts, sleepAvgs);

    if (r >= 0.3) {
      correlations.push({
        id: "activity_weeks_x_sleep_duration",
        domainA: "activity",
        domainB: "sleep",
        insight: "More active weeks often coincide with longer average sleep.",
        confidence: "low",
        trend: "positive",
        windowDays: 90,
        sampleSize: sharedWeeks.length,
      });
    }
  }

  return correlations;
}
