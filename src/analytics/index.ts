// src/analytics/index.ts

import { subscribeToAnalytics, emitAnalyticsEvent } from "./eventBus";
import {
  initSessionTracker,
  getCurrentSessionDepth,
  getCurrentSessionDurationMs,
} from "./sessionTracker";
import {
  recordSessionStart,
  recordWellnessAction,
  recordFeatureOpen,
  getDailySummaries,
  getTodaySummary,
} from "./dailySummaryStore";
import {
  getAggregates,
  incrementFeatureCount,
  incrementTotals,
  patchAggregates,
  recomputeStreak,
} from "./aggregateStore";
import { getRetentionMetrics } from "./retentionEngine";
import {
  getOnboardingState,
  recordOnboardingFirstSeen,
  recordOnboardingCompletion,
} from "./onboardingFunnel";
import type { AnalyticsEvent, AnalyticsSnapshot } from "./types";

// Public re-exports
export { emitAnalyticsEvent } from "./eventBus";
export { subscribeToAnalytics } from "./eventBus";
export { trackFeatureOpen, useFeatureTracker } from "./featureTracker";
export { getDailySummaries, getTodaySummary } from "./dailySummaryStore";
export { getRetentionMetrics } from "./retentionEngine";
export { getOnboardingState } from "./onboardingFunnel";
export type {
  FeatureName,
  WellnessEntity,
  AnalyticsSnapshot,
  DailySummary,
  AggregateState,
  RetentionMetrics,
} from "./types";

/* --------------------------------------------------
   EVENT HANDLER
   -------------------------------------------------- */

function handleAnalyticsEvent(event: AnalyticsEvent): void {
  switch (event.type) {
    case "session_started":
      recordSessionStart();
      incrementTotals(1, 0);
      recomputeStreak(
        getDailySummaries()
          .filter((s) => s.totalActions > 0)
          .map((s) => s.date),
      );
      recordOnboardingFirstSeen();
      // Check if onboarding was completed in a prior session (retroactive)
      if (localStorage.getItem("onboarded") === "true") {
        const agg = getAggregates();
        if (!agg.onboardingCompleted) {
          emitAnalyticsEvent({ type: "onboarding_completed", ts: Date.now() });
        }
      }
      break;

    case "wellness_logged":
      recordWellnessAction(event.entity);
      incrementTotals(0, 1);
      break;

    case "feature_opened":
      recordFeatureOpen(event.feature);
      incrementFeatureCount(event.feature);
      break;

    case "onboarding_completed":
      recordOnboardingCompletion();
      break;
  }
}

/* --------------------------------------------------
   INIT
   -------------------------------------------------- */

let initialized = false;
let disposeSession: (() => void) | null = null;

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  // Subscribe internal handler to the event bus
  subscribeToAnalytics(handleAnalyticsEvent);

  // Start session tracking (hooks into lifecycleCoordinator)
  disposeSession = initSessionTracker();

  // Retroactively mark onboarding completed if already done before analytics existed
  if (localStorage.getItem("onboarded") === "true") {
    const agg = getAggregates();
    if (!agg.onboardingCompleted) {
      patchAggregates({ onboardingCompleted: true });
    }
  }
}

export function disposeAnalytics(): void {
  disposeSession?.();
  disposeSession = null;
  initialized = false;
}

export function getAnalyticsSnapshot(): AnalyticsSnapshot {
  return {
    today: getTodaySummary(),
    aggregates: getAggregates(),
    retention: getRetentionMetrics(),
    sessionDepth: getCurrentSessionDepth(),
    sessionDurationMs: getCurrentSessionDurationMs(),
  };
}
