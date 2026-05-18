// src/export/portableSummaryGenerator.ts
// Generates a human-readable plain-text wellness summary from export data.
// Designed to be readable without any app — suitable for printing or sharing.

import type { WellMateExport } from "./exportSchemas";

function formatDate(isoOrTs: string | number | null): string {
  if (!isoOrTs) return "unknown";
  const d = new Date(isoOrTs);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function line(label: string, value: string): string {
  return `  ${label.padEnd(26)} ${value}`;
}

export function generatePortableSummary(payload: WellMateExport): string {
  const { summary, data, profile, exportedAt } = payload;
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════");
  lines.push("  WELLMATE — WELLNESS DATA EXPORT");
  lines.push("═══════════════════════════════════════════════════");
  lines.push(`  Exported: ${formatDate(exportedAt)}`);
  if (summary.earliestEntryDate) {
    lines.push(`  Data from: ${formatDate(summary.earliestEntryDate)} → ${formatDate(summary.latestEntryDate)}`);
  }
  lines.push("");

  // Profile
  if (profile) {
    lines.push("─── PROFILE ──────────────────────────────────────");
    if (profile.dob) lines.push(line("Date of birth:", profile.dob));
    if (profile.sex) lines.push(line("Biological sex:", profile.sex));
    if (profile.heightCm) lines.push(line("Height:", `${profile.heightCm} cm`));
    if (profile.weightKg) lines.push(line("Weight:", `${profile.weightKg} kg`));
    if (profile.activityLevel) lines.push(line("Activity level:", profile.activityLevel));
    if (profile.goal) lines.push(line("Goal:", profile.goal));
    lines.push("");
  }

  // Overview
  lines.push("─── DATA OVERVIEW ────────────────────────────────");
  lines.push(line("Sleep nights:", String(summary.totalSleepNights)));
  lines.push(line("Exercise sessions:", String(summary.totalExerciseSessions)));
  lines.push(line("Meals logged:", String(summary.totalMealsLogged)));
  lines.push(line("Mood entries:", String(summary.totalMoodEntries)));
  lines.push(line("Journal entries:", String(summary.totalJournalEntries)));
  lines.push(line("Hydration logs:", String(summary.totalHydrationLogs)));
  lines.push(line("Habits tracked:", String(summary.totalHabits)));
  lines.push(line("Habit completions:", String(summary.totalHabitEntries)));
  lines.push("");

  // Sleep
  if (data.sleep.length > 0) {
    lines.push("─── SLEEP ────────────────────────────────────────");
    const durations = data.sleep.map((s) => s.durationMinutes);
    const avgDur = avg(durations);
    const avgH = Math.floor(avgDur / 60);
    const avgM = Math.round(avgDur % 60);
    lines.push(line("Average duration:", `${avgH}h ${avgM}m`));
    const ratings = data.sleep.map((s) => s.qualityRating);
    lines.push(line("Average quality:", `${avg(ratings).toFixed(1)} / 5`));
    lines.push("");
  }

  // Exercise
  if (data.exercise.length > 0) {
    lines.push("─── EXERCISE ─────────────────────────────────────");
    const totalMins = data.exercise.reduce((s, e) => s + e.durationMinutes, 0);
    const totalH = Math.floor(totalMins / 60);
    const totalM = totalMins % 60;
    lines.push(line("Total active time:", `${totalH}h ${totalM}m`));
    const types: Record<string, number> = {};
    data.exercise.forEach((e) => {
      types[e.type] = (types[e.type] ?? 0) + 1;
    });
    const topTypes = Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, n]) => `${t} (×${n})`)
      .join(", ");
    if (topTypes) lines.push(line("Top activities:", topTypes));
    lines.push("");
  }

  // Nutrition
  if (data.meals.length > 0) {
    lines.push("─── NUTRITION ────────────────────────────────────");
    const cals = data.meals.map((m) => m.calories);
    lines.push(line("Avg calories/meal:", `${Math.round(avg(cals))} kcal`));
    const totalCal = cals.reduce((a, b) => a + b, 0);
    lines.push(line("Total calories logged:", `${totalCal.toLocaleString()} kcal`));
    lines.push("");
  }

  // Mood
  if (data.moods.length > 0) {
    lines.push("─── MOOD ─────────────────────────────────────────");
    const moodCounts: Record<string, number> = {};
    data.moods.forEach((m) => {
      moodCounts[m.mood] = (moodCounts[m.mood] ?? 0) + 1;
    });
    const avgMood = avg(data.moods.map((m) => m.moodValue));
    lines.push(line("Average mood:", `${avgMood.toFixed(1)} / 5`));
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    if (topMood) lines.push(line("Most common mood:", `${topMood[0]} (${topMood[1]}×)`));
    lines.push("");
  }

  // Journal
  if (data.journal.length > 0) {
    lines.push("─── JOURNAL ──────────────────────────────────────");
    const totalWords = data.journal.reduce((s, j) => s + j.wordCount, 0);
    lines.push(line("Total entries:", String(data.journal.length)));
    lines.push(line("Total words written:", totalWords.toLocaleString()));
    lines.push(line("Avg words/entry:", String(Math.round(totalWords / data.journal.length))));
    lines.push("");
  }

  // Habits
  if (data.habits.definitions.length > 0) {
    lines.push("─── HABITS ───────────────────────────────────────");
    data.habits.definitions.forEach((h) => {
      const entries = data.habits.entries.filter(
        (e) => e.habitId === h.id && e.completed,
      );
      lines.push(line(`  ${h.title}:`, `${entries.length} completions`));
    });
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════");
  lines.push("  Your data belongs to you.");
  lines.push("  WellMate stores everything locally on your device.");
  lines.push("═══════════════════════════════════════════════════");

  return lines.join("\n");
}
