// Longitudinal memory summaries — weekly rolling snapshots of wellness state.
// Stored in localStorage with a 7-day generation TTL.
// Injected into inference context as compressed longitudinal memory.

import { safeRead, safeWrite } from "@/reliability/persistence";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalSleep } from "@/data/local/sleepStore";
import { listAllHabits, listAllEntries } from "@/data/local/habitsStore";
import type { LocalHabit, LocalHabitEntry } from "@/data/local/habitsStore";

const SUMMARY_KEY = "ai_longitudinal_summary_v1";
const SUMMARY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type LongitudinalSummary = {
  generatedAt: number;
  weekWindow: string;
  moodSentence: string;
  sleepSentence: string;
  habitSentence: string;
  journalHighlight: string;
  overallWellnessSentence: string;
};

const MOOD_LABELS: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "neutral",
  4: "good",
  5: "great",
};

export function getLongitudinalSummary(): LongitudinalSummary | null {
  return safeRead<LongitudinalSummary | null>(SUMMARY_KEY, null);
}

export function isSummaryStale(): boolean {
  const s = getLongitudinalSummary();
  if (!s) return true;
  return Date.now() - s.generatedAt > SUMMARY_TTL_MS;
}

export function generateLongitudinalSummary(): LongitudinalSummary {
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const weekStart = new Date(weekAgo).toISOString().slice(0, 10);
  const weekEnd = new Date(now).toISOString().slice(0, 10);

  // ── Mood ─────────────────────────────────────────────────────────────────────
  const moods = getAllLocalMoods().filter((m) => m.updatedAt >= weekAgo);
  let moodSentence = "No mood data recorded this week.";
  if (moods.length > 0) {
    const avg = moods.reduce((s, m) => s + m.moodValue, 0) / moods.length;
    const label = MOOD_LABELS[Math.round(avg)] ?? "neutral";
    moodSentence = `Average mood this week: ${label} (${avg.toFixed(1)}/5) across ${moods.length} tracked days.`;
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────────
  const sleep = getAllLocalSleep().filter((s) => s.updatedAt >= weekAgo);
  let sleepSentence = "No sleep data logged this week.";
  if (sleep.length > 0) {
    const avgMin = sleep.reduce((s, l) => s + l.durationMin, 0) / sleep.length;
    const hours = (avgMin / 60).toFixed(1);
    sleepSentence = `Average sleep: ${hours} hours/night across ${sleep.length} logged nights this week.`;
  }

  // ── Habits ────────────────────────────────────────────────────────────────────
  const habits = listAllHabits().filter((h) => !h.archived);
  const allEntries = listAllEntries();
  const habitSentence = buildHabitSentence(habits, allEntries, weekAgo);

  // ── Journal highlight ─────────────────────────────────────────────────────────
  const journals = getAllLocalJournalEntries()
    .filter((e) => e.createdAt >= weekAgo)
    .sort((a, b) => b.createdAt - a.createdAt);

  let journalHighlight = "No journal entries this week.";
  if (journals.length > 0) {
    const latest = journals[0];
    const snippet = latest.text.slice(0, 120).replace(/\n/g, " ");
    journalHighlight =
      `${journals.length} journal entr${journals.length === 1 ? "y" : "ies"} this week. ` +
      `Most recent (${latest.dateIso}): "${snippet}${latest.text.length > 120 ? "…" : ""}"`;
  }

  // ── Overall ───────────────────────────────────────────────────────────────────
  const avgMood =
    moods.length > 0
      ? moods.reduce((s, m) => s + m.moodValue, 0) / moods.length
      : null;
  const avgSleepMin =
    sleep.length > 0
      ? sleep.reduce((s, l) => s + l.durationMin, 0) / sleep.length
      : null;
  const overallWellnessSentence = buildOverallSentence(avgMood, avgSleepMin);

  const summary: LongitudinalSummary = {
    generatedAt: now,
    weekWindow: `${weekStart} → ${weekEnd}`,
    moodSentence,
    sleepSentence,
    habitSentence,
    journalHighlight,
    overallWellnessSentence,
  };

  safeWrite(SUMMARY_KEY, summary);
  return summary;
}

export function serializeSummaryForPrompt(summary: LongitudinalSummary): string {
  return [
    `[Weekly wellness summary: ${summary.weekWindow}]`,
    summary.overallWellnessSentence,
    summary.moodSentence,
    summary.sleepSentence,
    summary.habitSentence,
    summary.journalHighlight,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildHabitSentence(
  habits: LocalHabit[],
  entries: LocalHabitEntry[],
  cutoff: number,
): string {
  if (habits.length === 0) return "No habits being tracked.";

  const completedThisWeek = new Set(
    entries
      .filter((e) => e.updatedAt >= cutoff && e.completed)
      .map((e) => e.habitLocalId),
  );

  const activeCount = completedThisWeek.size;
  const totalCount = habits.length;

  if (activeCount === 0) {
    return `${totalCount} habit${totalCount !== 1 ? "s" : ""} tracked — none completed this week.`;
  }
  if (activeCount === totalCount) {
    return `All ${totalCount} tracked habit${totalCount !== 1 ? "s" : ""} completed at least once this week.`;
  }
  return `${activeCount} of ${totalCount} tracked habit${totalCount !== 1 ? "s" : ""} completed this week.`;
}

function buildOverallSentence(
  avgMood: number | null,
  avgSleepMin: number | null,
): string {
  const signals: string[] = [];

  if (avgMood !== null) {
    if (avgMood < 2.5) signals.push("mood has been low this week");
    else if (avgMood > 3.8) signals.push("mood has been positive this week");
  }

  if (avgSleepMin !== null) {
    const hours = avgSleepMin / 60;
    if (hours < 6) signals.push("sleep has been below recommended levels");
    else if (hours >= 7.5) signals.push("sleep has been solid");
  }

  if (signals.length === 0) {
    return "Overall wellness state this week: mixed or insufficient data.";
  }
  return `Overall this week: ${signals.join("; ")}.`;
}
