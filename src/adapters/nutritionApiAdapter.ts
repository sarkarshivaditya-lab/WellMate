import type { FoodAdapter, FoodSearchResult } from "./foodAdapter.interface.ts";
import { MockAdapter } from "./mockAdapter.ts";

const BASE = "https://world.openfoodfacts.org/api/v2/search";
const FIELDS = "code,product_name,serving_size,serving_quantity,nutriments";

type OFFNutriments = {
  "energy-kcal_serving"?: number;
  "energy-kcal_100g"?: number;
  proteins_serving?: number;
  proteins_100g?: number;
  fat_serving?: number;
  fat_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates_100g?: number;
  fiber_serving?: number;
  fiber_100g?: number;
  sodium_serving?: number;
  sodium_100g?: number;
};

type OFFProduct = {
  code?: string;
  product_name?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: OFFNutriments;
};

type OFFResponse = {
  products?: OFFProduct[];
};

function perServing(
  nutriments: OFFNutriments,
  servingQty: number,
  servingKey: keyof OFFNutriments,
  per100Key: keyof OFFNutriments,
): number {
  const direct = nutriments[servingKey];
  if (typeof direct === "number") return Math.round(direct * 10) / 10;
  const per100 = nutriments[per100Key];
  if (typeof per100 === "number") return Math.round((per100 * servingQty) / 100 * 10) / 10;
  return 0;
}

function normalize(product: OFFProduct): FoodSearchResult | null {
  const name = product.product_name?.trim();
  if (!name) return null;

  const n = product.nutriments ?? {};
  const servingQty = product.serving_quantity ?? 100;

  const calories = perServing(n, servingQty, "energy-kcal_serving", "energy-kcal_100g");
  if (calories === 0) return null;

  return {
    id: product.code ?? crypto.randomUUID(),
    name,
    servingSizeText: product.serving_size ?? `${servingQty}g`,
    caloriesPerServing: Math.round(calories),
    proteinG: perServing(n, servingQty, "proteins_serving", "proteins_100g"),
    fatG: perServing(n, servingQty, "fat_serving", "fat_100g"),
    carbsG: perServing(n, servingQty, "carbohydrates_serving", "carbohydrates_100g"),
    micros: {
      ...(n.fiber_serving != null || n.fiber_100g != null
        ? { fiber: perServing(n, servingQty, "fiber_serving", "fiber_100g") }
        : {}),
      ...(n.sodium_serving != null || n.sodium_100g != null
        ? { sodium: perServing(n, servingQty, "sodium_serving", "sodium_100g") }
        : {}),
    },
    source: "nutrition_api",
    confidence: 0.9,
  };
}

export class NutritionApiAdapter implements FoodAdapter {
  private mockFallback = new MockAdapter();

  async search(query: string): Promise<FoodSearchResult[]> {
    try {
      const url = `${BASE}?search_terms=${encodeURIComponent(query)}&page_size=10&fields=${FIELDS}&json=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`OFF ${res.status}`);

      const data: OFFResponse = await res.json();
      const results = (data.products ?? [])
        .map(normalize)
        .filter((r): r is FoodSearchResult => r !== null)
        .slice(0, 8);

      return results.length > 0 ? results : this.mockFallback.search(query);
    } catch {
      return this.mockFallback.search(query);
    }
  }

  async lookupById(id: string): Promise<FoodSearchResult | null> {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(id)}?fields=${FIELDS}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) return null;
      const data = await res.json() as { product?: OFFProduct };
      return data.product ? normalize(data.product) : null;
    } catch {
      return null;
    }
  }
}
