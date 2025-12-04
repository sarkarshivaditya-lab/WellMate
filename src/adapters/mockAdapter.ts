import type { FoodAdapter, FoodSearchResult } from "./foodAdapter.interface.ts";
import mockFoods from "@/data/mock_foods.json";

function filterMicros(micros: Record<string, number | undefined>): Record<string, number> {
  const filtered: Record<string, number> = {};
  for (const [key, value] of Object.entries(micros)) {
    if (value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export class MockAdapter implements FoodAdapter {
  async search(query: string): Promise<FoodSearchResult[]> {
    const lowerQuery = query.toLowerCase();
    const results = mockFoods
      .filter((food) => food.name.toLowerCase().includes(lowerQuery))
      .slice(0, 5)
      .map((food) => ({
        id: food.id,
        name: food.name,
        servingSizeText: food.servingSizeText,
        caloriesPerServing: food.caloriesPerServing,
        proteinG: food.proteinG,
        fatG: food.fatG,
        carbsG: food.carbsG,
        micros: filterMicros(food.micros),
        source: "mock" as const,
        confidence: 1,
      }));
    return results;
  }

  async lookupById(id: string): Promise<FoodSearchResult | null> {
    const food = mockFoods.find((f) => f.id === id);
    if (!food) return null;
    return {
      id: food.id,
      name: food.name,
      servingSizeText: food.servingSizeText,
      caloriesPerServing: food.caloriesPerServing,
      proteinG: food.proteinG,
      fatG: food.fatG,
      carbsG: food.carbsG,
      micros: filterMicros(food.micros),
      source: "mock",
      confidence: 1,
    };
  }
}
