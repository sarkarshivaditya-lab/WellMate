// src/pages/physical/_utils/physicalInsights.ts

export type MacroTargets = {
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export type MacroTotals = {
  protein: number;
  fat: number;
  carbs: number;
};

export function calculateEnergyBalance(
  intakeCalories: number,
  burnedCalories: number | null,
) {
  if (burnedCalories === null) return null;
  return intakeCalories - burnedCalories;
}

export function calculateMacroAdherence(
  totals: MacroTotals,
  targets: MacroTargets,
) {
  return {
    proteinPct: Math.round((totals.protein / targets.proteinG) * 100),
    fatPct: Math.round((totals.fat / targets.fatG) * 100),
    carbsPct: Math.round((totals.carbs / targets.carbsG) * 100),
  };
}

export function generateInsightSummary(input: {
  proteinPct: number | null;
  calorieDeficitDays: number;
  mealDays: number;
  sleepDays: number;
}) {
  const insights: string[] = [];

  if (input.proteinPct !== null && input.proteinPct < 80) {
    insights.push("Protein intake has been consistently low");
  }

  if (input.calorieDeficitDays >= 4) {
    insights.push("Frequent calorie deficit this week");
  }

  if (input.mealDays <= 3) {
    insights.push("Meal logging has been inconsistent");
  }

  if (input.sleepDays >= 6) {
    insights.push("Sleep consistency has been strong");
  }

  if (insights.length === 0) {
    insights.push("No major issues detected this week");
  }

  return insights;
}
