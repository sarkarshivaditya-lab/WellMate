import type { FoodAdapter, FoodSearchResult } from "./foodAdapter.interface.ts";
import indianFoods from "@/data/indian_foods.json";

type IndianFood = {
  id: string;
  name: string;
  aliases: string[];
  servingSizeText: string;
  caloriesPerServing: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  micros: Record<string, number>;
};

// Collapse common Hinglish/transliteration variants to a canonical form.
// Applied to both query and candidate strings so comparisons are symmetric.
function normalizeHinglish(s: string): string {
  return s
    .toLowerCase()
    .replace(/iya/g, "ya")                         // biriyani → biryani
    .replace(/aa/g, "a")                           // chaawal → chawal, daal → dal, naan → nan
    .replace(/ee/g, "i")                           // panneer → panir (edit distance covers the rest)
    .replace(/oo/g, "u")                           // aloo → alu, poori → puri
    .replace(/ph/g, "f")                           // phulka → fulka
    .replace(/([bdfghjklmnpqrstvwxyz])\1/g, "$1") // chappati → chapati, tikka → tika, panner → paner
    .trim();
}

// Space-optimised Levenshtein (two-row DP). Safe for short food-name tokens.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99; // bail out on large length gaps

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }

  return prev[b.length];
}

// Two normalized tokens are a fuzzy match if edit distance is within threshold.
// Tokens shorter than 4 chars require exact equality (prevents false positives).
function fuzzyTokenMatch(qt: string, tt: string): boolean {
  if (qt === tt) return true;
  if (qt.length < 4) return false;
  const maxDist = qt.length <= 5 ? 1 : 2;
  return levenshtein(qt, tt) <= maxDist;
}

const TOKEN_SPLIT = /[\s()[\],/]+/;

function scoreMatch(food: IndianFood, rawQuery: string): number {
  const q = normalizeHinglish(rawQuery);
  if (!q) return 0;

  const queryTokens = q.split(TOKEN_SPLIT).filter(Boolean);
  const candidates = [food.name, ...food.aliases].map(normalizeHinglish);
  let best = 0;

  for (const term of candidates) {
    // Exact normalized match
    if (term === q) return 100;

    // Term begins with normalized query (e.g. "alu" → "alu gobi")
    if (term.startsWith(q)) { best = Math.max(best, 85); continue; }

    const termTokens = term.split(TOKEN_SPLIT).filter(Boolean);

    // Any term-token exactly equals the full query ("gobi" in "alu gobi")
    if (termTokens.some((t) => t === q)) { best = Math.max(best, 80); continue; }

    // Any term-token starts with the full query
    if (termTokens.some((t) => t.startsWith(q))) { best = Math.max(best, 70); continue; }

    // Multi-token fuzzy: every query token fuzzy-matches some term token
    // e.g. "paner buter" → ["paner","buter"] each match ["panir","buter"] → score 60
    if (queryTokens.length > 1) {
      const allFuzzy = queryTokens.every((qt) =>
        termTokens.some((tt) => fuzzyTokenMatch(qt, tt)),
      );
      if (allFuzzy) { best = Math.max(best, 60); continue; }
    }

    // Substring fallback (original Phase 1 check)
    if (term.includes(q)) { best = Math.max(best, 50); continue; }

    // Single-token fuzzy: query word ≥ 4 chars fuzzy-matches any term token
    // e.g. "paner" (from "panner") → fuzzy matches "panir" (from "paneer") → score 55
    if (queryTokens.length === 1 && queryTokens[0].length >= 4) {
      if (termTokens.some((tt) => fuzzyTokenMatch(queryTokens[0], tt))) {
        best = Math.max(best, 55);
      }
    }
  }

  return best;
}

export class IndianLocalAdapter implements FoodAdapter {
  async search(query: string): Promise<FoodSearchResult[]> {
    if (!query.trim()) return [];

    return (indianFoods as IndianFood[])
      .map((food) => ({ food, score: scoreMatch(food, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ food }) => ({
        id: food.id,
        name: food.name,
        servingSizeText: food.servingSizeText,
        caloriesPerServing: food.caloriesPerServing,
        proteinG: food.proteinG,
        fatG: food.fatG,
        carbsG: food.carbsG,
        micros: food.micros,
        source: "mock" as const,
        confidence: 1.0,
      }));
  }

  async lookupById(id: string): Promise<FoodSearchResult | null> {
    const food = (indianFoods as IndianFood[]).find((f) => f.id === id);
    if (!food) return null;
    return {
      id: food.id,
      name: food.name,
      servingSizeText: food.servingSizeText,
      caloriesPerServing: food.caloriesPerServing,
      proteinG: food.proteinG,
      fatG: food.fatG,
      carbsG: food.carbsG,
      micros: food.micros,
      source: "mock" as const,
      confidence: 1.0,
    };
  }
}
