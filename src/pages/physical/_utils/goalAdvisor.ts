// src/pages/physical/_utils/goalAdvisor.ts

export type GoalAdviceInput = {
  goal: "lose" | "maintain" | "gain";
  surplusDays: number;
  deficitDays: number;
  avgProteinPct: number | null;
  mealDays: number;
};

export function generateGoalAdvice(input: GoalAdviceInput) {
  const advice: string[] = [];

  if (input.mealDays < 4) {
    advice.push(
      "Insufficient meal logging this week — recommendations may be inaccurate",
    );
    return advice;
  }

  if (input.goal === "lose" && input.surplusDays >= 4) {
    advice.push("Consider reducing calorie target by ~150 kcal");
  }

  if (input.goal === "gain" && input.deficitDays >= 4) {
    advice.push("Consider increasing calorie target by ~150 kcal");
  }

  if (input.avgProteinPct !== null && input.avgProteinPct < 70) {
    advice.push(
      "Protein target may be unrealistically high for current habits",
    );
  }

  if (advice.length === 0) {
    advice.push("Current goals appear well aligned with your habits");
  }

  return advice;
}
