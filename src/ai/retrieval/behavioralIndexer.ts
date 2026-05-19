// Behavioral indexing — encodes habit patterns, mood trends, and sleep data
// as semantic vector entries. Indexed as aggregate summaries (per mood/sleep entry
// individually, but habits as one aggregate per habit) to surface behavioral
// patterns without flooding the vector store.

import { embedText, isEmbeddingReady } from "../embeddings/embeddingPipeline";
import { upsertVectorEntry } from "../embeddings/vectorStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalSleep } from "@/data/local/sleepStore";
import { listAllHabits, listAllEntries } from "@/data/local/habitsStore";

const WINDOW_DAYS = 30;

const MOOD_LABELS: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "neutral",
  4: "good",
  5: "great",
};

// ── Mood indexing ─────────────────────────────────────────────────────────────

export async function indexMoodHistory(): Promise<void> {
  if (!isEmbeddingReady()) return;

  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
  const recent = getAllLocalMoods()
    .filter((m) => m.updatedAt >= cutoff)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  if (recent.length === 0) return;

  // Index each mood entry individually — emotionally salient, small footprint
  for (const mood of recent) {
    const label = MOOD_LABELS[mood.moodValue] ?? String(mood.moodValue);
    const text = mood.note
      ? `Mood on ${mood.dateIso}: ${label} (${mood.moodValue}/5). Note: "${mood.note}"`
      : `Mood on ${mood.dateIso}: ${label} (${mood.moodValue}/5).`;

    try {
      const embedding = Array.from(await embedText(text));
      await upsertVectorEntry({
        id: `mood_${mood.localId}`,
        scope: "mood_history",
        text,
        embedding,
        timestamp: mood.updatedAt,
        metadata: {
          dateIso: mood.dateIso,
          moodValue: mood.moodValue,
          hasNote: mood.note !== undefined,
        },
      });
    } catch {
      // Non-fatal — continue
    }
  }

  // Aggregate trend summary — high-level context for the AI
  const avg = recent.reduce((s, m) => s + m.moodValue, 0) / recent.length;
  const lowCount = recent.filter((m) => m.moodValue <= 2).length;
  const highCount = recent.filter((m) => m.moodValue >= 4).length;
  const trendText =
    `Mood summary for the past ${recent.length} tracked days: ` +
    `average mood ${avg.toFixed(1)}/5. ` +
    `${highCount} good/great days, ${lowCount} low/very-low days.`;

  try {
    const embedding = Array.from(await embedText(trendText));
    await upsertVectorEntry({
      id: "mood_trend_summary",
      scope: "mood_history",
      text: trendText,
      embedding,
      timestamp: Date.now(),
      metadata: {
        avgMood: parseFloat(avg.toFixed(2)),
        lowCount,
        highCount,
        windowDays: WINDOW_DAYS,
      },
    });
  } catch {
    // Non-fatal
  }
}

// ── Sleep indexing ────────────────────────────────────────────────────────────

export async function indexSleepHistory(): Promise<void> {
  if (!isEmbeddingReady()) return;

  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
  const recent = getAllLocalSleep()
    .filter((s) => s.updatedAt >= cutoff)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  if (recent.length === 0) return;

  const avgDuration =
    recent.reduce((s, l) => s + l.durationMin, 0) / recent.length;
  const avgRating =
    recent.reduce((s, l) => s + l.rating, 0) / recent.length;
  const hours = (avgDuration / 60).toFixed(1);

  const text =
    `Sleep summary for the past ${recent.length} logged nights: ` +
    `average ${hours} hours per night, average rating ${avgRating.toFixed(1)}/5.`;

  try {
    const embedding = Array.from(await embedText(text));
    await upsertVectorEntry({
      id: "sleep_trend_summary",
      scope: "sleep_history",
      text,
      embedding,
      timestamp: Date.now(),
      metadata: {
        avgDurationMin: parseFloat(avgDuration.toFixed(1)),
        avgRating: parseFloat(avgRating.toFixed(2)),
        windowDays: WINDOW_DAYS,
      },
    });
  } catch {
    // Non-fatal
  }
}

// ── Habit indexing ────────────────────────────────────────────────────────────

export async function indexHabitPatterns(): Promise<void> {
  if (!isEmbeddingReady()) return;

  const habits = listAllHabits().filter((h) => !h.archived);
  if (habits.length === 0) return;

  const allEntries = listAllEntries();
  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;

  for (const habit of habits) {
    const recentCompletions = allEntries.filter(
      (e) => e.habitLocalId === habit.localId && e.updatedAt >= cutoff && e.completed,
    );
    if (recentCompletions.length === 0) continue;

    const text =
      `Habit "${habit.title}" — completed ${recentCompletions.length} times in the past ${WINDOW_DAYS} days.` +
      (habit.description ? ` Goal: ${habit.description}.` : "");

    try {
      const embedding = Array.from(await embedText(text));
      await upsertVectorEntry({
        id: `habit_${habit.localId}`,
        scope: "habit_history",
        text,
        embedding,
        timestamp: Date.now(),
        metadata: {
          habitId: habit.localId,
          habitTitle: habit.title,
          completionCount: recentCompletions.length,
          windowDays: WINDOW_DAYS,
        },
      });
    } catch {
      // Non-fatal
    }
  }
}

// ── Composite bootstrap ───────────────────────────────────────────────────────

export async function bootstrapBehavioralIndex(): Promise<void> {
  await indexMoodHistory();
  await indexSleepHistory();
  await indexHabitPatterns();
}
