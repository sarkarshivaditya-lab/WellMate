import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import ChartPie from "@/components/ChartPie.tsx";
import ChartBar from "@/components/ChartBar.tsx";
import { useWeeklyExerciseTrend } from "@/hooks/useWeeklyExerciseTrend";
import { useMealsByDate } from "@/hooks/useMealsByDate";
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacroTargets,
  calculateAge,
  type ActivityLevel,
  type Goal,
} from "@/services/nutritionEngine.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { readOnboardingPayload } from "@/data/local/onboardingPayload";

export default function Progress() {
  const today = new Date().toISOString().split("T")[0];

  /* =========================
     DATA SOURCES
     ========================= */

  const { meals } = useMealsByDate(today);
  const user = useQuery(api.users.getCurrentUser);

  /* =========================
     DAILY TOTALS (LOCAL)
     ========================= */

  type DayTotals = {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    micros: Record<string, number>;
  };

  const initialTotals: DayTotals = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    micros: {},
  };

  const dayTotals = meals.reduce(
    (acc: DayTotals, meal): DayTotals => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProteinG,
      fat: acc.fat + meal.totalFatG,
      carbs: acc.carbs + meal.totalCarbsG,
      micros: acc.micros,
    }),
    initialTotals,
  );

  /* =========================
     TARGETS
     ========================= */

  let calorieTarget = 2000;
  let macroTargets = { proteinG: 150, fatG: 67, carbsG: 200 };

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
    calorieTarget = calculateCalorieTarget(tdee, user.goal);
    macroTargets = calculateMacroTargets(
      calorieTarget,
      user.weightKg,
      user.goal,
    );
  } else {
    const payload = readOnboardingPayload();
    if (
      payload?.dob &&
      payload?.heightCm &&
      payload?.weightKg &&
      payload?.sex &&
      payload?.activityLevel &&
      payload?.weightGoal
    ) {
      const age = calculateAge(payload.dob);
      const bmr = calculateBMR(
        payload.weightKg,
        payload.heightCm,
        age,
        payload.sex as "male" | "female" | "other",
      );
      const tdee = calculateTDEE(bmr, payload.activityLevel as ActivityLevel);
      calorieTarget = calculateCalorieTarget(tdee, payload.weightGoal as Goal);
      macroTargets = calculateMacroTargets(
        calorieTarget,
        payload.weightKg,
        payload.weightGoal as Goal,
      );
    }
  }

  /* =========================
     CHART DATA
     ========================= */

  const pieData =
    meals.length > 0
      ? [
          {
            label: "Protein",
            value: dayTotals.protein,
            color: "oklch(0.55 0.18 160)",
          },
          {
            label: "Fat",
            value: dayTotals.fat,
            color: "oklch(0.65 0.15 200)",
          },
          {
            label: "Carbs",
            value: dayTotals.carbs,
            color: "oklch(0.70 0.12 280)",
          },
        ]
      : [];

  /* =========================
     WEEKLY ACTIVITY (LOCAL)
     ========================= */

  const weeklyExercise = useWeeklyExerciseTrend();

  const weeklyActivityData = weeklyExercise.map((d) => ({
    label: d.label,
    value: Math.round(d.calories),
    target: 0,
    unit: "kcal",
  }));

  /* =========================
     MICROS (LOCAL)
     ========================= */

  const micronutrientTargets: Record<string, number> = {
    vitaminA_mcg: 900,
    vitaminC_mg: 90,
    vitaminD_mcg: 20,
    vitaminB12_mcg: 2.4,
    calcium_mg: 1000,
    iron_mg: 8,
  };

  const aggregateMicros: Record<string, number> = {};
  meals.forEach((meal) => {
    if (meal.micronutrientsJson) {
      try {
        const micros = JSON.parse(meal.micronutrientsJson);
        for (const [key, value] of Object.entries(micros)) {
          aggregateMicros[key] =
            (aggregateMicros[key] || 0) + (value as number);
        }
      } catch {
        /* silent */
      }
    }
  });

  const barData = Object.entries(micronutrientTargets)
    .map(([key, target]) => {
      const value = aggregateMicros[key] || 0;
      const label = key.split("_")[0];
      const unit = key.includes("_mg")
        ? "mg"
        : key.includes("_mcg")
          ? "μg"
          : "";
      return { label, value: Math.round(value), target, unit };
    })
    .filter((d) => d.value > 0);

  /* =========================
     RENDER
     ========================= */

  return (
    <div className="space-y-4">
      {/* DAILY SUMMARY */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Daily Summary</CardTitle>
          <CardDescription>Your nutrition for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Calories</div>
              <div className="text-xl font-semibold">
                {dayTotals.calories}
              </div>
              <div className="text-xs text-muted-foreground">
                of {calorieTarget}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Protein</div>
              <div className="text-xl font-semibold">
                {dayTotals.protein.toFixed(1)}g
              </div>
              <div className="text-xs text-muted-foreground">
                of {macroTargets.proteinG}g
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Fat</div>
              <div className="text-xl font-semibold">
                {dayTotals.fat.toFixed(1)}g
              </div>
              <div className="text-xs text-muted-foreground">
                of {macroTargets.fatG}g
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Carbs</div>
              <div className="text-xl font-semibold">
                {dayTotals.carbs.toFixed(1)}g
              </div>
              <div className="text-xs text-muted-foreground">
                of {macroTargets.carbsG}g
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CHARTS */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Macronutrient Distribution
            </CardTitle>
            <CardDescription>
              Relative balance for today
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {pieData.length > 0 ? (
              <ChartPie data={pieData} size={220} />
            ) : (
              <div className="py-10 text-sm text-muted-foreground">
                No meals logged today
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Weekly Activity
            </CardTitle>
            <CardDescription>
              Calories burned over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyActivityData.length > 0 ? (
              <ChartBar data={weeklyActivityData} height={240} />
            ) : (
              <div className="py-10 text-sm text-muted-foreground">
                No activity logged yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
