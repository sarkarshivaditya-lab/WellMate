import type { FoodSearchResult } from "@/adapters/foodAdapter.interface.ts";

export interface MealItemData {
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  micronutrientsJson?: string;
  quantity: number;
  unit: string;
}

export interface MealData {
  name: string;
  inputMode: "detailed" | "quick";
  items: MealItemData[];
  sourceAdapter?: string;
}

export function calculateMealTotals(items: MealItemData[]) {
  let totalCalories = 0;
  let totalProteinG = 0;
  let totalFatG = 0;
  let totalCarbsG = 0;
  const micronutrients: Record<string, number> = {};

  for (const item of items) {
    totalCalories += item.calories * item.quantity;
    totalProteinG += item.proteinG * item.quantity;
    totalFatG += item.fatG * item.quantity;
    totalCarbsG += item.carbsG * item.quantity;

    if (item.micronutrientsJson) {
      try {
        const itemMicros = JSON.parse(item.micronutrientsJson);
        for (const [key, value] of Object.entries(itemMicros)) {
          micronutrients[key] = (micronutrients[key] || 0) + (value as number) * item.quantity;
        }
      } catch (error) {
        console.error("Error parsing micronutrients", error);
      }
    }
  }

  return {
    totalCalories: Math.round(totalCalories),
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
    totalCarbsG: Math.round(totalCarbsG * 10) / 10,
    micronutrientsJson: JSON.stringify(micronutrients),
  };
}

export function foodResultToMealItem(
  result: FoodSearchResult,
  quantity: number = 1
): MealItemData {
  return {
    name: result.name,
    calories: result.caloriesPerServing,
    proteinG: result.proteinG,
    fatG: result.fatG,
    carbsG: result.carbsG,
    micronutrientsJson: JSON.stringify(result.micros),
    quantity,
    unit: result.servingSizeText,
  };
}
