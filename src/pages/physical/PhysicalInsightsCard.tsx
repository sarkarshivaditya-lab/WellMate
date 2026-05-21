// src/pages/physical/PhysicalInsightsCard.tsx

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import { physicalInsights } from "./_utils/physicalInsightCatalog";
import { rankPhysicalInsights } from "./_utils/rankPhysicalInsights";
import { suppressInsights } from "./_utils/insightSuppression";
import { applyInsightMemory } from "./_utils/insightMemory";
import { modulateInsightCopy } from "./_utils/insightCopyModulation";
import { applyInsightSaturation } from "./_utils/insightSaturation";
import { calculateConfidenceScore } from "./_utils/confidenceScoring";
import { applyConfidenceToExplanation } from "./_utils/confidenceExplanation";
import { applyConfidenceDecay } from "./_utils/confidenceDecay";
import {
  calculateEnergyBalance,
  calculateMacroAdherence,
} from "./_utils/physicalInsights";
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacroTargets,
  calculateAge,
} from "@/services/nutritionEngine";

import { dispatchInsightAction } from "./_utils/insightActionDispatcher";
import { localDateIso } from "@/services/dateUtils";

type DatedEntry = { dateIso?: string; startIso?: string };
type MealEntry = {
  dateIso: string;
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
};
type ExerciseEntry = {
  caloriesBurnedEst?: number;
};

export default function PhysicalInsightsCard() {
  const today = localDateIso();
  const navigate = useNavigate();

  const profile = useLocalProfile();
  const mealsToday = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const meals7 = useQuery(api.meals.getRecentMeals, { days: 7 });
  const exercisesToday = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  });
  const sleep7 = useQuery(api.sleep.getRecentSleep, { days: 7 });

  const exercises7: DatedEntry[] = [];

  // On Android, Convex queries may never resolve if the backend is unreachable.
  // After 4 seconds, treat any still-pending query as empty so the card renders.
  const [queryResolved, setQueryResolved] = React.useState(false);
  React.useEffect(() => {
    if (
      mealsToday !== undefined &&
      meals7 !== undefined &&
      exercisesToday !== undefined &&
      sleep7 !== undefined
    ) {
      setQueryResolved(true);
      return;
    }
    const t = setTimeout(() => setQueryResolved(true), 4000);
    return () => clearTimeout(t);
  }, [mealsToday, meals7, exercisesToday, sleep7]);

  if (!queryResolved) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-28 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-3/4 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // Treat null (no backend access) or undefined (timed out) as empty — card
  // renders with available local-first data and graceful empty insights.
  const safeMealsToday = mealsToday ?? [];
  const safeMeals7 = meals7 ?? [];
  const safeExercisesToday = exercisesToday ?? [];
  const safeSleep7 = sleep7 ?? [];

  const userForScoring = profile
    ? {
        dob: profile.dob,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel ?? undefined,
        goal: profile.goal ?? undefined,
      }
    : null;

  /* ---------- CONFIDENCE ---------- */

  const confidence = calculateConfidenceScore({
    user: userForScoring,
    mealsLast7: safeMeals7,
    exercisesLast7: exercises7,
    sleepLast7: safeSleep7,
    mealsToday: safeMealsToday,
    exercisesToday: safeExercisesToday,
    sleepToday: safeSleep7.filter((s) =>
      s.startIso?.startsWith(today),
    ),
  });

  const decayedConfidence = applyConfidenceDecay({
    confidenceScore: confidence.confidenceScore,
    daysSinceLastLog: Math.min(
      safeMealsToday.length === 0 ? 7 : 0,
      safeExercisesToday.length === 0 ? 7 : 0,
      safeSleep7.length === 0 ? 7 : 0,
    ),
  });

  const confidenceLevel =
    decayedConfidence >= 75
      ? "high"
      : decayedConfidence >= 45
        ? "medium"
        : "low";

  /* ---------- INSIGHTS ---------- */

  const rankedInsights = rankPhysicalInsights({
    insights: physicalInsights,
    confidenceScore: confidence.confidenceScore,
    hasMeals: safeMealsToday.length > 0,
    hasExercise: safeExercisesToday.length > 0,
    hasSleep: safeSleep7.length > 0,
    hasProfile: Boolean(
      profile?.heightCm && profile?.weightKg && profile?.activityLevel && profile?.goal,
    ),
  });

  const visibleInsights = suppressInsights(
    rankedInsights.map((i) => ({
      ...i,
      confidenceScore: confidence.confidenceScore,
    })),
  );

  const memoryFiltered = applyInsightMemory({
    insights: visibleInsights,
    confidenceScore: confidence.confidenceScore,
    todayIso: today,
  });

  const finalInsights = applyInsightSaturation(
    memoryFiltered.map((i) =>
      modulateInsightCopy(i, confidence.confidenceLevel),
    ),
  );

  /* ---------- RENDER ---------- */

  if (finalInsights.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Health Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Start logging meals, exercise, and sleep to unlock personalised health insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Health Insights</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-3">
          {finalInsights.map((insight) => (
            <li
              key={insight.id}
              className="rounded-xl bg-muted/40 px-4 py-3"
            >
              <div className="font-medium">{insight.displayTitle}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {insight.displayBody}
              </div>

              {insight.action && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      dispatchInsightAction({
                        insight,
                        navigate,
                      })
                    }
                  >
                    {insight.action.label}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
