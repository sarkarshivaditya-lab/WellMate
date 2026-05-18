// src/personalization/types.ts
// Type contracts for the adaptive personalization layer.
// Profiles are explainable, slowly-evolving, and AI-groundable.
// The system adapts to the user's rhythm — it never announces that it's doing so.

export type ConfidenceLevel = "low" | "medium" | "high";

// How actively/frequently the user interacts with the app
export type InteractionDensity = "light" | "moderate" | "heavy";

// How consistent the user's logging rhythm has been
export type LoggingRhythm = "new_user" | "sporadic" | "building" | "consistent";

// Which wellness domain the user gravitates toward
export type WellnessFocusDomain =
  | "sleep"
  | "activity"
  | "nutrition"
  | "habits"
  | "mood"
  | "balanced";

// How many recommendations to surface
export type RecommendationDensity = "minimal" | "moderate" | "full";

// How much the user engages with reflective content
export type ReflectionAffinity = "low" | "moderate" | "high";

// How receptive to notifications the user appears to be
export type NotificationTolerance = "low" | "normal" | "high";

// Module identifiers used in quick-link ordering
export type ModuleId = "physical" | "mental" | "habits" | "sleep";

// A single profile dimension — carries its own confidence, stability, and explainability.
// This makes every dimension independently AI-groundable.
export type ProfileDimension<T> = {
  value: T;
  confidence: ConfidenceLevel;
  stability: number;       // 0-1, how stable this has been (proxy from data breadth)
  observedAt: string;      // ISO date of most recent observation
  explainability: string;  // one-sentence "why"
};

// The complete adaptive profile.
export type AdaptiveProfile = {
  // Interaction style
  interactionDensity: ProfileDimension<InteractionDensity>;
  loggingRhythm: ProfileDimension<LoggingRhythm>;

  // Wellness focus — the domain the user tracks most consistently
  wellnessFocus: ProfileDimension<WellnessFocusDomain>;

  // Module affinity — ordered from most-used to least-used
  moduleAffinity: ProfileDimension<ModuleId[]>;

  // Content preferences
  recommendationDensity: ProfileDimension<RecommendationDensity>;
  reflectionAffinity: ProfileDimension<ReflectionAffinity>;

  // Quieter interaction style when engagement is reduced
  quietModeActive: ProfileDimension<boolean>;

  // Notification receptiveness
  notificationTolerance: ProfileDimension<NotificationTolerance>;

  // Meta
  profileVersion: 1;
  generatedAt: number;   // Unix ms
  dataSpanDays: number;  // days of history that informed this profile
};

// Derived adaptation instructions consumed by UI surfaces.
// These are concrete, actionable — the profile's values translated into UI decisions.
export type AdaptationState = {
  maxRecommendations: number;          // how many recs to surface (1–5)
  showReflections: boolean;            // whether to include reflection-category content
  suppressPositiveInformational: boolean; // hide low-urgency positive content during quiet mode
  moduleOrder: ModuleId[];             // quick-link order (most-relevant first)
  pacingMode: "gentle" | "normal" | "full"; // overall surface pacing
};

// Sensible defaults used when no profile has been computed yet.
export const DEFAULT_ADAPTATION_STATE: AdaptationState = {
  maxRecommendations: 5,
  showReflections: true,
  suppressPositiveInformational: false,
  moduleOrder: ["physical", "mental", "habits", "sleep"],
  pacingMode: "normal",
};
