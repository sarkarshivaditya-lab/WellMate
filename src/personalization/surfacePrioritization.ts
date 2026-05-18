// src/personalization/surfacePrioritization.ts
// Translates an AdaptiveProfile into concrete UI adaptation instructions.

import type { AdaptiveProfile, AdaptationState } from "./types";
import { DEFAULT_ADAPTATION_STATE } from "./types";

export function deriveAdaptationState(profile: AdaptiveProfile): AdaptationState {
  const {
    quietModeActive,
    recommendationDensity,
    reflectionAffinity,
    moduleAffinity,
    interactionDensity,
    loggingRhythm,
  } = profile;

  // How many recommendations to surface
  const maxRecommendations: number =
    quietModeActive.value ? 2
    : recommendationDensity.value === "full" ? 5
    : recommendationDensity.value === "minimal" ? 2
    : 3;

  // Only surface reflective content when user shows affinity for it
  const showReflections = reflectionAffinity.value !== "low";

  // Suppress low-urgency positive content when user is in a quieter phase
  const suppressPositiveInformational = quietModeActive.value;

  // Module order from behavioral affinity (already sorted most→least used)
  const moduleOrder =
    moduleAffinity.confidence !== "low"
      ? moduleAffinity.value
      : DEFAULT_ADAPTATION_STATE.moduleOrder;

  // Overall surface pacing
  const pacingMode: AdaptationState["pacingMode"] =
    quietModeActive.value ? "gentle"
    : interactionDensity.value === "heavy" && loggingRhythm.value === "consistent"
      ? "full"
    : "normal";

  return {
    maxRecommendations,
    showReflections,
    suppressPositiveInformational,
    moduleOrder,
    pacingMode,
  };
}
