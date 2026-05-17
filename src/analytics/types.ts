// src/analytics/types.ts

export type WellnessEntity =
  | "meal"
  | "sleep"
  | "exercise"
  | "mood"
  | "journal"
  | "habit"
  | "cycle";

export type FeatureName =
  | "physical"
  | "mental"
  | "sleep"
  | "habits"
  | "journal"
  | "nutrition"
  | "ai_coach"
  | "ai_mental_coach"
  | "profile"
  | "dashboard";

export type AnalyticsEvent =
  | { type: "session_started"; sessionId: string; ts: number }
  | { type: "session_ended"; sessionId: string; depthActions: number; durationMs: number; ts: number }
  | { type: "session_resumed"; sessionId: string; awayMs: number; ts: number }
  | { type: "session_backgrounded"; sessionId: string; ts: number }
  | { type: "wellness_logged"; entity: WellnessEntity; ts: number }
  | { type: "feature_opened"; feature: FeatureName; ts: number }
  | { type: "onboarding_completed"; ts: number }
  | { type: "connectivity_restored"; ts: number }
  | { type: "connectivity_lost"; ts: number };

export type DailySummary = {
  date: string;             // YYYY-MM-DD
  sessionCount: number;
  totalActions: number;
  mealsLogged: number;
  sleepLogged: number;
  exerciseLogged: number;
  habitsCompleted: number;
  moodLogged: number;
  journalEntries: number;
  cycleLogged: number;
  featuresOpened: string[]; // unique feature names opened today
};

export type AggregateState = {
  firstSeenDate: string | null;
  totalSessions: number;
  totalActions: number;
  currentStreak: number;
  longestStreak: number;
  onboardingCompleted: boolean;
  onboardingFirstSeenDate: string | null;
  onboardingCompletionDate: string | null;
  featureCounts: Record<string, number>;
  updatedAt: number;
};

export type RetentionMetrics = {
  activeDaysThisWeek: number;
  activeDaysLastWeek: number;
  activeDaysLast30: number;
  avgActionsPerActiveDay: number;
  topFeature: string | null;
  entityConsistency: Partial<Record<WellnessEntity, number>>; // days/last30 per entity
};

export type AnalyticsSnapshot = {
  today: DailySummary | null;
  aggregates: AggregateState;
  retention: RetentionMetrics;
  sessionDepth: number;
  sessionDurationMs: number;
};
