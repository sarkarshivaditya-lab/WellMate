import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  const today = new Date().toISOString().split("T")[0];

  const user = useQuery(api.users.getCurrentUser);
  const mealsToday = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const meals7 = useQuery(api.meals.getRecentMeals, { days: 7 });
  const exercisesToday = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  });
  const sleep7 = useQuery(api.sleep.getRecentSleep, { days: 7 });

  // 🔒 LOCAL-FIRST PLACEHOLDER (Convex-safe)
  const exercises7: DatedEntry[] = [];

  // 1️⃣ Still loading Convex queries
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

  // 2️⃣ Authenticated route, but Convex data not hydrated yet
  // Do NOT show auth CTA and do NOT block forever
  if (
    user === null ||
    mealsToday === null ||
    exercisesToday === null ||
    sleep7 === null ||
    meals7 === null
  ) {
    return null;
  }

  /* ---------- TODAY SNAPSHOT ---------- */

  const intakeCalories = mealsToday.reduce(
    (sum: number, m: MealEntry) => sum + m.totalCalories,
    0,
  );

  const burnedCalories =
    exercisesToday.length > 0
      ? exercisesToday.reduce(
          (sum: number, e: ExerciseEntry) =>
            sum + (e.caloriesBurnedEst || 0),
          0,
        )
      : null;

  const energyBalance = calculateEnergyBalance(intakeCalories, burnedCalories);

  /* ---------- MACROS ---------- */

  let macroAdherence = null;

  if (
    user?.dob &&
    user?.heightCm &&
    user?.weightKg &&
    user?.sex &&
    user?.activityLevel &&
    user?.goal
  ) {
    const age = calculateAge(user.dob);
    const bmr = calculateBMR(user.weightKg, user.heightCm, age, user.sex);
    const tdee = calculateTDEE(bmr, user.activityLevel);
    const calorieTarget = calculateCalorieTarget(tdee, user.goal);
    const macroTargets = calculateMacroTargets(
      calorieTarget,
      user.weightKg,
      user.goal,
    );

    const macroTotals = mealsToday.reduce(
      (acc, m: MealEntry) => ({
        protein: acc.protein + m.totalProteinG,
        fat: acc.fat + m.totalFatG,
        carbs: acc.carbs + m.totalCarbsG,
      }),
      { protein: 0, fat: 0, carbs: 0 },
    );

    macroAdherence = calculateMacroAdherence(macroTotals, macroTargets);
  }

  /* ---------- CONSISTENCY ---------- */

  const mealDays = new Set(meals7.map((m) => m.dateIso)).size;

  const sleepDays = new Set(
    sleep7.map((s: DatedEntry) => s.startIso?.split("T")[0]),
  ).size;

  /* ---------- CONFIDENCE ---------- */

  const confidence = calculateConfidenceScore({
    user,
    mealsLast7: meals7,
    exercisesLast7: exercises7, // ✅ safe placeholder
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
        <div className="text-muted-foreground">
          Energy balance today appears{" "}
          {energyBalance === null
            ? "unclear"
            : energyBalance > 0
              ? `slightly above maintenance (+${energyBalance} kcal)`
              : `slightly below maintenance (${Math.abs(
                  energyBalance,
                )} kcal)`}
        </div>

        {macroAdherence && (
          <div className="text-muted-foreground">
            Macronutrient intake — Protein {macroAdherence.proteinPct}%, Fat{" "}
            {macroAdherence.fatPct}%, Carbs {macroAdherence.carbsPct}%
          </div>
        )}

        <div className="text-muted-foreground">
          Over the last week: meals logged on {mealDays} days, sleep tracked on{" "}
          {sleepDays} days
        </div>

        <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground space-y-1">
          {confidence.explanations.map((e, i) => (
            <li key={i}>
              {applyConfidenceToExplanation(e, confidenceLevel)}
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-2">
          {finalInsights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-md border border-border p-3"
            >
              <div className="text-sm font-medium">
                {insight.displayTitle}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {insight.displayBody}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
