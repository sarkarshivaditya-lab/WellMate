// src/analytics/dailySummaryStore.ts

import { safeRead, safeWrite } from "@/reliability/persistence";
import type { DailySummary, WellnessEntity } from "./types";

const STORAGE_KEY = "wellmate_daily_summaries_v1";
const MAX_DAYS = 90;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): DailySummary[] {
  return safeRead<DailySummary[]>(STORAGE_KEY, []);
}

function getOrCreate(summaries: DailySummary[], date: string): [DailySummary, boolean] {
  const existing = summaries.find((s) => s.date === date);
  if (existing) return [{ ...existing }, false];
  return [
    {
      date,
      sessionCount: 0,
      totalActions: 0,
      mealsLogged: 0,
      sleepLogged: 0,
      exerciseLogged: 0,
      habitsCompleted: 0,
      moodLogged: 0,
      journalEntries: 0,
      cycleLogged: 0,
      featuresOpened: [],
    },
    true,
  ];
}

function persist(summaries: DailySummary[]): void {
  const sorted = [...summaries].sort((a, b) => a.date.localeCompare(b.date));
  safeWrite(STORAGE_KEY, sorted.slice(-MAX_DAYS));
}

function mutateToday(fn: (today: DailySummary) => void): void {
  const summaries = load();
  const date = todayIso();
  const [today, isNew] = getOrCreate(summaries, date);
  fn(today);
  if (isNew) {
    persist([...summaries, today]);
  } else {
    persist(summaries.map((s) => (s.date === date ? today : s)));
  }
}

export function getDailySummaries(): DailySummary[] {
  return load();
}

export function getTodaySummary(): DailySummary | null {
  return load().find((s) => s.date === todayIso()) ?? null;
}

export function recordSessionStart(): void {
  mutateToday((s) => { s.sessionCount++; });
}

export function recordWellnessAction(entity: WellnessEntity): void {
  mutateToday((s) => {
    s.totalActions++;
    switch (entity) {
      case "meal":     s.mealsLogged++;     break;
      case "sleep":    s.sleepLogged++;     break;
      case "exercise": s.exerciseLogged++;  break;
      case "mood":     s.moodLogged++;      break;
      case "journal":  s.journalEntries++;  break;
      case "habit":    s.habitsCompleted++; break;
      case "cycle":    s.cycleLogged++;     break;
    }
  });
}

export function recordFeatureOpen(feature: string): void {
  mutateToday((s) => {
    if (!s.featuresOpened.includes(feature)) {
      s.featuresOpened = [...s.featuresOpened, feature];
    }
  });
}
