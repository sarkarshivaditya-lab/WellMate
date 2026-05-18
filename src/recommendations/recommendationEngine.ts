// src/recommendations/recommendationEngine.ts
// Main orchestrator for the deterministic recommendation engine.
// Generates, filters, and caches contextual wellness recommendations.
// Cached in localStorage with a 2-hour TTL.

import { buildRecommendationContext } from "./recommendationContext";
import { ALL_RULES } from "./recommendationRules";
import { rankRecommendations } from "./recommendationRanker";
import { markShown, pruneOldEntries } from "./recommendationFatigue";
import type { Recommendation, RecommendationContext } from "./types";
import type { WellnessMemoryContext } from "@/intelligence/memory/types";

const STORAGE_KEY = "wellmate_recommendations_v1";
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type CachedRecommendations = {
  version: 1;
  recommendations: Recommendation[];
  cachedAt: number;
  contextSnapshot: Pick<RecommendationContext, "energyState" | "compositeScore">;
};

function loadCached(): CachedRecommendations | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRecommendations;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCached(recs: Recommendation[], ctx: RecommendationContext): void {
  try {
    const stored: CachedRecommendations = {
      version: 1,
      recommendations: recs,
      cachedAt: Date.now(),
      contextSnapshot: {
        energyState: ctx.energyState,
        compositeScore: ctx.compositeScore,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function getCachedRecommendations(): Recommendation[] | null {
  const cached = loadCached();
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > TTL_MS) return null;
  return cached.recommendations;
}

export function buildRecommendations(
  memoryCtx: WellnessMemoryContext | null,
  forceRefresh = false
): Recommendation[] {
  if (!forceRefresh) {
    const cached = getCachedRecommendations();
    if (cached) return cached;
  }

  pruneOldEntries();

  // Build context from all intelligence signals
  const ctx = buildRecommendationContext(memoryCtx);

  // Run all rules → collect candidates
  const candidates: Recommendation[] = [];
  for (const rule of ALL_RULES) {
    try {
      const rec = rule(ctx);
      if (rec) candidates.push(rec);
    } catch {
      // Rules are defensive — one failing rule never breaks the engine
    }
  }

  // Rank, filter by cooldown, cap
  const ranked = rankRecommendations(candidates, ctx);

  // Mark returned recommendations as shown (updates cooldown store)
  markShown(ranked.map((r) => r.id));

  saveCached(ranked, ctx);
  return ranked;
}
