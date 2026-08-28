import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import ChartPie from "@/components/ChartPie.tsx";
import ChartBar from "@/components/ChartBar.tsx";
import { UtensilsCrossed, Activity } from "lucide-react";
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
import { localDateIso } from "@/services/dateUtils";

export default function Progress() {
  const today = localDateIso();

  const { meals } = useMealsByDate(today);
  const user = useQuery(api.users.getCurrentUser);

  type DayTotals = {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    micros: Record<string, number>;
  };

  const dayTotals = meals.reduce<DayTotals>(
    (acc, meal) => ({
      calories: acc.calories + (Number.isFinite(meal.totalCalories) ? meal.totalCalories : 0),
      protein: acc.protein + (Number.isFinite(meal.totalProteinG) ? meal.totalProteinG : 0),
      fat: acc.fat + (Number.isFinite(meal.totalFatG) ? meal.totalFatG : 0),
      carbs: acc.carbs + (Number.isFinite(meal.totalCarbsG) ? meal.totalCarbsG : 0),
      micros: acc.micros,
    }),
    {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      micros: {},
    },
  );

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
      const tdee = calculateTDEE(
        bmr,
        payload.activityLevel as ActivityLevel,
      );
      calorieTarget = calculateCalorieTarget(
        tdee,
        payload.weightGoal as Goal,
      );
      macroTargets = calculateMacroTargets(
        calorieTarget,
        payload.weightKg,
        payload.weightGoal as Goal,
      );
    }
  }

  const macroSlices = [
    {
      label: "Protein",
      value: Math.max(0, dayTotals.protein),
      color: "oklch(0.55 0.18 160)",
    },
    {
      label: "Fat",
      value: Math.max(0, dayTotals.fat),
      color: "oklch(0.65 0.15 200)",
    },
    {
      label: "Carbs",
      value: Math.max(0, dayTotals.carbs),
      color: "oklch(0.70 0.12 280)",
    },
  ];

  const hasMacroData = macroSlices.some((slice) => slice.value > 0);

  const weeklyExercise = useWeeklyExerciseTrend();

  const weeklyActivityData = weeklyExercise
    .filter((day) => Number.isFinite(day.calories) && day.calories > 0)
    .map((day) => ({
      label: day.label,
      value: Math.round(day.calories),
      target: 0,
      unit: "kcal",
    }));

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
    if (!meal.micronutrientsJson) return;

    try {
      const micros = JSON.parse(meal.micronutrientsJson);

      if (!micros || typeof micros !== "object") return;

      for (const [key, value] of Object.entries(micros)) {
        const numericValue =
          typeof value === "number"
            ? value
            : Number(value);

        if (!Number.isFinite(numericValue)) continue;

        aggregateMicros[key] =
          (aggregateMicros[key] || 0) + numericValue;
      }
    } catch {
      // Ignore malformed optional micronutrient data.
    }
  });

  const micronutrientBarData = Object.entries(
    micronutrientTargets,
  ).map(([key, target]) => {
    const value = Math.max(
      0,
      aggregateMicros[key] || 0,
    );

    const label = key
      .replace(/_(mcg|mg)$/, "")
      .replace(/_/g, " ");

    const unit = key.endsWith("_mg")
      ? "mg"
      : key.endsWith("_mcg")
        ? "μg"
        : "";

    return {
      label,
      value: Math.round(value),
      target,
      unit,
    };
  });

  const hasMicronutrientData = micronutrientBarData.some(
    (item) => item.value > 0,
  );

  const hasActivityData = weeklyActivityData.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Daily Summary</CardTitle>
          <CardDescription>
            Your nutrition for today
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">
                Calories
              </div>
              <div className="text-xl font-semibold">
                {dayTotals.calories}
              </div>
              <div className="text-xs text-muted-foreground">
                of {calorieTarget}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                Protein
              </div>
              <div className="text-xl font-semibold">
                {dayTotals.protein.toFixed(1)}g
              </div>
              <div className="text-xs text-muted-foreground">
                of {macroTargets.proteinG}g
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                Fat
              </div>
              <div className="text-xl font-semibold">
                {dayTotals.fat.toFixed(1)}g
              </div>
              <div className="text-xs text-muted-foreground">
                of {macroTargets.fatG}g
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                Carbs
              </div>
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
            {hasMacroData ? (
              <ChartPie
                data={macroSlices.filter(
                  (slice) => slice.value > 0,
                )}
                size={220}
              />
            ) : (
              <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <UtensilsCrossed className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  No nutritional values logged today
                </p>
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
            {hasActivityData ? (
              <ChartBar
                data={weeklyActivityData}
                height={240}
              />
            ) : (
              <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  No activity logged yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasMicronutrientData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Micronutrients
            </CardTitle>
            <CardDescription>
              Today's logged micronutrients
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ChartBar
              data={micronutrientBarData.filter(
                (item) => item.value > 0,
              )}
              height={240}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
