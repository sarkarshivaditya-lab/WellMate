import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";

const SUPPRESSION_KEY = "ai_presence_suppressed_until";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_MOOD_ENTRIES = 5;
const MIN_DATA_DAYS = 4;

export type PresenceDecision = {
  show: boolean;
  confidence: number;
  reason: string;
  dataPoints: {
    moodEntries: number;
    journalEntries: number;
    hasSummary: boolean;
    dataDays: number;
  };
};

function countUniqueDays(isoStrings: string[]): number {
  return new Set(isoStrings).size;
}

export function evaluatePresence(): PresenceDecision {
  const suppressedUntil = localStorage.getItem(SUPPRESSION_KEY);
  if (suppressedUntil && Date.now() < Number(suppressedUntil)) {
    return {
      show: false,
      confidence: 0,
      reason: "suppressed",
      dataPoints: { moodEntries: 0, journalEntries: 0, hasSummary: false, dataDays: 0 },
    };
  }

  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const recentMoods = getAllLocalMoods().filter((m) => m.updatedAt > cutoff);
  const recentJournal = getAllLocalJournalEntries().filter((j) => j.createdAt > cutoff);
  const dataDays = countUniqueDays([
    ...recentMoods.map((m) => m.dateIso),
    ...recentJournal.map((j) => j.dateIso),
  ]);
  const dataPoints = {
    moodEntries: recentMoods.length,
    journalEntries: recentJournal.length,
    hasSummary: false,
    dataDays,
  };

  if (recentMoods.length < MIN_MOOD_ENTRIES && recentJournal.length < 2) {
    return { show: false, confidence: 0, reason: "insufficient data", dataPoints };
  }
  if (dataDays < MIN_DATA_DAYS) {
    return { show: false, confidence: 0, reason: "insufficient data spread", dataPoints };
  }

  const moodScore = Math.min(recentMoods.length / 20, 1) * 0.45;
  const journalScore = Math.min(recentJournal.length / 10, 1) * 0.40;
  const dayScore = Math.min(dataDays / 14, 1) * 0.15;
  const confidence = Math.min(moodScore + journalScore + dayScore, 1);
  return {
    show: confidence >= 0.2,
    confidence,
    reason: confidence >= 0.2 ? "meaningful continuity" : "low confidence",
    dataPoints,
  };
}

export function suppressPresenceFor(hours: number): void {
  localStorage.setItem(SUPPRESSION_KEY, String(Date.now() + hours * 60 * 60 * 1000));
}

export function clearPresenceSuppression(): void {
  localStorage.removeItem(SUPPRESSION_KEY);
}
