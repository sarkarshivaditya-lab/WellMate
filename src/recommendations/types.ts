// src/recommendations/types.ts
// Type contracts for the deterministic recommendation engine.
// Recommendations are explainable, AI-groundable, and reproducible.

export type RecommendationCategory =
  | "sleep"
  | "hydration"
  | "recovery"
  | "activity"
  | "mood"
  | "habits"
  | "pacing"
  | "consistency"
  | "reflection"
  | "stabilization"
  | "stress_management";

// Severity reflects how much the underlying signal deviates from baseline.
// It does NOT imply urgency in copy — all copy stays calm.
export type RecommendationSeverity = "gentle" | "moderate" | "informational";
export type RecommendationConfidence = "low" | "medium" | "high";

export type RecommendationSignal = {
  label: string;
  value: string;
};

// Explainability metadata — every recommendation can answer "why is this here?"
export type ExplainabilityMetadata = {
  reason: string;               // one-sentence explanation
  contributingSignals: string[]; // human-readable signal descriptions
  windowDays: number;            // how far back the data looks
};

export type Recommendation = {
  id: string;                    // deterministic: "{category}_{ruleKey}"
  category: RecommendationCategory;
  title: string;                 // 3-6 words, calm framing
  body: string;                  // 1-2 sentences, observational language
  supportingSignals: RecommendationSignal[];
  relatedDomains: string[];
  confidence: RecommendationConfidence;
  severity: RecommendationSeverity;
  trend: "positive" | "negative" | "neutral";
  explainability: ExplainabilityMetadata;
  cooldownDays: number;          // how long to suppress after exposure
  optionalityScore: number;      // 0-1, higher = feels more optional
  priority: number;              // assigned by ranker (higher = show first)
  generatedAt: number;           // Unix ms
};

// Unified context consumed by all recommendation rules.
export type RecommendationContext = {
  // Sleep
  sleepScore: number;            // 0-100
  sleepDebtHours: number;
  sleepTrend: "up" | "down" | "stable";
  sleepBedtimeConsistency: number; // 0-100
  sleepAvgQuality: number;        // 0-5
  sleepAvgDurationMin: number;
  sleepRecoveryReadiness: number; // 0-100
  sleepNightsLogged30d: number;

  // Recovery
  recoveryScore: number;          // 0-100
  overtrainingDetected: boolean;
  consecutiveWorkoutDays: number;

  // Activity
  activityActiveDays30d: number;
  activityTrend: "up" | "down" | "stable";

  // Nutrition
  nutritionLoggingRate30d: number; // 0-1
  nutritionTrend: "up" | "down" | "stable";

  // Habits
  habitsCompletionRate30d: number; // 0-100
  habitsTrend: "up" | "down" | "stable";
  habitsBestStreak: number;
  habitsActiveCount: number;       // number of non-archived habits

  // Mood
  moodAvg30d: number;             // 1-5, 0 if no data
  moodVolatility30d: number;
  moodEntriesLogged30d: number;
  moodTrend: "up" | "down" | "stable";

  // Hydration
  hydrationAvgCups30d: number;
  hydrationLoggingRate30d: number; // 0-1

  // Composite
  compositeScore: number;
  compositeLevel: "high" | "medium" | "low";

  // Longitudinal (from memory context, may be empty)
  hasLongitudinalData: boolean;
  positiveDeltas: string[];        // observation text for positive shifts
  negativeDeltas: string[];        // observation text for negative shifts
  topCorrelationInsight: string | null;
  dataSpanDays: number;

  // Inferred energy state
  energyState: "low" | "moderate" | "high";
};
