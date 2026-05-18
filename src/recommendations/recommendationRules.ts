// src/recommendations/recommendationRules.ts
// Deterministic rule definitions for each recommendation category.
// Each rule is a pure function: context → Recommendation | null.
// Copy is observational, never prescriptive. No "you should", no "you must".

import type { Recommendation, RecommendationContext } from "./types";

const now = () => Date.now();

type Rule = (ctx: RecommendationContext) => Recommendation | null;

// ── Sleep rules ───────────────────────────────────────────────────────────────

const sleepBedtimeVariability: Rule = (ctx) => {
  if (ctx.sleepNightsLogged30d < 7) return null;
  if (ctx.sleepBedtimeConsistency >= 60) return null;
  return {
    id: "sleep_bedtime_variability",
    category: "sleep",
    title: "Bedtime timing has varied",
    body: "Sleep timing has been inconsistent recently. A consistent bedtime window tends to support steadier rest and recovery.",
    supportingSignals: [
      { label: "Bedtime consistency", value: `${ctx.sleepBedtimeConsistency}/100` },
      { label: "Nights logged", value: `${ctx.sleepNightsLogged30d}` },
    ],
    relatedDomains: ["sleep"],
    confidence: ctx.sleepNightsLogged30d >= 20 ? "medium" : "low",
    severity: "gentle",
    trend: "negative",
    explainability: {
      reason: "Bedtime consistency has been low over the past month.",
      contributingSignals: [`Bedtime consistency score: ${ctx.sleepBedtimeConsistency}/100`],
      windowDays: 30,
    },
    cooldownDays: 7,
    optionalityScore: 0.8,
    priority: 0,
    generatedAt: now(),
  };
};

const sleepDebtHigh: Rule = (ctx) => {
  if (ctx.sleepDebtHours < 3) return null;
  return {
    id: "sleep_debt_high",
    category: "sleep",
    title: "Sleep gap this week",
    body: `Sleep this week shows a gap of around ${ctx.sleepDebtHours}h from the usual target. Recovery often improves with even small increases in nightly duration.`,
    supportingSignals: [
      { label: "Sleep debt", value: `${ctx.sleepDebtHours}h this week` },
    ],
    relatedDomains: ["sleep", "recovery"],
    confidence: "high",
    severity: "moderate",
    trend: "negative",
    explainability: {
      reason: "Cumulative sleep this week is significantly below the 7.5h target.",
      contributingSignals: [`Weekly sleep debt: ${ctx.sleepDebtHours}h`],
      windowDays: 7,
    },
    cooldownDays: 3,
    optionalityScore: 0.5,
    priority: 0,
    generatedAt: now(),
  };
};

const sleepQualityLow: Rule = (ctx) => {
  if (ctx.sleepNightsLogged30d < 7) return null;
  if (ctx.sleepAvgQuality === 0 || ctx.sleepAvgQuality >= 2.8) return null;
  return {
    id: "sleep_quality_low",
    category: "sleep",
    title: "Sleep quality has been lower",
    body: "Sleep quality ratings have been lower than usual recently. Evening wind-down patterns often appear associated with more restful nights.",
    supportingSignals: [
      { label: "Avg sleep quality", value: `${Math.round(ctx.sleepAvgQuality * 10) / 10}/5` },
    ],
    relatedDomains: ["sleep"],
    confidence: "medium",
    severity: "gentle",
    trend: "negative",
    explainability: {
      reason: "Average sleep quality has been below 2.8/5 this month.",
      contributingSignals: [`Avg quality: ${Math.round(ctx.sleepAvgQuality * 10) / 10}/5`],
      windowDays: 30,
    },
    cooldownDays: 5,
    optionalityScore: 0.7,
    priority: 0,
    generatedAt: now(),
  };
};

