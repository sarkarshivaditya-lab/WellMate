// src/intelligence/wellnessScore.ts
// Composite wellness score — the foundation for future AI context injection.
// Combines domain scores into a single explainable readiness signal.
// All future AI surfaces should consume THIS layer, not re-derive from raw data.

import { computeSleepScore } from "./sleepIntelligence";
import { computeRecoveryScore } from "./recoveryHeuristics";
import { computeNutritionScore } from "./nutritionIntelligence";
import { computeHabitScore } from "./habitIntelligence";
import type { CompositeWellnessScore, WellnessScore, ScoreLevel } from "./types";

type UserProfile = {
  dob?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  goal?: string;
};

const LEVEL_LABELS: Record<ScoreLevel, string> = {
  high: "Thriving",
  medium: "Building",
  low: "Steadying",
};

const DOMAIN_WEIGHTS = {
  sleep: 0.3,
  activity: 0.25,
  nutrition: 0.25,
  habits: 0.2,
};

// ── Composite Score ───────────────────────────────────────────────────────────

export function computeCompositeWellnessScore(
  profile: UserProfile | null,
): CompositeWellnessScore {
  const sleep = computeSleepScore();
  const activity = computeRecoveryScore();
  const nutrition = computeNutritionScore(profile);
  const habits = computeHabitScore();

  const domains = { sleep, activity, nutrition, habits };

  // Domains with data quality sufficient/partial contribute their actual score.
  // Domains with insufficient data contribute 50 (neutral) so they don't drag the
  // composite down before the user has had a chance to use that feature.
  function domainValue(d: WellnessScore): number {
    return d.dataQuality === "insufficient" ? 50 : d.score;
  }

  const weightedScore =
    domainValue(sleep) * DOMAIN_WEIGHTS.sleep +
    domainValue(activity) * DOMAIN_WEIGHTS.activity +
    domainValue(nutrition) * DOMAIN_WEIGHTS.nutrition +
    domainValue(habits) * DOMAIN_WEIGHTS.habits;

  const score = Math.round(Math.min(100, Math.max(0, weightedScore)));
  const level: ScoreLevel = score >= 68 ? "high" : score >= 45 ? "medium" : "low";

  // Data quality of composite: sufficient if 2+ domains have real data
  const domainsWithData = [sleep, activity, nutrition, habits].filter(
    (d) => d.dataQuality !== "insufficient",
  ).length;
  const dataQuality =
    domainsWithData >= 3
      ? "sufficient"
      : domainsWithData >= 1
        ? "partial"
        : "insufficient";

  // Headline: driven by the weakest area when data exists
  const weakestDomain = [
    { name: "sleep", score: domainValue(sleep), domain: sleep },
    { name: "activity", score: domainValue(activity), domain: activity },
    { name: "nutrition", score: domainValue(nutrition), domain: nutrition },
    { name: "habits", score: domainValue(habits), domain: habits },
  ]
    .filter((d) => d.domain.dataQuality !== "insufficient")
    .sort((a, b) => a.score - b.score)[0];

  let headline: string;
  if (dataQuality === "insufficient") {
    headline = "Start logging to unlock your wellness score";
  } else if (level === "high") {
    headline = LEVEL_LABELS.high + " — strong signals across the board";
  } else if (weakestDomain) {
    const domainNames: Record<string, string> = {
      sleep: "sleep",
      activity: "recovery",
      nutrition: "nutrition",
      habits: "habits",
    };
    headline = `${LEVEL_LABELS[level]} — ${domainNames[weakestDomain.name] ?? weakestDomain.name} is the main area to focus on`;
  } else {
    headline = `${LEVEL_LABELS[level]} — keep building momentum`;
  }

  return {
    score,
    level,
    headline,
    domains,
    dataQuality,
  };
}

// ── AI-ready context snapshot ─────────────────────────────────────────────────
// Returns a structured context object suitable for injecting into AI prompts.
// This is the bridge between deterministic intelligence and future AI surfaces.

export type WellnessContext = {
  compositeScore: number;
  compositeLevel: ScoreLevel;
  domains: {
    sleep: { score: number; headline: string; debt?: number };
    activity: { score: number; headline: string; overtrained?: boolean };
    nutrition: { score: number; headline: string };
    habits: { score: number; headline: string };
  };
  topInsight: string;
};

export function buildWellnessContext(
  profile: UserProfile | null,
): WellnessContext {
  const composite = computeCompositeWellnessScore(profile);

  // Top insight = headline from lowest-scoring domain with data
  const domainsArr = [
    { name: "sleep", score: composite.domains.sleep?.score ?? 50, headline: composite.domains.sleep?.headline ?? "" },
    { name: "activity", score: composite.domains.activity?.score ?? 50, headline: composite.domains.activity?.headline ?? "" },
    { name: "nutrition", score: composite.domains.nutrition?.score ?? 50, headline: composite.domains.nutrition?.headline ?? "" },
    { name: "habits", score: composite.domains.habits?.score ?? 50, headline: composite.domains.habits?.headline ?? "" },
  ].filter((d) => d.headline);

  domainsArr.sort((a, b) => a.score - b.score);
  const topInsight = domainsArr[0]?.headline ?? composite.headline;

  return {
    compositeScore: composite.score,
    compositeLevel: composite.level,
    domains: {
      sleep: {
        score: composite.domains.sleep?.score ?? 50,
        headline: composite.domains.sleep?.headline ?? "",
      },
      activity: {
        score: composite.domains.activity?.score ?? 50,
        headline: composite.domains.activity?.headline ?? "",
      },
      nutrition: {
        score: composite.domains.nutrition?.score ?? 50,
        headline: composite.domains.nutrition?.headline ?? "",
      },
      habits: {
        score: composite.domains.habits?.score ?? 50,
        headline: composite.domains.habits?.headline ?? "",
      },
    },
    topInsight,
  };
}
