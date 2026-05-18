// src/hooks/useAIContext.ts
// Reactive hook that assembles the full AI context payload.
// Warm-starts from cache, rebuilds off the render thread via rAF.
// 2-hour TTL — matches the memory engine's cache horizon.

import React from "react";
import { useLocalProfile } from "./useLocalProfile";
import { useWellnessMemory } from "./useWellnessMemory";
import { useRecommendations } from "./useRecommendations";
import { buildWellnessContext } from "@/intelligence/wellnessScore";
import { buildAIContextPayload } from "@/ai/contextBridge";
import { buildContextCards } from "@/ai/contextCards";
import {
  generateScoreFollowUps,
  generateMemoryFollowUps,
} from "@/ai/conversationalPrimitives";
import type { AIContextPayload, ContextCard, FollowUpPrompt } from "@/ai/types";

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type AIContextState = {
  payload: AIContextPayload | null;
  cards: ContextCard[];
  followUps: FollowUpPrompt[];
  ready: boolean;
};

const INITIAL: AIContextState = { payload: null, cards: [], followUps: [], ready: false };

export function useAIContext(focusDomain?: string): AIContextState {
  const localProfile = useLocalProfile();
  const profile = localProfile
    ? {
        ...localProfile,
        activityLevel: localProfile.activityLevel ?? undefined,
        goal: localProfile.goal ?? undefined,
      }
    : null;

  const { memory } = useWellnessMemory();
  const { recommendations } = useRecommendations(memory);
  const [state, setState] = React.useState<AIContextState>(INITIAL);
  const cacheRef = React.useRef<{ payload: AIContextPayload; at: number } | null>(null);

  React.useEffect(() => {
    // Serve from TTL cache when still fresh
    if (cacheRef.current && Date.now() - cacheRef.current.at < CACHE_TTL_MS) {
      const cached = cacheRef.current.payload;
      const wellness = buildWellnessContext(profile);
      const cards = buildContextCards(memory ?? null, wellness);
      const followUps = [
        ...generateScoreFollowUps(wellness),
        ...(memory ? generateMemoryFollowUps(memory) : []),
      ].slice(0, 4);
      setState({ payload: cached, cards, followUps, ready: true });
      return;
    }

    const raf = requestAnimationFrame(() => {
      const wellness = buildWellnessContext(profile);
      const payload = buildAIContextPayload({
        wellness,
        memory: memory ?? null,
        recommendations,
        focusDomain,
      });

      const cards = buildContextCards(memory ?? null, wellness);
      const followUps = [
        ...generateScoreFollowUps(wellness),
        ...(memory ? generateMemoryFollowUps(memory) : []),
      ].slice(0, 4);

      cacheRef.current = { payload, at: Date.now() };
      setState({ payload, cards, followUps, ready: true });
    });

    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory, recommendations.length, focusDomain]);

  return state;
}
