// src/search/searchIndex.ts
// Lightweight local-first search across all wellness data stores.
// All reads are synchronous from in-memory store snapshots — no network, no async.

import { getAllLocalMeals } from "@/data/local/mealsStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import { listHabits } from "@/data/local/habitsStore";
import type { SearchResult } from "./searchTypes";

const MOOD_LABELS: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "okay",
  4: "good",
  5: "great",
};

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function matchScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = normalize(haystack);
  const n = normalize(needle);
  if (h === n) return 1;
  if (h.startsWith(n)) return 0.9;
  // Word-boundary match scores higher than mid-word match
  const wordStart = h.split(" ").some((word) => word.startsWith(n));
  if (wordStart) return 0.8;
  const idx = h.indexOf(n);
  if (idx === -1) return 0;
  return 0.6 - (idx / h.length) * 0.2;
}

function bestScore(texts: string[], needle: string): number {
  return Math.max(...texts.map((t) => matchScore(t, needle)));
}

export function searchAll(query: string): SearchResult[] {
  const q = normalize(query);
  const results: SearchResult[] = [];
  const isFiltering = q.length > 0;

  // --- Meals ---
  for (const meal of getAllLocalMeals()) {
    if (meal.deletedAt) continue;
    const score = bestScore([meal.name], q);
    if (!isFiltering || score > 0) {
      results.push({
        id: `meal-${meal.id}`,
        module: "meal",
        title: meal.name,
        subtitle: `${meal.totalCalories} kcal · ${meal.dateIso}`,
        dateIso: meal.dateIso,
        timestamp: meal.createdAt,
        route: "/physical",
        score: isFiltering ? score : 0.5,
      });
    }
  }

  // --- Exercises ---
  for (const ex of getAllLocalExercises()) {
    if (ex.deletedAt) continue;
    const score = bestScore([ex.name, ex.type], q);
    if (!isFiltering || score > 0) {
      results.push({
        id: `ex-${ex.id}`,
        module: "exercise",
        title: ex.name,
        subtitle: `${ex.type} · ${ex.durationMinutes}min · ${ex.dateIso}`,
        dateIso: ex.dateIso,
        timestamp: ex.createdAt,
        route: "/physical",
        score: isFiltering ? score : 0.5,
      });
    }
  }

  // --- Sleep ---
  for (const s of getAllLocalSleep()) {
    const dateIso = s.startIso.split("T")[0];
    const hours = Math.round((s.durationMin / 60) * 10) / 10;
    const score = bestScore(["sleep", s.notes ?? ""], q);
    if (!isFiltering || score > 0) {
      results.push({
        id: `sleep-${s.localId}`,
        module: "sleep",
        title: `Sleep · ${hours}h`,
        subtitle: `Quality ${s.rating}/5 · ${dateIso}`,
        dateIso,
        timestamp: s.updatedAt,
        route: "/sleep",
        score: isFiltering ? score : 0.5,
      });
    }
  }

  // --- Moods ---
  for (const m of getAllLocalMoods()) {
    const label = MOOD_LABELS[m.moodValue] ?? "mood";
    const score = bestScore([label, m.note ?? "", "mood", "check-in"], q);
    if (!isFiltering || score > 0) {
      results.push({
        id: `mood-${m.localId}`,
        module: "mood",
        title: `Mood · ${label}`,
        subtitle: m.note ? m.note.slice(0, 60) : m.dateIso,
        dateIso: m.dateIso,
        timestamp: m.updatedAt,
        route: "/mental",
        score: isFiltering ? score : 0.5,
      });
    }
  }

  // --- Journal ---
  for (const j of getAllLocalJournalEntries()) {
    const score = bestScore([j.title ?? "", j.text, ...j.tags, "journal"], q);
    if (!isFiltering || score > 0) {
      results.push({
        id: `journal-${j.localId}`,
        module: "journal",
        title: j.title || j.text.slice(0, 50),
        subtitle: j.tags.length > 0 ? j.tags.join(", ") : j.dateIso,
        dateIso: j.dateIso,
        timestamp: j.createdAt,
        route: "/mental",
        score: isFiltering ? score : 0.5,
      });
    }
  }

  // --- Habits ---
  for (const h of listHabits()) {
    const score = bestScore([h.title, h.description ?? "", "habit"], q);
    if (!isFiltering || score > 0) {
      results.push({
        id: `habit-${h.localId}`,
        module: "habit",
        title: h.title,
        subtitle: h.description || h.cadence,
        timestamp: h.updatedAt,
        route: "/habits",
        score: isFiltering ? score : 0.5,
      });
    }
  }

  return results.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
}

export function getRecentActivity(limit = 12): SearchResult[] {
  return searchAll("")
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, limit);
}
