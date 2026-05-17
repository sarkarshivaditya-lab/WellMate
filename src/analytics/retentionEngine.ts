// src/analytics/retentionEngine.ts

import { getDailySummaries } from "./dailySummaryStore";
import { getAggregates } from "./aggregateStore";
import type { DailySummary, RetentionMetrics, WellnessEntity } from "./types";

function weekBounds(ref: Date): { start: string; end: string } {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Sunday
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6); // Saturday
  return { start, end: d.toISOString().slice(0, 10) };
}

const ENTITY_FIELDS: Record<WellnessEntity, keyof DailySummary> = {
  meal:     "mealsLogged",
  sleep:    "sleepLogged",
  exercise: "exerciseLogged",
  mood:     "moodLogged",
  journal:  "journalEntries",
  habit:    "habitsCompleted",
  cycle:    "cycleLogged",
};

export function getRetentionMetrics(): RetentionMetrics {
  const summaries = getDailySummaries();
  const agg = getAggregates();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const last30Start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const thisWeek = weekBounds(today);
  const lastWeekDate = new Date(Date.now() - 7 * 86400000);
  const lastWeek = weekBounds(lastWeekDate);

  const activeDaysThisWeek = summaries.filter(
    (s) => s.date >= thisWeek.start && s.date <= thisWeek.end && s.totalActions > 0,
  ).length;

  const activeDaysLastWeek = summaries.filter(
    (s) => s.date >= lastWeek.start && s.date <= lastWeek.end && s.totalActions > 0,
  ).length;

  const last30Active = summaries.filter(
    (s) => s.date >= last30Start && s.date <= todayIso && s.totalActions > 0,
  );

  const activeDaysLast30 = last30Active.length;
  const totalActions = last30Active.reduce((sum, s) => sum + s.totalActions, 0);
  const avgActionsPerActiveDay =
    activeDaysLast30 > 0 ? Math.round((totalActions / activeDaysLast30) * 10) / 10 : 0;

  const featureCounts = agg.featureCounts;
  const topFeature =
    Object.keys(featureCounts).length > 0
      ? Object.keys(featureCounts).reduce((a, b) =>
          featureCounts[a] > featureCounts[b] ? a : b,
        )
      : null;

  const entityConsistency: Partial<Record<WellnessEntity, number>> = {};
  for (const [entity, field] of Object.entries(ENTITY_FIELDS) as [WellnessEntity, keyof DailySummary][]) {
    const count = last30Active.filter((s) => (s[field] as number) > 0).length;
    if (count > 0) entityConsistency[entity] = count;
  }

  return {
    activeDaysThisWeek,
    activeDaysLastWeek,
    activeDaysLast30,
    avgActionsPerActiveDay,
    topFeature,
    entityConsistency,
  };
}
