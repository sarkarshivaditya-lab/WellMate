// AI presence rules — determines when AI content is meaningful enough to show.
//
// Philosophy: "AI appears when meaningful continuity exists."
// Sparse, high-quality intelligence beats noisy AI presence.
//
// Rules are intentionally conservative — the AI should feel like it appears
// at the right moment, not constantly.

import { getAllLocalMoods } from "@/data/local/moodsStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import { getLongitudinalSummary } from "../memory/longitudinalSummary";

const SUPPRESSION_KEY = "ai_presence_suppressed_until";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Minimum data thresholds for meaningful AI presence
const MIN_MOOD_ENTRIES = 5;
const MIN_DATA_DAYS = 4;

export type PresenceDecision = {
  show: boolean;
  confidence: number;  // 0–1
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
  // Respect user dismissal
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
  const summary = getLongitudinalSummary();

  // Count unique days across mood + journal
  const allDays = [
    ...recentMoods.map((m) => m.dateIso),
    ...recentJournal.map((j) => j.dateIso),
  ];
  const dataDays = countUniqueDays(allDays);

  const dataPoints = {
    moodEntries: recentMoods.length,
    journalEntries: recentJournal.length,
    hasSummary: !!summary,
    dataDays,
  };

  // Not enough data for meaningful continuity
  if (recentMoods.length < MIN_MOOD_ENTRIES && recentJournal.length < 2) {
    return { show: false, confidence: 0, reason: "insufficient data", dataPoints };
  }

  if (dataDays < MIN_DATA_DAYS) {
    return { show: false, confidence: 0, reason: "insufficient data spread", dataPoints };
  }

  // Confidence: weighted by data richness
  const moodScore = Math.min(recentMoods.length / 20, 1) * 0.35;
  const journalScore = Math.min(recentJournal.length / 10, 1) * 0.35;
  const dayScore = Math.min(dataDays / 14, 1) * 0.15;
  const summaryBonus = summary ? 0.15 : 0;
  const confidence = Math.min(moodScore + journalScore + dayScore + summaryBonus, 1);

  return {
    show: confidence >= 0.2,
    confidence,
    reason: confidence >= 0.2 ? "meaningful continuity" : "low confidence",
    dataPoints,
  };
}

// Suppress AI surface for N hours (user dismissed)
export function suppressPresenceFor(hours: number): void {
  localStorage.setItem(SUPPRESSION_KEY, String(Date.now() + hours * 60 * 60 * 1000));
}

export function clearPresenceSuppression(): void {
  localStorage.removeItem(SUPPRESSION_KEY);
}
