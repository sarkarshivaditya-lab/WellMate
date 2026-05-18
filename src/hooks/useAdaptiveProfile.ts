// src/hooks/useAdaptiveProfile.ts
// React hook for adaptive profile access.
// Warm-starts from cache; computes off the render thread via rAF.

import { useState, useEffect, useCallback } from "react";
import { buildAdaptiveProfile } from "@/personalization/adaptationEngine";
import { getCachedAdaptiveProfile } from "@/personalization/adaptationStore";
import { deriveAdaptationState } from "@/personalization/surfacePrioritization";
import { DEFAULT_ADAPTATION_STATE } from "@/personalization/types";
import type { AdaptiveProfile, AdaptationState } from "@/personalization/types";

type AdaptiveProfileHook = {
  profile: AdaptiveProfile | null;
  adaptationState: AdaptationState;
  loading: boolean;
  refresh: () => void;
};

function toAdaptationState(profile: AdaptiveProfile | null): AdaptationState {
  return profile ? deriveAdaptationState(profile) : DEFAULT_ADAPTATION_STATE;
}

export function useAdaptiveProfile(): AdaptiveProfileHook {
  const [profile, setProfile] = useState<AdaptiveProfile | null>(
    () => getCachedAdaptiveProfile(),
  );
  const [loading, setLoading] = useState(() => getCachedAdaptiveProfile() === null);

  useEffect(() => {
    if (profile !== null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const built = buildAdaptiveProfile(false);
        if (!cancelled) {
          setProfile(built);
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
        const built = buildAdaptiveProfile(true);
        setProfile(built);
      } catch {
        // Silently absorb — personalization is enhancement, not core
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return {
    profile,
    adaptationState: toAdaptationState(profile),
    loading,
    refresh,
  };
}
