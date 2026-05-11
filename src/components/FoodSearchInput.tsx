import { useState } from "react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import type { FoodSearchResult } from "@/adapters/foodAdapter.interface.ts";
import { NutritionApiAdapter } from "@/adapters/nutritionApiAdapter.ts";
import { SearchIcon, Loader2Icon } from "lucide-react";

const foodAdapter = new NutritionApiAdapter();

interface FoodSearchInputProps {
  onSelect: (result: FoodSearchResult, quantity: number) => void;
}

export default function FoodSearchInput({ onSelect }: FoodSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<FoodSearchResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const searchResults = await foodAdapter.search(query);
      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };
  
  const handleSelectResult = (result: FoodSearchResult) => {
    setSelectedResult(result);
    setQuantity(1);
  };
  
  const handleAddFood = () => {
    if (selectedResult) {
      onSelect(selectedResult, quantity);
      setSelectedResult(null);
      setQuery("");
      setResults([]);
      setQuantity(1);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search for food..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
        </Button>
      </div>
      
      {results.length > 0 && !selectedResult && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((result) => (
            <Card
              key={result.id}
              className="p-3 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => handleSelectResult(result)}
            >
              <div className="font-medium">{result.name}</div>
              <div className="text-sm text-muted-foreground">
                {result.servingSizeText} · {result.caloriesPerServing} cal
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                P: {result.proteinG}g · F: {result.fatG}g · C: {result.carbsG}g
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {selectedResult && (
        <Card className="p-4 space-y-4">
          <div>
            <div className="font-medium">{selectedResult.name}</div>
            <div className="text-sm text-muted-foreground">{selectedResult.servingSizeText}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Calories</div>
              <div className="font-medium">{selectedResult.caloriesPerServing} cal</div>
            </div>
            <div>
              <div className="text-muted-foreground">Protein</div>
              <div className="font-medium">{selectedResult.proteinG}g</div>
            </div>
            <div>
              <div className="text-muted-foreground">Fat</div>
              <div className="font-medium">{selectedResult.fatG}g</div>
            </div>
            <div>
              <div className="text-muted-foreground">Carbs</div>
              <div className="font-medium">{selectedResult.carbsG}g</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="quantity" className="text-sm">Servings:</label>
            <Input
              id="quantity"
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
              className="w-20"
            />
            <Button onClick={handleAddFood} className="ml-auto">
              Add to Meal
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
