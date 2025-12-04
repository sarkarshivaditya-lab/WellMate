export type FoodSearchResult = {
  id: string;
  name: string;
  servingSizeText: string;
  caloriesPerServing: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  micros: { [nutrient: string]: number };
  source: "mock" | "nutrition_api";
  confidence?: number;
};

export interface FoodAdapter {
  search(query: string): Promise<FoodSearchResult[]>;
  lookupById(id: string): Promise<FoodSearchResult | null>;
}
