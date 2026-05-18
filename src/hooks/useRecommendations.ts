// src/hooks/useRecommendations.ts
// React hook for accessing deterministic wellness recommendations.
// Warm-starts from cache; computes off the render thread via rAF.
// Accepts an optional memory context for longitudinal grounding.

import { useState, useEffect, useCallback } from "react";
import { buildRecommendations, getCachedRecommendations } from "@/recommendations/recommendationEngine";
import type { Recommendation } from "@/recommendations/types";
import type { WellnessMemoryContext } from "@/intelligence/memory/types";

type RecommendationsHook = {
  recommendations: Recommendation[];
  loading: boolean;
  refresh: () => void;
};

export function useRecommendations(
  memoryCtx: WellnessMemoryContext | null = null
): RecommendationsHook {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    () => getCachedRecommendations() ?? []
  );
  const [loading, setLoading] = useState(
    () => getCachedRecommendations() === null
  );

  useEffect(() => {
    if (recommendations.length > 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const recs = buildRecommendations(memoryCtx, false);
        if (!cancelled) {
          setRecommendations(recs);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setLoading(true);
    requestAnimationFrame(() => {
      try {
        const recs = buildRecommendations(memoryCtx, true);
        setRecommendations(recs);
      } catch {
        // Silently absorb — recommendations are supplementary guidance
      } finally {
        setLoading(false);
      }
    });
  }, [memoryCtx]);

  return { recommendations, loading, refresh };
}
