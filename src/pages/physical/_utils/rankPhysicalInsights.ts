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

  const satisfiesRequires = (i: PhysicalInsight) => {
    if (i.requires.meals && !hasMeals) return false;
    if (i.requires.exercise && !hasExercise) return false;
    if (i.requires.sleep && !hasSleep) return false;
    if (i.requires.profile && !hasProfile) return false;
    return true;
  };

  const impactWeight = (impact: PhysicalInsight["impact"]) => impact * 20;
  const confidenceWeight = confidenceScore * 0.3;

  const indexed = insights
    .map((insight, index) => ({ insight, index }))
    .filter(({ insight }) => satisfiesRequires(insight));

  const baseScore = (i: PhysicalInsight) =>
    impactWeight(i.impact) + confidenceWeight + 10;

  // Deterministic sort priority:
  // 1) impact desc (hard rule: impact=1 can never outrank impact=3)
  // 2) rankScore desc
  // 3) original order (stable fallback)
  const baseSorted = indexed
    .map(({ insight, index }) => ({
      insight,
      index,
      _baseScore: baseScore(insight),
    }))
    .sort((a, b) => {
      if (b.insight.impact !== a.insight.impact) {
        return b.insight.impact - a.insight.impact;
      }
      if (b._baseScore !== a._baseScore) {
        return b._baseScore - a._baseScore;
      }
      return a.index - b.index;
    });

  // Saturation penalty is applied based on the final sorted order.
  // For multiple insights with the same impact:
  // 1st => 0, 2nd => -8, 3rd => -16, 4th => -24, ...
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

  // Final deterministic sort with the same priorities, using final score.
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
