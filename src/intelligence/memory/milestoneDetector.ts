// src/intelligence/memory/milestoneDetector.ts
// Sparse, meaningful milestone detection.
// Milestones are calm observations — not gamified achievements.
// Each milestone fires once and is accumulated across sessions.

import { computeWindowMetrics, dateIsoNDaysAgo, todayIso } from "./temporalAnalysis";
import type { WellnessMilestone } from "./types";

function makeId(domain: string, key: string): string {
  return `milestone_${domain}_${key}`;
}

// Detects new milestones not already in existingIds.
// Pass existing milestone IDs to prevent re-detection.
export function detectMilestones(existingIds: Set<string>): WellnessMilestone[] {
  const milestones: WellnessMilestone[] = [];
  const today = todayIso();

  const recent = computeWindowMetrics(dateIsoNDaysAgo(29), today);
  const longTerm = computeWindowMetrics(dateIsoNDaysAgo(89), today);

  // ── First stable sleep month ──────────────────────────────────────────────
  // Consistency ≥ 75/100 with at least 20 logged nights.
  const sleepStableId = makeId("sleep", "first_stable_month");
  if (!existingIds.has(sleepStableId)) {
    if (recent.sleep.bedtimeConsistencyScore >= 75 && recent.sleep.nightsLogged >= 20) {
      milestones.push({
        id: sleepStableId,
        domain: "sleep",
        detectedAt: today,
        headline: "A full month of consistent sleep timing.",
        detail: "Bedtime patterns have been notably regular — a foundation for better rest.",
        confidence: "high",
        relatedDomains: ["sleep"],
      });
    }
  }

  // ── Sustained habit follow-through ───────────────────────────────────────
  // 70%+ completion rate with at least 20 completed entries in 30 days.
  const habitSustainedId = makeId("habits", "sustained_month");
  if (!existingIds.has(habitSustainedId)) {
    if (recent.habits.completionRate >= 70 && recent.habits.totalCompleted >= 20) {
      milestones.push({
        id: habitSustainedId,
        domain: "habits",
        detectedAt: today,
        headline: "A strong month of habit follow-through.",
        detail: `${recent.habits.completionRate}% completion this month.`,
        confidence: "medium",
        relatedDomains: ["habits"],
      });
    }
  }

  // ── Three months of consistent activity with stable recovery ─────────────
  const recoveryId = makeId("activity", "recovery_strength_90d");
  if (!existingIds.has(recoveryId)) {
    if (
      longTerm.activity.activeDays >= 30 &&
      longTerm.sleep.avgQuality >= 3.2 &&
      longTerm.sleep.nightsLogged >= 40
    ) {
      milestones.push({
        id: recoveryId,
        domain: "activity",
        detectedAt: today,
        headline: "Three months of consistent activity with stable recovery.",
        confidence: "medium",
        relatedDomains: ["activity", "sleep"],
      });
    }
  }

  // ── Consistent hydration month ────────────────────────────────────────────
  const hydrationId = makeId("hydration", "consistent_month");
  if (!existingIds.has(hydrationId)) {
    if (recent.hydration.avgCupsPerDay >= 6 && recent.hydration.daysLogged >= 20) {
      milestones.push({
        id: hydrationId,
        domain: "hydration",
        detectedAt: today,
        headline: "A month of consistent hydration.",
        confidence: "medium",
        relatedDomains: ["hydration"],
      });
    }
  }

  // ── Stable mood month ─────────────────────────────────────────────────────
  const moodStableId = makeId("mood", "stable_month");
  if (!existingIds.has(moodStableId)) {
    if (
      recent.mood.entriesLogged >= 15 &&
      recent.mood.volatility < 0.8 &&
      recent.mood.avgMood >= 3.0
    ) {
      milestones.push({
        id: moodStableId,
        domain: "mood",
        detectedAt: today,
        headline: "A notably stable month emotionally.",
        confidence: "medium",
        relatedDomains: ["mood"],
      });
    }
  }

  // ── First 90 days of data ─────────────────────────────────────────────────
  const longevityId = makeId("composite", "first_90d");
  if (!existingIds.has(longevityId)) {
    const totalEntries =
      longTerm.sleep.nightsLogged +
      longTerm.activity.sessionsLogged +
      longTerm.nutrition.daysLogged +
      longTerm.mood.entriesLogged;
    if (totalEntries >= 30) {
      milestones.push({
        id: longevityId,
        domain: "composite",
        detectedAt: today,
        headline: "Three months of wellness tracking.",
        detail: "A sustained record is the foundation for meaningful longitudinal patterns.",
        confidence: "high",
        relatedDomains: ["sleep", "activity", "nutrition", "mood"],
      });
    }
  }

  return milestones;
}
