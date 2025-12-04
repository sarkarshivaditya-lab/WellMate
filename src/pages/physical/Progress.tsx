import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import ChartPie from "@/components/ChartPie.tsx";
import ChartBar from "@/components/ChartBar.tsx";
import { calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacroTargets, calculateAge } from "@/services/nutritionEngine.ts";

export default function Progress() {
  const today = new Date().toISOString().split("T")[0];
  const meals = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const user = useQuery(api.users.getCurrentUser);
  
  const dayTotals = meals?.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProteinG,
      fat: acc.fat + meal.totalFatG,
      carbs: acc.carbs + meal.totalCarbsG,
      micros: acc.micros,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0, micros: {} as Record<string, number> }
  );
  
  let calorieTarget = 2000;
  let macroTargets = { proteinG: 150, fatG: 67, carbsG: 200 };
  
  if (user?.dob && user?.heightCm && user?.weightKg && user?.sex && user?.activityLevel && user?.goal) {
    const age = calculateAge(user.dob);
    const bmr = calculateBMR(user.weightKg, user.heightCm, age, user.sex);
    const tdee = calculateTDEE(bmr, user.activityLevel);
    calorieTarget = calculateCalorieTarget(tdee, user.goal);
    macroTargets = calculateMacroTargets(calorieTarget, user.weightKg, user.goal);
  }
  
  const pieData = dayTotals ? [
    { label: "Protein", value: dayTotals.protein, color: "oklch(0.55 0.18 160)" },
    { label: "Fat", value: dayTotals.fat, color: "oklch(0.65 0.15 200)" },
    { label: "Carbs", value: dayTotals.carbs, color: "oklch(0.70 0.12 280)" },
  ] : [];
  
  const micronutrientTargets: Record<string, number> = {
    vitaminA_mcg: 900,
    vitaminC_mg: 90,
    vitaminD_mcg: 20,
    vitaminB12_mcg: 2.4,
    calcium_mg: 1000,
    iron_mg: 8,
  };
  
  const aggregateMicros: Record<string, number> = {};
  meals?.forEach((meal) => {
    if (meal.micronutrientsJson) {
      try {
        const micros = JSON.parse(meal.micronutrientsJson);
        for (const [key, value] of Object.entries(micros)) {
          aggregateMicros[key] = (aggregateMicros[key] || 0) + (value as number);
        }
      } catch (error) {
        console.error("Error parsing micros", error);
      }
    }
  });
  
  const barData = Object.entries(micronutrientTargets)
    .map(([key, target]) => {
      const value = aggregateMicros[key] || 0;
      const label = key.split("_")[0];
      const unit = key.includes("_mg") ? "mg" : key.includes("_mcg") ? "μg" : "";
      return { label, value: Math.round(value), target, unit };
    })
    .filter((d) => d.value > 0);
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daily Summary</CardTitle>
          <CardDescription>Your nutrition for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Calories</div>
              <div className="text-2xl font-bold">{dayTotals?.calories || 0}</div>
              <div className="text-xs text-muted-foreground">of {calorieTarget}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Protein</div>
              <div className="text-2xl font-bold">{dayTotals?.protein.toFixed(1) || 0}g</div>
              <div className="text-xs text-muted-foreground">of {macroTargets.proteinG}g</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Fat</div>
              <div className="text-2xl font-bold">{dayTotals?.fat.toFixed(1) || 0}g</div>
              <div className="text-xs text-muted-foreground">of {macroTargets.fatG}g</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Carbs</div>
              <div className="text-2xl font-bold">{dayTotals?.carbs.toFixed(1) || 0}g</div>
              <div className="text-xs text-muted-foreground">of {macroTargets.carbsG}g</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Macronutrient Distribution</CardTitle>
            <CardDescription>Today's protein, fat, and carbs</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {pieData.length > 0 ? (
              <ChartPie data={pieData} size={240} />
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No meals logged today
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Micronutrient Intake</CardTitle>
            <CardDescription>Percentage of daily targets</CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ChartBar data={barData} height={280} />
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No micronutrient data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
