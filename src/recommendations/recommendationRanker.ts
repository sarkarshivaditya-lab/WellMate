// src/recommendations/recommendationRanker.ts
// Ranks, filters, and selects the final recommendation set.
// Priority: sparse > noisy. Better 3 meaningful than 10 shallow.

import type { Recommendation, RecommendationContext } from "./types";
import { isCooledDown } from "./recommendationFatigue";

const MAX_RECOMMENDATIONS = 5;
const MAX_PER_CATEGORY = 2;

// Base priority by severity — ranker adjusts from here
const SEVERITY_BASE: Record<string, number> = {
  moderate: 100,
  gentle: 60,
  informational: 25,
};

// Category bonus: some categories are more time-sensitive
const CATEGORY_BOOST: Record<string, number> = {
  stabilization: 40,    // high-priority when energy is low
  recovery: 30,
  sleep: 20,
  mood: 15,
  habits: 10,
  activity: 10,
  pacing: 10,
  reflection: -10,      // reflections are lowest priority
  hydration: -5,
  consistency: 0,
  stress_management: 5,
};

function scorePriority(rec: Recommendation, ctx: RecommendationContext): number {
  let score = SEVERITY_BASE[rec.severity] ?? 50;
  score += CATEGORY_BOOST[rec.category] ?? 0;

  // Boost negative-trend recommendations when energy is low
  if (ctx.energyState === "low" && rec.trend === "negative") score += 20;

  // Stabilization takes precedence when energy is low
  if (ctx.energyState === "low" && rec.category === "stabilization") score += 30;

  // Depress performance-adjacent content when user's energy is low
  if (ctx.energyState === "low" && rec.category === "activity") score -= 20;
  if (ctx.energyState === "low" && rec.category === "habits" && rec.trend !== "positive") score -= 10;

  // Boost confidence
  if (rec.confidence === "high") score += 15;
  else if (rec.confidence === "low") score -= 10;

  // Positive reflections have lower urgency
  if (rec.trend === "positive" && rec.severity === "informational") score -= 5;

  return score;
}

export function rankRecommendations(
  candidates: Recommendation[],
  ctx: RecommendationContext
): Recommendation[] {
  // 1. Filter cooled-down recommendations
  const active = candidates.filter((r) => !isCooledDown(r.id, r.cooldownDays));

  // 2. Score by priority
  const scored = active.map((r) => ({
    rec: { ...r, priority: scorePriority(r, ctx) },
    score: scorePriority(r, ctx),
  }));

  // 3. Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // 4. Select top-N with category cap
  const selected: Recommendation[] = [];
  const categoryCounts: Partial<Record<string, number>> = {};

  for (const { rec } of scored) {
    if (selected.length >= MAX_RECOMMENDATIONS) break;
    const count = categoryCounts[rec.category] ?? 0;
    if (count >= MAX_PER_CATEGORY) continue;
    selected.push(rec);
    categoryCounts[rec.category] = count + 1;
  }

  return selected;
}
