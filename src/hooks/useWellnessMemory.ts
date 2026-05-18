// src/hooks/useWellnessMemory.ts
// React hook for accessing the longitudinal wellness memory context.
// Warm-starts from cache synchronously, computes off the render thread via rAF.
// Memory is supplementary context — failures are silent, never block rendering.

import { useState, useEffect, useCallback } from "react";
import { buildWellnessMemoryContext } from "@/intelligence/memory/wellnessMemoryEngine";
import { getCachedMemoryContext } from "@/intelligence/memory/memoryStore";
import type { WellnessMemoryContext } from "@/intelligence/memory/types";

type WellnessMemoryHook = {
  memory: WellnessMemoryContext | null;
  loading: boolean;
  refresh: () => void;
};

export function useWellnessMemory(): WellnessMemoryHook {
  const [memory, setMemory] = useState<WellnessMemoryContext | null>(() =>
    getCachedMemoryContext()
  );
  const [loading, setLoading] = useState(() => getCachedMemoryContext() === null);

  useEffect(() => {
    // If we already have a fresh cache, nothing to do
    if (memory !== null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const ctx = buildWellnessMemoryContext(false);
        if (!cancelled) {
          setMemory(ctx);
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
    const frameId = requestAnimationFrame(() => {
      try {
        const ctx = buildWellnessMemoryContext(true);
        setMemory(ctx);
      } catch {
        // Silently absorb — memory is optional context
      } finally {
        setLoading(false);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  return { memory, loading, refresh };
}
