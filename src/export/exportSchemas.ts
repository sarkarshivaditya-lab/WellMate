// src/export/exportSchemas.ts
// Type contracts for WellMate data export. v1 format.
// Strips internal sync metadata — exports only user-meaningful fields.

export const EXPORT_VERSION = 1 as const;

export type ExportedProfile = {
  dob: string;
  sex: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string | null;
  goal: string | null;
  additionalHealthNotes?: string;
};

export type ExportedSleepEntry = {
  id: string;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  qualityRating: number;
  notes?: string;
  loggedAt: number;
};

export type ExportedExerciseEntry = {
  id: string;
  date: string;
  type: string;
  name: string;
  durationMinutes: number;
  caloriesEstimate: number;
  notes?: string;
  loggedAt: number;
};

export type ExportedMealEntry = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: number;
};

export type ExportedMoodEntry = {
  id: string;
  mood: string;
  moodValue: number;
  note?: string;
  loggedAt: number;
};

export type ExportedJournalEntry = {
  id: string;
  title?: string;
  body: string;
  wordCount: number;
  loggedAt: number;
};

export type ExportedHydrationEntry = {
  id: string;
  amountMl: number;
  cupsConsumed: number;
  loggedAt: number;
};

export type ExportedHabit = {
  id: string;
  title: string;
  description?: string;
  cadence: string;
  active: boolean;
  createdAt: number;
};

export type ExportedHabitEntry = {
  habitId: string;
  date: string;
  completed: boolean;
  note?: string;
};

export type ExportSummary = {
  totalSleepNights: number;
  totalExerciseSessions: number;
  totalMealsLogged: number;
  totalMoodEntries: number;
  totalJournalEntries: number;
  totalHydrationLogs: number;
  totalHabits: number;
  totalHabitEntries: number;
  earliestEntryDate: string | null;
  latestEntryDate: string | null;
};

export type WellMateExport = {
  exportVersion: typeof EXPORT_VERSION;
  exportedAt: string;
  app: "WellMate";
  profile: ExportedProfile | null;
  data: {
    sleep: ExportedSleepEntry[];
    exercise: ExportedExerciseEntry[];
    meals: ExportedMealEntry[];
    moods: ExportedMoodEntry[];
    journal: ExportedJournalEntry[];
    hydration: ExportedHydrationEntry[];
    habits: {
      definitions: ExportedHabit[];
      entries: ExportedHabitEntry[];
    };
  };
  summary: ExportSummary;
};