const sleepRecoveryLow: Rule = (ctx) => {
  if (ctx.sleepRecoveryReadiness >= 40) return null;
  if (ctx.sleepNightsLogged30d < 3) return null;
  return {
    id: "sleep_recovery_readiness_low",
    category: "sleep",
    title: "Recovery readiness is low",
    body: "Recovery readiness appears lower today. Light movement or additional rest often helps more than pushing through high-intensity activity.",
    supportingSignals: [
      { label: "Recovery readiness", value: `${ctx.sleepRecoveryReadiness}/100` },
    ],
    relatedDomains: ["sleep", "recovery"],
    confidence: "medium",
    severity: "moderate",
    trend: "negative",
    explainability: {
      reason: "Sleep-based recovery readiness score is below 40 today.",
      contributingSignals: [`Readiness: ${ctx.sleepRecoveryReadiness}/100`],
      windowDays: 3,
    },
    cooldownDays: 2,
    optionalityScore: 0.6,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Recovery rules ────────────────────────────────────────────────────────────

const overtrainingSignal: Rule = (ctx) => {
  if (!ctx.overtrainingDetected) return null;
  return {
    id: "recovery_overtraining",
    category: "recovery",
    title: "High activity streak — consider easing off",
    body: `You've maintained ${ctx.consecutiveWorkoutDays} consecutive active days. Recovery signals suggest your body may benefit from a lighter session or rest today.`,
    supportingSignals: [
      { label: "Consecutive active days", value: `${ctx.consecutiveWorkoutDays}` },
      { label: "Recovery score", value: `${ctx.recoveryScore}/100` },
    ],
    relatedDomains: ["activity", "recovery", "sleep"],
    confidence: "high",
    severity: "moderate",
    trend: "negative",
    explainability: {
      reason: "Overtraining signal detected: high consecutive workout days combined with low sleep quality.",
      contributingSignals: [
        `Consecutive days: ${ctx.consecutiveWorkoutDays}`,
        `Recovery score: ${ctx.recoveryScore}`,
      ],
      windowDays: 7,
    },
    cooldownDays: 3,
    optionalityScore: 0.4,
    priority: 0,
    generatedAt: now(),
  };
};

const consecutiveHighLoad: Rule = (ctx) => {
  if (ctx.overtrainingDetected) return null; // overtraining rule takes precedence
  if (ctx.consecutiveWorkoutDays < 4) return null;
  return {
    id: "recovery_consecutive_load",
    category: "recovery",
    title: "Several consecutive active days",
    body: "A lighter session or rest day often helps maintain long-term consistency and supports deeper recovery.",
    supportingSignals: [
      { label: "Consecutive active days", value: `${ctx.consecutiveWorkoutDays}` },
    ],
    relatedDomains: ["activity", "recovery"],
    confidence: "medium",
    severity: "gentle",
    trend: "neutral",
    explainability: {
      reason: "4+ consecutive workout days without a rest day noted.",
      contributingSignals: [`Consecutive days: ${ctx.consecutiveWorkoutDays}`],
      windowDays: 7,
    },
    cooldownDays: 4,
    optionalityScore: 0.75,
    priority: 0,
    generatedAt: now(),
  };
};

const pacingSupport: Rule = (ctx) => {
  if (ctx.activityActiveDays30d < 15) return null;
  if (ctx.recoveryScore >= 55) return null;
  return {
    id: "recovery_pacing_support",
    category: "pacing",
    title: "Activity high, recovery signals lower",
    body: "Activity volume has been higher while recovery indicators are lower. Spacing out heavier sessions often helps maintain both performance and wellbeing over time.",
    supportingSignals: [
      { label: "Active days (30d)", value: `${ctx.activityActiveDays30d}` },
      { label: "Recovery score", value: `${ctx.recoveryScore}/100` },
    ],
    relatedDomains: ["activity", "recovery"],
    confidence: "medium",
    severity: "gentle",
    trend: "neutral",
    explainability: {
      reason: "High activity volume coincides with lower recovery scores over the past month.",
      contributingSignals: [
        `Active days: ${ctx.activityActiveDays30d}/30`,
        `Recovery: ${ctx.recoveryScore}/100`,
      ],
      windowDays: 30,
    },
    cooldownDays: 5,
    optionalityScore: 0.7,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Hydration rules ───────────────────────────────────────────────────────────

const hydrationConsistency: Rule = (ctx) => {
  // Only surface if they're tracking hydration but it's low
  if (ctx.hydrationLoggingRate30d < 0.25) return null; // not tracking enough to comment
  if (ctx.hydrationAvgCups30d >= 5) return null;
  return {
    id: "hydration_consistency_low",
    category: "hydration",
    title: "Hydration has been lower",
    body: "Steady hydration throughout the day often coincides with better energy levels and recovery — especially on active days.",
    supportingSignals: [
      { label: "Avg cups/day", value: `${Math.round(ctx.hydrationAvgCups30d * 10) / 10}` },
      { label: "Days tracked", value: `${Math.round(ctx.hydrationLoggingRate30d * 30)}` },
    ],
    relatedDomains: ["hydration", "recovery"],
    confidence: "low",
    severity: "informational",
    trend: "neutral",
    explainability: {
      reason: "Average daily hydration is below 5 cups on logged days.",
      contributingSignals: [`Avg cups/day: ${Math.round(ctx.hydrationAvgCups30d * 10) / 10}`],
      windowDays: 30,
    },
    cooldownDays: 5,
    optionalityScore: 0.9,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Habits rules ──────────────────────────────────────────────────────────────

const habitsDecline: Rule = (ctx) => {
  if (ctx.habitsCompletionRate30d === 0 && ctx.habitsBestStreak === 0) return null; // no habits set
  if (ctx.habitsTrend !== "down") return null;
  if (ctx.habitsCompletionRate30d >= 50) return null;
  return {
    id: "habits_completion_decline",
    category: "habits",
    title: "Habit completion has been lower",
    body: "Starting with just one habit often rebuilds momentum more effectively than restarting everything at once. Small consistency compounds.",
    supportingSignals: [
      { label: "Completion rate (30d)", value: `${ctx.habitsCompletionRate30d}%` },
    ],
    relatedDomains: ["habits"],
    confidence: "medium",
    severity: "gentle",
    trend: "negative",
    explainability: {
      reason: "Habit completion rate has declined and is below 50% this month.",
      contributingSignals: [`Completion rate: ${ctx.habitsCompletionRate30d}%`],
      windowDays: 30,
    },
    cooldownDays: 7,
    optionalityScore: 0.8,
    priority: 0,
    generatedAt: now(),
  };
};

const habitsStreakSupport: Rule = (ctx) => {
  if (ctx.habitsBestStreak < 7) return null;
  return {
    id: "habits_streak_building",
    category: "habits",
    title: "Consistent habit follow-through",
    body: `A ${ctx.habitsBestStreak}-day streak is a meaningful signal. Sustained consistency at 70% is more valuable long-term than brief 100% sprints.`,
    supportingSignals: [
      { label: "Best streak (30d)", value: `${ctx.habitsBestStreak} days` },
      { label: "Completion rate", value: `${ctx.habitsCompletionRate30d}%` },
    ],
    relatedDomains: ["habits"],
    confidence: "medium",
    severity: "informational",
    trend: "positive",
    explainability: {
      reason: "A sustained habit streak of 7+ days detected this month.",
      contributingSignals: [`Best streak: ${ctx.habitsBestStreak} days`],
      windowDays: 30,
    },
    cooldownDays: 7,
    optionalityScore: 1.0,
    priority: 0,
    generatedAt: now(),
  };
};

const habitsOvercommitment: Rule = (ctx) => {
  // Only surface when there are many habits AND follow-through is low.
  // Framed as simplification support, not failure feedback.
  if (ctx.habitsActiveCount < 5) return null;
  if (ctx.habitsCompletionRate30d >= 40) return null;
  return {
    id: "habits_overcommitment",
    category: "habits",
    title: "Fewer habits, steadier rhythm",
    body: `Having ${ctx.habitsActiveCount} active habits with lower follow-through is common. Narrowing to one or two often builds more lasting consistency than trying to maintain everything at once.`,
    supportingSignals: [
      { label: "Active habits", value: `${ctx.habitsActiveCount}` },
      { label: "Completion rate (30d)", value: `${ctx.habitsCompletionRate30d}%` },
    ],
    relatedDomains: ["habits"],
    confidence: "medium",
    severity: "gentle",
    trend: "neutral",
    explainability: {
      reason: `${ctx.habitsActiveCount} active habits with ${ctx.habitsCompletionRate30d}% 30-day completion — volume may be exceeding sustainable capacity.`,
      contributingSignals: [
        `Active habits: ${ctx.habitsActiveCount}`,
        `30-day completion: ${ctx.habitsCompletionRate30d}%`,
      ],
      windowDays: 30,
    },
    cooldownDays: 14,
    optionalityScore: 0.95,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Mood rules ────────────────────────────────────────────────────────────────

const moodVolatile: Rule = (ctx) => {
  if (ctx.moodEntriesLogged30d < 8) return null;
  if (ctx.moodVolatility30d < 1.5) return null;
  return {
    id: "mood_high_volatility",
    category: "mood",
    title: "Mood has varied quite a bit",
    body: "Routine stability — consistent sleep timing, regular meals, and steady movement — often appears associated with more stable emotional patterns over time.",
    supportingSignals: [
      { label: "Mood variability", value: ctx.moodVolatility30d.toFixed(2) },
      { label: "Entries logged", value: `${ctx.moodEntriesLogged30d}` },
    ],
    relatedDomains: ["mood", "sleep", "habits"],
    confidence: "medium",
    severity: "gentle",
    trend: "negative",
    explainability: {
      reason: "Mood volatility (std dev) exceeds 1.5 over the past 30 days.",
      contributingSignals: [`Mood volatility: ${ctx.moodVolatility30d.toFixed(2)}`],
      windowDays: 30,
    },
    cooldownDays: 7,
    optionalityScore: 0.8,
    priority: 0,
    generatedAt: now(),
  };
};

const moodLow: Rule = (ctx) => {
  if (ctx.moodEntriesLogged30d < 5) return null;
  if (ctx.moodAvg30d === 0 || ctx.moodAvg30d >= 2.5) return null;
  return {
    id: "mood_avg_low",
    category: "mood",
    title: "Mood scores have been lower",
    body: "Lower mood often coincides with higher physical stress or disrupted sleep — both areas worth observing. Small, sustainable changes across multiple domains tend to help most.",
    supportingSignals: [
      { label: "Avg mood (30d)", value: `${Math.round(ctx.moodAvg30d * 10) / 10}/5` },
      { label: "Entries", value: `${ctx.moodEntriesLogged30d}` },
    ],
    relatedDomains: ["mood", "sleep", "stress_management"],
    confidence: "medium",
    severity: "moderate",
    trend: "negative",
    explainability: {
      reason: "Average mood over the past 30 days is below 2.5/5.",
      contributingSignals: [`Avg mood: ${Math.round(ctx.moodAvg30d * 10) / 10}/5`],
      windowDays: 30,
    },
    cooldownDays: 5,
    optionalityScore: 0.6,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Activity rules ────────────────────────────────────────────────────────────

const activityGap: Rule = (ctx) => {
  if (ctx.dataSpanDays < 30) return null; // only for established users
  if (ctx.activityActiveDays30d >= 3) return null;
  return {
    id: "activity_gap_long",
    category: "activity",
    title: "Activity has been minimal recently",
    body: "Even short, low-intensity movement often appears associated with steadier recovery, mood, and energy — without needing full workout sessions.",
    supportingSignals: [
      { label: "Active days (30d)", value: `${ctx.activityActiveDays30d}` },
    ],
    relatedDomains: ["activity", "mood", "recovery"],
    confidence: "medium",
    severity: "gentle",
    trend: "neutral",
    explainability: {
      reason: "Fewer than 3 active days logged in the past 30 days.",
      contributingSignals: [`Active days: ${ctx.activityActiveDays30d}/30`],
      windowDays: 30,
    },
    cooldownDays: 7,
    optionalityScore: 0.8,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Stabilization rules ───────────────────────────────────────────────────────

const multiDomainLow: Rule = (ctx) => {
  if (ctx.energyState !== "low") return null;
  if (ctx.dataSpanDays < 7) return null;
  return {
    id: "stabilization_low_energy",
    category: "stabilization",
    title: "Multiple signals are lower right now",
    body: "Several wellness signals are below baseline at the moment. This is a reasonable time to prioritise rest and stability rather than performance.",
    supportingSignals: [
      { label: "Energy state", value: "Low" },
      { label: "Recovery score", value: `${ctx.recoveryScore}/100` },
    ],
    relatedDomains: ["sleep", "recovery", "activity"],
    confidence: "medium",
    severity: "moderate",
    trend: "negative",
    explainability: {
      reason: "Energy state is low — overtraining, poor sleep, and/or low recovery readiness all present.",
      contributingSignals: [
        `Recovery readiness: ${ctx.sleepRecoveryReadiness}/100`,
        `Sleep score: ${ctx.sleepScore}/100`,
        ctx.overtrainingDetected ? "Overtraining signal active" : "",
      ].filter(Boolean),
      windowDays: 7,
    },
    cooldownDays: 5,
    optionalityScore: 0.5,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Reflection rules ──────────────────────────────────────────────────────────

const correlationReflection: Rule = (ctx) => {
  if (!ctx.topCorrelationInsight) return null;
  if (!ctx.hasLongitudinalData) return null;
  return {
    id: "reflection_top_correlation",
    category: "reflection",
    title: "A pattern in your data",
    body: ctx.topCorrelationInsight,
    supportingSignals: [
      { label: "Data window", value: "90 days" },
    ],
    relatedDomains: ["composite"],
    confidence: "medium",
    severity: "informational",
    trend: "positive",
    explainability: {
      reason: "A consistent cross-domain pattern was detected in your 90-day history.",
      contributingSignals: [ctx.topCorrelationInsight],
      windowDays: 90,
    },
    cooldownDays: 14,
    optionalityScore: 1.0,
    priority: 0,
    generatedAt: now(),
  };
};

const positiveEvolutionReflection: Rule = (ctx) => {
  if (!ctx.hasLongitudinalData) return null;
  if (ctx.positiveDeltas.length === 0) return null;
  const topDelta = ctx.positiveDeltas[0];
  return {
    id: "reflection_positive_evolution",
    category: "reflection",
    title: "How things have shifted",
    body: `Looking at the past few months: ${topDelta.charAt(0).toLowerCase()}${topDelta.slice(1)}`,
    supportingSignals: [
      { label: "Data span", value: `${ctx.dataSpanDays} days` },
    ],
    relatedDomains: ["composite"],
    confidence: "medium",
    severity: "informational",
    trend: "positive",
    explainability: {
      reason: "A positive behavioral shift was detected comparing recent to baseline periods.",
      contributingSignals: [topDelta],
      windowDays: 90,
    },
    cooldownDays: 14,
    optionalityScore: 1.0,
    priority: 0,
    generatedAt: now(),
  };
};

const weeklyPacingReflection: Rule = (ctx) => {
  if (ctx.dataSpanDays < 21) return null;
  if (ctx.energyState === "low") return null; // let stabilization rule speak instead
  return {
    id: "reflection_weekly_pacing",
    category: "reflection",
    title: "Consistency over intensity",
    body: "Consistent daily patterns — even imperfect ones — tend to produce more stable results than intense but irregular effort.",
    supportingSignals: [],
    relatedDomains: ["composite"],
    confidence: "high",
    severity: "informational",
    trend: "positive",
    explainability: {
      reason: "General pacing reflection — surfaces when the user has sufficient data history.",
      contributingSignals: [],
      windowDays: 21,
    },
    cooldownDays: 10,
    optionalityScore: 1.0,
    priority: 0,
    generatedAt: now(),
  };
};

// ── Rule registry ─────────────────────────────────────────────────────────────

export const ALL_RULES: Rule[] = [
  // Sleep
  sleepDebtHigh,
  sleepRecoveryLow,
  sleepQualityLow,
  sleepBedtimeVariability,
  // Recovery
  overtrainingSignal,
  consecutiveHighLoad,
  pacingSupport,
  // Mood
  moodLow,
  moodVolatile,
  // Stabilization
  multiDomainLow,
  // Activity
  activityGap,
  // Habits
  habitsDecline,
  habitsStreakSupport,
  habitsOvercommitment,
  // Hydration
  hydrationConsistency,
  // Reflection
  correlationReflection,
  positiveEvolutionReflection,
  weeklyPacingReflection,
];
