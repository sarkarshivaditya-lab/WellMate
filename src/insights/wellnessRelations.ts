// src/insights/wellnessRelations.ts
// Deterministic cross-module wellness relationship detection.
// All computations are local-only — no LLM, no network, no hallucination.
// Insights require minimum data thresholds before surfacing.

import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import { listHabits, listAllEntries } from "@/data/local/habitsStore";

export type WellnessRelation = {
  id: string;
  modules: string[];
  insight: string;
  trend: "positive" | "negative" | "neutral";
  confidence: "low" | "medium" | "high";
};

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeWellnessRelations(): WellnessRelation[] {
  const relations: WellnessRelation[] = [];
  const cutoff30 = cutoffIso(30);
  const cutoff14 = cutoffIso(14);

  const allSleeps = getAllLocalSleep();
  const allMoods = getAllLocalMoods();
  const allExercises = getAllLocalExercises();
  const allJournals = getAllLocalJournalEntries();

  const recentSleeps = allSleeps.filter((s) => s.startIso >= cutoff30);
  const recentMoods = allMoods.filter((m) => m.dateIso >= cutoff30);
  const recentExercises = allExercises.filter(
    (e) => !e.deletedAt && e.dateIso >= cutoff30,
  );
  const recentJournals = allJournals.filter((j) => j.dateIso >= cutoff30);

  // --- Sleep quality trend (early vs. late half of the last 30 days) ---
  if (recentSleeps.length >= 6) {
    const sorted = [...recentSleeps].sort((a, b) =>
      a.startIso.localeCompare(b.startIso),
    );
    const half = Math.floor(sorted.length / 2);
    const olderAvg = avg(sorted.slice(0, half).map((s) => s.rating));
    const recentAvg = avg(sorted.slice(-half).map((s) => s.rating));

    if (Math.abs(recentAvg - olderAvg) >= 0.5) {
      relations.push({
        id: "sleep-quality-trend",
        modules: ["sleep"],
        insight:
          recentAvg > olderAvg
            ? "Your sleep quality has improved over the past two weeks."
            : "Your sleep quality has been lower recently — evening routines may help.",
        trend: recentAvg > olderAvg ? "positive" : "negative",
        confidence: "medium",
      });
    }
  }

  // --- Exercise → sleep quality (next day) ---
  if (recentExercises.length >= 3 && recentSleeps.length >= 3) {
    const exerciseDates = new Set(recentExercises.map((e) => e.dateIso));
    const sleepsAfterExercise = recentSleeps.filter((s) => {
      const date = s.startIso.split("T")[0];
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      return exerciseDates.has(prev.toISOString().split("T")[0]);
    });

    if (sleepsAfterExercise.length >= 2) {
      const afterExerciseAvg = avg(sleepsAfterExercise.map((s) => s.rating));
      const overallAvg = avg(recentSleeps.map((s) => s.rating));

      if (afterExerciseAvg - overallAvg >= 0.4) {
        relations.push({
          id: "exercise-sleep",
          modules: ["exercise", "sleep"],
          insight: "You tend to sleep better the night after an active day.",
          trend: "positive",
          confidence: "medium",
        });
      }
    }
  }

  // --- Habit completion → mood ---
  const habits = listHabits();
  const habitEntries = listAllEntries().filter((e) => e.dateIso >= cutoff30);

  if (habits.length > 0 && recentMoods.length >= 5 && habitEntries.length >= 5) {
    const completionByDate = new Map<string, number>();
    for (const e of habitEntries) {
      if (e.completed) {
        completionByDate.set(e.dateIso, (completionByDate.get(e.dateIso) ?? 0) + 1);
      }
    }

    const maxPerDay = Math.max(...Array.from(completionByDate.values()), 1);
    const highHabitDates = new Set(
      Array.from(completionByDate.entries())
        .filter(([, count]) => count >= Math.ceil(maxPerDay * 0.6))
        .map(([date]) => date),
    );

    const moodsHigh = recentMoods.filter((m) => highHabitDates.has(m.dateIso));
    const moodsOther = recentMoods.filter((m) => !highHabitDates.has(m.dateIso));

    if (moodsHigh.length >= 2 && moodsOther.length >= 2) {
      const highMoodAvg = avg(moodsHigh.map((m) => m.moodValue));
      const otherMoodAvg = avg(moodsOther.map((m) => m.moodValue));

      if (highMoodAvg - otherMoodAvg >= 0.5) {
        relations.push({
          id: "habits-mood",
          modules: ["habit", "mood"],
          insight:
            "Your mood tends to be noticeably better on days with strong habit follow-through.",
          trend: "positive",
          confidence: "medium",
        });
      }
    }
  }

  // --- Journaling → mood correlation ---
  if (recentJournals.length >= 3 && recentMoods.length >= 5) {
    const journalDates = new Set(recentJournals.map((j) => j.dateIso));
    const moodsWithJournal = recentMoods.filter((m) =>
      journalDates.has(m.dateIso),
    );
    const moodsWithout = recentMoods.filter(
      (m) => !journalDates.has(m.dateIso),
    );

    if (moodsWithJournal.length >= 2 && moodsWithout.length >= 2) {
      const withAvg = avg(moodsWithJournal.map((m) => m.moodValue));
      const withoutAvg = avg(moodsWithout.map((m) => m.moodValue));

      if (Math.abs(withAvg - withoutAvg) >= 0.4) {
        relations.push({
          id: "journal-mood",
          modules: ["journal", "mood"],
          insight:
            withAvg > withoutAvg
              ? "Days you journal show higher mood scores — writing seems to help."
              : "You tend to journal more on harder days — it's a healthy outlet.",
          trend: withAvg > withoutAvg ? "positive" : "neutral",
          confidence: "low",
        });
      }
    }
  }

  // --- Sleep duration consistency (last 14 days) ---
  const recentSleeps14 = allSleeps.filter((s) => s.startIso >= cutoff14);
  if (recentSleeps14.length >= 5) {
    const durations = recentSleeps14.map((s) => s.durationMin);
    const avgDuration = avg(durations);
    const variance =
      durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) /
      durations.length;
    const stdDev = Math.sqrt(variance);
    const consistencyRating = stdDev < 30 ? "consistent" : stdDev < 60 ? "moderate" : "variable";

    if (consistencyRating === "consistent") {
      relations.push({
        id: "sleep-consistency",
        modules: ["sleep"],
        insight: `Your sleep schedule has been consistent over the past two weeks — consistent timing tends to improve how rested you feel.`,
        trend: "positive",
        confidence: "high",
      });
    } else if (consistencyRating === "variable") {
      relations.push({
        id: "sleep-consistency",
        modules: ["sleep"],
        insight:
          "Your sleep timing has varied quite a bit recently. A consistent schedule can improve quality.",
        trend: "negative",
        confidence: "medium",
      });
    }
  }

  return relations;
}
