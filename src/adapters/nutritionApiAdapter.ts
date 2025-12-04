import type { FoodAdapter, FoodSearchResult } from "./foodAdapter.interface.ts";
import { MockAdapter } from "./mockAdapter.ts";

export class NutritionApiAdapter implements FoodAdapter {
  private mockFallback = new MockAdapter();
  
  async search(query: string): Promise<FoodSearchResult[]> {
    const provider = import.meta.env.VITE_NUT_PROVIDER;
    const apiKey = import.meta.env.VITE_NUT_API_KEY;
    
    if (!provider || !apiKey) {
      console.warn("NutritionApiAdapter: No API key configured, falling back to mock");
      return this.mockFallback.search(query);
    }
    
    try {
      // TODO: Implement actual API calls to Nutritionix or Edamam
      // Example for Nutritionix:
      // const response = await fetch(`https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(query)}`, {
      //   headers: {
      //     'x-app-id': appId,
      //     'x-app-key': apiKey,
      //   },
      // });
      // const data = await response.json();
      // return this.normalizeNutritionixResults(data);
      
      console.warn("NutritionApiAdapter: API integration not yet implemented, falling back to mock");
      return this.mockFallback.search(query);
    } catch (error) {
      console.error("NutritionApiAdapter: Error fetching from API, falling back to mock", error);
      return this.mockFallback.search(query);
    }
  }

  async lookupById(id: string): Promise<FoodSearchResult | null> {
    // For now, fallback to mock for ID lookups
    return this.mockFallback.lookupById(id);
  }
}
