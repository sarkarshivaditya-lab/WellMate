// src/analytics/aggregateStore.ts

import { safeRead, safeWrite } from "@/reliability/persistence";
import type { AggregateState } from "./types";

const STORAGE_KEY = "wellmate_analytics_agg_v1";

const DEFAULTS: AggregateState = {
  firstSeenDate: null,
  totalSessions: 0,
  totalActions: 0,
  currentStreak: 0,
  longestStreak: 0,
  onboardingCompleted: false,
  onboardingFirstSeenDate: null,
  onboardingCompletionDate: null,
  featureCounts: {},
  updatedAt: 0,
};

export function getAggregates(): AggregateState {
  const stored = safeRead<Partial<AggregateState>>(STORAGE_KEY, {});
  return { ...DEFAULTS, ...stored };
}

export function patchAggregates(patch: Partial<AggregateState>): void {
  safeWrite(STORAGE_KEY, { ...getAggregates(), ...patch, updatedAt: Date.now() });
}

export function incrementFeatureCount(feature: string): void {
  const agg = getAggregates();
  const counts = { ...agg.featureCounts, [feature]: (agg.featureCounts[feature] ?? 0) + 1 };
  safeWrite(STORAGE_KEY, { ...agg, featureCounts: counts, updatedAt: Date.now() });
}

export function incrementTotals(sessions: number, actions: number): void {
  const agg = getAggregates();
  patchAggregates({
    firstSeenDate: agg.firstSeenDate ?? new Date().toISOString().slice(0, 10),
    totalSessions: agg.totalSessions + sessions,
    totalActions: agg.totalActions + actions,
  });
}

export function recomputeStreak(activeDates: string[]): void {
  if (activeDates.length === 0) {
    patchAggregates({ currentStreak: 0 });
    return;
  }

  const sorted = [...activeDates].sort((a, b) => b.localeCompare(a)); // descending
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak must include today or yesterday to be live
  if (sorted[0] !== today && sorted[0] !== yesterday) {
    patchAggregates({ currentStreak: 0 });
    return;
  }

  let streak = 0;
  let cursor = sorted[0];
  for (const date of sorted) {
    if (date === cursor) {
      streak++;
      const d = new Date(cursor + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  const agg = getAggregates();
  patchAggregates({ currentStreak: streak, longestStreak: Math.max(streak, agg.longestStreak) });
}
