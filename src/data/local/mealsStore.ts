// src/data/local/mealsStore.ts

export type LocalMeal = {
  id: string;
  dateIso: string;
  name: string;
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  items: Array<{
    name: string;
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    quantity: number;
    unit: string;
  }>;
  synced: boolean;
  updatedAt: number;
};

export type MealsStore = {
  getMealsByDate(dateIso: string): Promise<LocalMeal[]>;
  addMeal(meal: Omit<LocalMeal, "id" | "synced" | "updatedAt">): Promise<void>;
  deleteMeal(mealId: string): Promise<void>;
  markSynced(mealId: string): Promise<void>;
};

