// src/export/exportSerializer.ts
// Reads all local stores and maps to clean export types.
// Strips sync metadata, normalizes nulls, computes derived fields.

import { readOnboardingPayload } from "@/data/local/onboardingPayload";
import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalMeals } from "@/data/local/mealsStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import { getAllLocalHydration } from "@/data/local/hydrationStore";
import {
  listHabits,
  listAllEntries,
  type LocalHabit,
  type LocalHabitEntry,
} from "@/data/local/habitsStore";
import type {
  ExportedProfile,
  ExportedSleepEntry,
  ExportedExerciseEntry,
  ExportedMealEntry,
  ExportedMoodEntry,
  ExportedJournalEntry,
  ExportedHydrationEntry,
  ExportedHabit,
  ExportedHabitEntry,
  ExportSummary,
  WellMateExport,
} from "./exportSchemas";

const MOOD_LABELS: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

function serializeProfile(): ExportedProfile | null {
  const payload = readOnboardingPayload();
  if (!payload) return null;
  return {
    dob: payload.dob ?? "",
    sex: payload.sex ?? "",
    heightCm: Number(payload.heightCm ?? 0),
    weightKg: Number(payload.weightKg ?? 0),
    activityLevel: payload.activityLevel ?? null,
    goal: payload.weightGoal ?? null,
    additionalHealthNotes: payload.additionalHealthNotes ?? undefined,
  };
}

function serializeSleep(): ExportedSleepEntry[] {
  return getAllLocalSleep().map((s) => ({
    id: s.localId,
    startIso: s.startIso,
    endIso: s.endIso,
    durationMinutes: s.durationMin,
    qualityRating: s.rating,
    notes: s.notes ?? undefined,
    loggedAt: s.updatedAt,
  }));
}

function serializeExercise(): ExportedExerciseEntry[] {
  return getAllLocalExercises()
    .filter((e) => !e.deletedAt)
    .map((e) => ({
      id: e.id,
      date: e.dateIso,
      type: e.type,
      name: e.name,
      durationMinutes: e.durationMinutes,
      caloriesEstimate: e.caloriesBurnedEst,
      notes: e.notes ?? undefined,
      loggedAt: e.createdAt,
    }));
}

function serializeMeals(): ExportedMealEntry[] {
  return getAllLocalMeals()
    .filter((m) => !m.deletedAt)
    .map((m) => ({
      id: m.id,
      name: m.name,
      calories: m.totalCalories,
      proteinG: m.totalProteinG,
      carbsG: m.totalCarbsG,
      fatG: m.totalFatG,
      loggedAt: m.createdAt,
    }));
}

function serializeMoods(): ExportedMoodEntry[] {
  return getAllLocalMoods().map((m) => ({
    id: m.localId,
    mood: MOOD_LABELS[m.moodValue] ?? String(m.moodValue),
    moodValue: m.moodValue,
    note: m.note ?? undefined,
    loggedAt: m.updatedAt,
  }));
}

function serializeJournal(): ExportedJournalEntry[] {
  return getAllLocalJournalEntries().map((j) => ({
    id: j.localId,
    title: j.title ?? undefined,
    body: j.text,
    wordCount: j.text.trim().split(/\s+/).filter(Boolean).length,
    loggedAt: j.createdAt,
  }));
}

function serializeHydration(): ExportedHydrationEntry[] {
  return getAllLocalHydration().map((h) => ({
    id: h.localId,
    amountMl: Math.round(h.cupsConsumed * 240),
    cupsConsumed: h.cupsConsumed,
    loggedAt: h.updatedAt,
  }));
}

function serializeHabits(): { definitions: ExportedHabit[]; entries: ExportedHabitEntry[] } {
  const rawHabits = (
    JSON.parse(localStorage.getItem("local_habits") ?? "[]") as LocalHabit[]
  );
  const definitions: ExportedHabit[] = rawHabits.map((h) => ({
    id: h.localId,
    title: h.title,
    description: h.description ?? undefined,
    cadence: h.cadence,
    active: !h.archived,
    createdAt: h.createdAt,
  }));

  const rawEntries = listAllEntries() as LocalHabitEntry[];
  const entries: ExportedHabitEntry[] = rawEntries.map((e) => ({
    habitId: e.habitLocalId,
    date: e.dateIso,
    completed: e.completed,
    note: e.note ?? undefined,
  }));

  return { definitions, entries };
}

function computeSummary(data: WellMateExport["data"]): ExportSummary {
  const allTimestamps: number[] = [
    ...data.sleep.map((e) => e.loggedAt),
    ...data.exercise.map((e) => e.loggedAt),
    ...data.meals.map((e) => e.loggedAt),
    ...data.moods.map((e) => e.loggedAt),
    ...data.journal.map((e) => e.loggedAt),
    ...data.hydration.map((e) => e.loggedAt),
  ].filter(Boolean);

  const sorted = allTimestamps.sort((a, b) => a - b);
  const toIso = (ts: number) => new Date(ts).toISOString().split("T")[0];

  return {
    totalSleepNights: data.sleep.length,
    totalExerciseSessions: data.exercise.length,
    totalMealsLogged: data.meals.length,
    totalMoodEntries: data.moods.length,
    totalJournalEntries: data.journal.length,
    totalHydrationLogs: data.hydration.length,
    totalHabits: data.habits.definitions.length,
    totalHabitEntries: data.habits.entries.length,
    earliestEntryDate: sorted.length > 0 ? toIso(sorted[0]) : null,
    latestEntryDate: sorted.length > 0 ? toIso(sorted[sorted.length - 1]) : null,
  };
}

export function buildExportPayload(): WellMateExport {
  const data: WellMateExport["data"] = {
    sleep: serializeSleep(),
    exercise: serializeExercise(),
    meals: serializeMeals(),
    moods: serializeMoods(),
    journal: serializeJournal(),
    hydration: serializeHydration(),
    habits: serializeHabits(),
  };

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "WellMate",
    profile: serializeProfile(),
    data,
    summary: computeSummary(data),
  };
}

export function getStorageBreakdown(): Record<string, number> {
  try {
    return {
      sleep: getAllLocalSleep().length,
      exercise: getAllLocalExercises().filter((e) => !e.deletedAt).length,
      meals: getAllLocalMeals().filter((m) => !m.deletedAt).length,
      moods: getAllLocalMoods().length,
      journal: getAllLocalJournalEntries().length,
      hydration: getAllLocalHydration().length,
      habits: (JSON.parse(localStorage.getItem("local_habits") ?? "[]") as LocalHabit[]).filter((h) => !h.archived).length,
      habitEntries: listAllEntries().length,
    };
  } catch {
    return {};
  }
}
