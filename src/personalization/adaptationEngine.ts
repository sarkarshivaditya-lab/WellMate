// src/personalization/adaptationEngine.ts
// Orchestrates adaptive profile computation and caching.

import { analyzeInteractionSignals } from "./interactionAnalysis";
import { getCachedAdaptiveProfile, saveAdaptiveProfile } from "./adaptationStore";
import { getAggregates } from "@/analytics/aggregateStore";
import type { AdaptiveProfile } from "./types";

function dataSpanDays(firstSeenDate: string | null): number {
  if (!firstSeenDate) return 0;
  const first = new Date(firstSeenDate).getTime();
  return Math.max(0, Math.floor((Date.now() - first) / 86400000));
}

export function buildAdaptiveProfile(forceRefresh = false): AdaptiveProfile {
  if (!forceRefresh) {
    const cached = getCachedAdaptiveProfile();
    if (cached) return cached;
  }

  const dimensions = analyzeInteractionSignals();
  const agg = getAggregates();

  const profile: AdaptiveProfile = {
    ...dimensions,
    profileVersion: 1,
    generatedAt: Date.now(),
    dataSpanDays: dataSpanDays(agg.firstSeenDate),
  };

  saveAdaptiveProfile(profile);
  return profile;
}
