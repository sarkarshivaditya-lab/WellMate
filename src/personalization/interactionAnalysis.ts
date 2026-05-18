// src/personalization/interactionAnalysis.ts
// Derives every AdaptiveProfile dimension from local analytics and notification signals.
// All reads are local — no network, no auth.

import { getAggregates } from "@/analytics/aggregateStore";
import { getRetentionMetrics } from "@/analytics/retentionEngine";
import { getNotificationPreferences } from "@/notifications/preferences";
import { getFatigueState } from "@/notifications/fatigue";
import type {
  AdaptiveProfile,
  ConfidenceLevel,
  InteractionDensity,
  LoggingRhythm,
  WellnessFocusDomain,
  ModuleId,
  RecommendationDensity,
  ReflectionAffinity,
  NotificationTolerance,
  ProfileDimension,
} from "./types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dim<T>(
  value: T,
  confidence: ConfidenceLevel,
  stability: number,
  explainability: string,
): ProfileDimension<T> {
  return {
    value,
    confidence,
    stability: Math.min(1, Math.max(0, stability)),
    observedAt: todayIso(),
    explainability,
  };
}

function confidenceFromDays(activeDays: number): ConfidenceLevel {
  if (activeDays < 5) return "low";
  if (activeDays < 15) return "medium";
  return "high";
}

// ── Module bucket mapping ────────────────────────────────────────────────────

const FEATURE_TO_MODULE: Partial<Record<string, ModuleId>> = {
  physical:         "physical",
  nutrition:        "physical",
  sleep:            "sleep",
  habits:           "habits",
  mental:           "mental",
  journal:          "mental",
  ai_mental_coach:  "mental",
  ai_coach:         "mental",
};

const MODULE_ORDER: ModuleId[] = ["physical", "mental", "habits", "sleep"];

function moduleAffinityOrder(featureCounts: Record<string, number>): ModuleId[] {
  const buckets: Record<ModuleId, number> = { physical: 0, mental: 0, habits: 0, sleep: 0 };
  for (const [feature, count] of Object.entries(featureCounts)) {
    const mod = FEATURE_TO_MODULE[feature];
    if (mod) buckets[mod] += count;
  }
  const hasCounts = Object.values(buckets).some((v) => v > 0);
  if (!hasCounts) return [...MODULE_ORDER];
  return [...MODULE_ORDER].sort((a, b) => buckets[b] - buckets[a]);
}

// ── Domain focus from entity consistency ─────────────────────────────────────

const ENTITY_TO_DOMAIN: Partial<Record<string, WellnessFocusDomain>> = {
  sleep:    "sleep",
  exercise: "activity",
  meal:     "nutrition",
  habit:    "habits",
  mood:     "mood",
  journal:  "mood",
};

function dominantDomain(
  entityConsistency: Partial<Record<string, number>>,
): WellnessFocusDomain {
  const domainScores: Partial<Record<WellnessFocusDomain, number>> = {};
  for (const [entity, days] of Object.entries(entityConsistency)) {
    const domain = ENTITY_TO_DOMAIN[entity];
    if (domain) {
      domainScores[domain] = (domainScores[domain] ?? 0) + (days ?? 0);
    }
  }
  const entries = Object.entries(domainScores) as [WellnessFocusDomain, number][];
  if (entries.length === 0) return "balanced";
  const max = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return max[0];
}

// ── Main analysis ─────────────────────────────────────────────────────────────

export function analyzeInteractionSignals(): Omit<
  AdaptiveProfile,
  "profileVersion" | "generatedAt" | "dataSpanDays"
