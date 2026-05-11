// src/pages/physical/PhysicalInsightsCard.tsx

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

  const user = useQuery(api.users.getCurrentUser);
  const mealsToday = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const meals7 = useQuery(api.meals.getRecentMeals, { days: 7 });
  const exercisesToday = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  });
  const sleep7 = useQuery(api.sleep.getRecentSleep, { days: 7 });

  const exercises7: DatedEntry[] = [];

  if (
    user === undefined ||
    mealsToday === undefined ||
    exercisesToday === undefined ||
    sleep7 === undefined ||
    meals7 === undefined
  ) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Gathering recent patterns…
        </CardContent>
      </Card>
    );
  }

  if (
    user === null ||
    mealsToday === null ||
    exercisesToday === null ||
    sleep7 === null ||
    meals7 === null
  ) {
    return null;
  }

  /* ---------- CONFIDENCE ---------- */

  const confidence = calculateConfidenceScore({
    user,
    mealsLast7: meals7,
    exercisesLast7: exercises7,
    sleepLast7: sleep7,
    mealsToday,
    exercisesToday,
    sleepToday: sleep7.filter((s) =>
      s.startIso?.startsWith(today),
    ),
  });

  const decayedConfidence = applyConfidenceDecay({
    confidenceScore: confidence.confidenceScore,
    daysSinceLastLog: Math.min(
      mealsToday.length === 0 ? 7 : 0,
      exercisesToday.length === 0 ? 7 : 0,
      sleep7.length === 0 ? 7 : 0,
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
    hasMeals: mealsToday.length > 0,
    hasExercise: exercisesToday.length > 0,
    hasSleep: sleep7.length > 0,
    hasProfile: Boolean(
      user?.heightCm && user?.weightKg && user?.activityLevel && user?.goal,
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
              className="rounded-md border border-border p-3"
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
