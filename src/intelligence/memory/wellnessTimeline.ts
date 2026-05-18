// src/intelligence/memory/wellnessTimeline.ts
// Stitches cross-domain wellness activity into a day-resolution timeline.
// Foundation for future timeline UI surfaces.

import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalMeals } from "@/data/local/mealsStore";
import { listAllEntries } from "@/data/local/habitsStore";
import { getAllLocalHydration } from "@/data/local/hydrationStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import type { TimelineEntry, MemoryDomain } from "./types";

// Builds timeline entries for a given date range (inclusive, ISO dates).
// Each entry records which domains had at least one logged entry on that day.
export function buildTimeline(windowStart: string, windowEnd: string): TimelineEntry[] {
  const activity = new Map<string, Partial<Record<MemoryDomain, boolean>>>();

  function mark(dateIso: string, domain: MemoryDomain) {
    if (!dateIso || dateIso < windowStart || dateIso > windowEnd) return;
    if (!activity.has(dateIso)) activity.set(dateIso, {});
    activity.get(dateIso)![domain] = true;
  }

  for (const s of getAllLocalSleep()) {
    mark(s.startIso.slice(0, 10), "sleep");
  }
  for (const e of getAllLocalExercises()) {
    if (!e.deletedAt) mark(e.dateIso, "activity");
  }
  for (const m of getAllLocalMoods()) {
    mark(m.dateIso, "mood");
  }
  for (const m of getAllLocalMeals()) {
    if (!m.deletedAt) mark(m.dateIso, "nutrition");
  }
  for (const e of listAllEntries()) {
    if (e.completed) mark(e.dateIso, "habits");
  }
  for (const h of getAllLocalHydration()) {
    mark(h.dateIso, "hydration");
  }
  for (const j of getAllLocalJournalEntries()) {
    mark(j.dateIso, "journal");
  }

  return [...activity.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateIso, domainActivity]) => ({ dateIso, domainActivity }));
}

// Returns entries where at least `minDomains` distinct domains were active.
// Useful for identifying "high-engagement" days in a timeline UI.
export function findHighEngagementDays(
  timeline: TimelineEntry[],
  minDomains = 3
): TimelineEntry[] {
  return timeline.filter(
    (entry) => Object.keys(entry.domainActivity).length >= minDomains
  );
}

// Returns the count of days each domain was active within the timeline.
export function domainActivityCounts(
  timeline: TimelineEntry[]
): Partial<Record<MemoryDomain, number>> {
  const counts: Partial<Record<MemoryDomain, number>> = {};
  for (const entry of timeline) {
    for (const domain of Object.keys(entry.domainActivity) as MemoryDomain[]) {
      counts[domain] = (counts[domain] ?? 0) + 1;
    }
  }
  return counts;
}