> {
  const agg = getAggregates();
  const retention = getRetentionMetrics();
  const prefs = getNotificationPreferences();
  const fatigue = getFatigueState();

  const { activeDaysLast30, activeDaysThisWeek, activeDaysLastWeek, avgActionsPerActiveDay, entityConsistency } = retention;
  const confidence = confidenceFromDays(activeDaysLast30);

  // ── interactionDensity ──────────────────────────────────────────────────────
  const densityValue: InteractionDensity =
    avgActionsPerActiveDay >= 8 ? "heavy"
    : avgActionsPerActiveDay >= 3 ? "moderate"
    : "light";

  const interactionDensity = dim<InteractionDensity>(
    densityValue,
    confidence,
    activeDaysLast30 / 30,
    `Averaging ${avgActionsPerActiveDay} actions on active days over the last 30 days.`,
  );

  // ── loggingRhythm ───────────────────────────────────────────────────────────
  const rhythmValue: LoggingRhythm =
    activeDaysLast30 >= 20 ? "consistent"
    : activeDaysLast30 >= 10 ? "building"
    : activeDaysLast30 >= 3 ? "sporadic"
    : "new_user";

  const loggingRhythm = dim<LoggingRhythm>(
    rhythmValue,
    confidence,
    Math.min(activeDaysLast30 / 20, 1),
    `Active ${activeDaysLast30} out of the last 30 days.`,
  );

  // ── wellnessFocus ───────────────────────────────────────────────────────────
  const focusValue = dominantDomain(entityConsistency);
  const topEntityDays = Math.max(...Object.values(entityConsistency).filter(Boolean).map(Number), 0);

  const wellnessFocus = dim<WellnessFocusDomain>(
    focusValue,
    confidence,
    Math.min(topEntityDays / 20, 1),
    focusValue === "balanced"
      ? "No single wellness domain dominates — tracking is spread across areas."
      : `${focusValue} is the most consistently tracked domain.`,
  );

  // ── moduleAffinity ──────────────────────────────────────────────────────────
  const affinityOrder = moduleAffinityOrder(agg.featureCounts);
  const totalFeatureUses = Object.values(agg.featureCounts).reduce((s, n) => s + n, 0);

  const moduleAffinity = dim<ModuleId[]>(
    affinityOrder,
    confidence,
    Math.min(totalFeatureUses / 50, 1),
    `Most-used module: ${affinityOrder[0]}.`,
  );

  // ── quietModeActive ─────────────────────────────────────────────────────────
  const wasActive = activeDaysLast30 >= 7;
  const recentDisengagement = activeDaysThisWeek <= 1 && wasActive;

  const totalIgnores = Object.values(fatigue.ignoreCount).reduce((s, n) => s + (n ?? 0), 0);
  const highIgnoreLoad = totalIgnores >= 10;

  const quietValue = recentDisengagement || highIgnoreLoad;

  const quietModeActive = dim<boolean>(
    quietValue,
    quietValue ? "medium" : "low",
    wasActive ? 0.6 : 0.2,
    quietValue
      ? recentDisengagement
        ? "Activity this week is lower than recent baseline."
        : "Notification interactions suggest a preference for reduced prompts."
      : "Engagement is consistent with recent patterns.",
  );

  // ── recommendationDensity ───────────────────────────────────────────────────
  const densityRec: RecommendationDensity =
    quietValue ? "minimal"
    : densityValue === "heavy" && rhythmValue === "consistent" ? "full"
    : densityValue === "light" || rhythmValue === "new_user" ? "minimal"
    : "moderate";

  const recommendationDensity = dim<RecommendationDensity>(
    densityRec,
    confidence,
    interactionDensity.stability,
    `Guidance density calibrated to ${densityValue} interaction pattern and ${rhythmValue} logging rhythm.`,
  );

  // ── reflectionAffinity ──────────────────────────────────────────────────────
  const journalDays = entityConsistency["journal"] ?? 0;
  const moodDays = entityConsistency["mood"] ?? 0;
  const reflectionDays = journalDays + moodDays;

  const reflectionValue: ReflectionAffinity =
    reflectionDays >= 15 ? "high"
    : reflectionDays >= 6 ? "moderate"
    : "low";

  const reflectionAffinity = dim<ReflectionAffinity>(
    reflectionValue,
    confidence,
    Math.min(reflectionDays / 20, 1),
    `Journal and mood logged on ${reflectionDays} days in the last 30.`,
  );

  // ── notificationTolerance ───────────────────────────────────────────────────
  let toleranceValue: NotificationTolerance;
  if (prefs.sensitivityLevel === "low") {
    toleranceValue = "low";
  } else if (prefs.sensitivityLevel === "high") {
    toleranceValue = "high";
  } else {
    toleranceValue = totalIgnores >= 10 ? "low" : "normal";
  }

  const notificationTolerance = dim<NotificationTolerance>(
    toleranceValue,
    "medium",
    0.7,
    prefs.sensitivityLevel !== "normal"
      ? `Notification sensitivity set to ${prefs.sensitivityLevel} by user preference.`
      : `Inferred from notification engagement patterns.`,
  );

  // ── activeDaysLastWeek for stability cross-reference ───────────────────────
  void activeDaysLastWeek; // available if needed for future dimensions

  return {
    interactionDensity,
    loggingRhythm,
    wellnessFocus,
    moduleAffinity,
    recommendationDensity,
    reflectionAffinity,
    quietModeActive,
    notificationTolerance,
  };
}
