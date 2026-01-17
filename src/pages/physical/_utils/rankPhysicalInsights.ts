// src/pages/physical/_utils/rankPhysicalInsights.ts

import type { PhysicalInsight } from "./types";

export function rankPhysicalInsights(args: {
  insights: PhysicalInsight[];
  confidenceScore: number;
  hasMeals: boolean;
  hasExercise: boolean;
  hasSleep: boolean;
  hasProfile: boolean;
}) {
  const {
    insights,
    confidenceScore,
    hasMeals,
    hasExercise,
    hasSleep,
    hasProfile,
  } = args;

  /* =========================
     REQUIREMENT CHECK
     ========================= */

  const satisfiesRequires = (i: PhysicalInsight) => {
    if (i.requires.meals && !hasMeals) return false;
    if (i.requires.exercise && !hasExercise) return false;
    if (i.requires.sleep && !hasSleep) return false;
    if (i.requires.profile && !hasProfile) return false;
    return true;
  };

  /* =========================
     SCORING HELPERS
     ========================= */

  // Impact is a hard priority axis (never violated)
  const impactWeight = (impact: PhysicalInsight["impact"]) => impact * 20;

  // Confidence only softly influences ordering
  const confidenceWeight =
    confidenceScore >= 75
      ? 6
      : confidenceScore >= 45
        ? 3
        : 1;

  // Prefer insights that survive sparse data
  const sparsityBonus = (i: PhysicalInsight) => {
    const requiresCount = Object.values(i.requires).filter(
      (v) => v === true,
    ).length;

    // Insights that need less data get a boost
    if (requiresCount <= 1) return 6;
    if (requiresCount === 2) return 3;
    return 0;
  };

  /* =========================
     FILTER + INDEX
     ========================= */

  const indexed = insights
    .map((insight, index) => ({ insight, index }))
    .filter(({ insight }) => satisfiesRequires(insight));

  /* =========================
     BASE SCORE
     ========================= */

  const baseScore = (i: PhysicalInsight) =>
    impactWeight(i.impact) +
    confidenceWeight +
    sparsityBonus(i) +
    10; // baseline stability offset

  /* =========================
     INITIAL SORT
     ========================= */

  const baseSorted = indexed
    .map(({ insight, index }) => ({
      insight,
      index,
      _baseScore: baseScore(insight),
    }))
    .sort((a, b) => {
      // 1️⃣ Impact is absolute
      if (b.insight.impact !== a.insight.impact) {
        return b.insight.impact - a.insight.impact;
      }

      // 2️⃣ Score within same impact
      if (b._baseScore !== a._baseScore) {
        return b._baseScore - a._baseScore;
      }

      // 3️⃣ Stable fallback
      return a.index - b.index;
    });

  /* =========================
     SATURATION PENALTY
     ========================= */

  // Prevent flooding multiple insights of same impact
  const seenByImpact = new Map<PhysicalInsight["impact"], number>();

  const withFinalScore = baseSorted.map((row) => {
    const seen = seenByImpact.get(row.insight.impact) ?? 0;
    const saturationPenalty = -8 * seen;
    seenByImpact.set(row.insight.impact, seen + 1);

    return {
      ...row,
      _finalScore: row._baseScore + saturationPenalty,
    };
  });

  /* =========================
     FINAL SORT (DETERMINISTIC)
     ========================= */

  const finalSorted = withFinalScore.slice().sort((a, b) => {
    if (b.insight.impact !== a.insight.impact) {
      return b.insight.impact - a.insight.impact;
    }
    if (b._finalScore !== a._finalScore) {
      return b._finalScore - a._finalScore;
    }
    return a.index - b.index;
  });

  return finalSorted.map((r) => r.insight);
}
