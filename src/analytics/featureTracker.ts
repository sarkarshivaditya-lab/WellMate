// src/analytics/featureTracker.ts

import { useEffect } from "react";
import { emitAnalyticsEvent } from "./eventBus";
import type { FeatureName } from "./types";

export function trackFeatureOpen(feature: FeatureName): void {
  emitAnalyticsEvent({ type: "feature_opened", feature, ts: Date.now() });
}

export function useFeatureTracker(feature: FeatureName): void {
  useEffect(() => {
    trackFeatureOpen(feature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
