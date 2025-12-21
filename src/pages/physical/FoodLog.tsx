import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { PlusIcon } from "lucide-react";
import FoodSearchInput from "@/components/FoodSearchInput.tsx";
import MealCard from "@/components/MealCard.tsx";
import type { FoodSearchResult } from "@/adapters/foodAdapter.interface.ts";
import {
  calculateMealTotals,
  foodResultToMealItem,
} from "@/services/mealService.ts";
import type { MealItemData } from "@/services/mealService.ts";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function FoodLog() {
  const today = new Date().toISOString().split("T")[0];
  const meals = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const addMeal = useMutation(api.meals.addMeal);
  const deleteMeal = useMutation(api.meals.deleteMeal);

  const [showAddMeal, setShowAddMeal] = useState(false);
  const [inputMode, setInputMode] = useState<"quick" | "detailed">("quick");
  const [mealName, setMealName] = useState("");
  const [mealItems, setMealItems] = useState<MealItemData[]>([]);

  const [detailedForm, setDetailedForm] = useState({
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });

  const handleAddFromSearch = (result: FoodSearchResult, quantity: number) => {
    const item = foodResultToMealItem(result, quantity);
    setMealItems([...mealItems, item]);
    if (!mealName) {
      setMealName(result.name);
    }
  };

  const handleAddDetailed = () => {
    if (!detailedForm.name || !detailedForm.calories) {
      toast.error("Please fill in meal name and calories");
      return;
    }
    const item: MealItemData = {
      name: detailedForm.name,
      calories: parseFloat(detailedForm.calories),
      proteinG: parseFloat(detailedForm.protein) || 0,
      fatG: parseFloat(detailedForm.fat) || 0,
      carbsG: parseFloat(detailedForm.carbs) || 0,
      quantity: 1,
      unit: "serving",
    };
    setMealItems([...mealItems, item]);
    if (!mealName) {
      setMealName(detailedForm.name);
    }
    setDetailedForm({
      name: "",
      calories: "",
      protein: "",
      fat: "",
      carbs: "",
    });
  };

  const handleSaveMeal = async () => {
    if (mealItems.length === 0) {
      toast.error("Please add at least one item to the meal");
      return;
    }
    const totals = calculateMealTotals(mealItems);
    try {
      await addMeal({
        dateIso: today,
        name: mealName || "Unnamed Meal",
        inputMode,
        items: mealItems,
        sourceAdapter: inputMode === "quick" ? "mock" : undefined,
        ...totals,
      });
      toast.success("Meal added successfully");
      setShowAddMeal(false);
      setMealName("");
      setMealItems([]);
      setDetailedForm({
        name: "",
        calories: "",
        protein: "",
        fat: "",
        carbs: "",
      });
    } catch (error) {
      toast.error("Failed to add meal");
    }
  };

  const handleDeleteMeal = async (mealId: Id<"meals">) => {
    try {
      await deleteMeal({ mealId });
      toast.success("Meal deleted");
    } catch (error) {
      toast.error("Failed to delete meal");
    }
  };

  const dayTotals = meals?.reduce(
    (acc: any, meal: any) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProteinG,
      fat: acc.fat + meal.totalFatG,
      carbs: acc.carbs + meal.totalCarbsG,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Today's Meals</CardTitle>
              {dayTotals && (
                <p className="text-sm text-muted-foreground mt-1">
                  {dayTotals.calories} cal · P: {dayTotals.protein.toFixed(1)}g
                  · F: {dayTotals.fat.toFixed(1)}g · C:{" "}
                  {dayTotals.carbs.toFixed(1)}g
                </p>
              )}
            </div>
            <Button onClick={() => setShowAddMeal(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Meal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {meals === undefined ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : meals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No meals logged today
            </div>
          ) : (
            meals.map((meal: any) => (
              <MealCard
                key={meal._id}
                meal={meal}
                onDelete={() => handleDeleteMeal(meal._id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddMeal} onOpenChange={setShowAddMeal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Meal</DialogTitle>
            <DialogDescription>
              Search for foods or enter nutrition details manually
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="mealName">Meal Name</Label>
              <Input
                id="mealName"
                placeholder="e.g., Breakfast, Lunch"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
              />
            </div>

            <Tabs
              value={inputMode}
              onValueChange={(v) => setInputMode(v as typeof inputMode)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick">Quick Search</TabsTrigger>
                <TabsTrigger value="detailed">Detailed Entry</TabsTrigger>
              </TabsList>

              <TabsContent value="quick" className="space-y-4">
                <FoodSearchInput onSelect={handleAddFromSearch} />
              </TabsContent>

              <TabsContent value="detailed" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="detailName">Food Name</Label>
                    <Input
                      id="detailName"
                      placeholder="e.g., Grilled Chicken"
                      value={detailedForm.name}
                      onChange={(e) =>
                        setDetailedForm({
                          ...detailedForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="calories">Calories</Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="0"
                      value={detailedForm.calories}
                      onChange={(e) =>
                        setDetailedForm({
                          ...detailedForm,
                          calories: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="protein">Protein (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      placeholder="0"
                      value={detailedForm.protein}
                      onChange={(e) =>
                        setDetailedForm({
                          ...detailedForm,
                          protein: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="fat">Fat (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      placeholder="0"
                      value={detailedForm.fat}
                      onChange={(e) =>
                        setDetailedForm({
                          ...detailedForm,
                          fat: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="carbs">Carbs (g)</Label>
                    <Input
                      id="carbs"
                      type="number"
                      placeholder="0"
                      value={detailedForm.carbs}
                      onChange={(e) =>
                        setDetailedForm({
                          ...detailedForm,
                          carbs: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <Button onClick={handleAddDetailed} className="w-full">
                  Add Item
                </Button>
              </TabsContent>
            </Tabs>

            {mealItems.length > 0 && (
              <div className="space-y-2">
                <Label>Items in this meal:</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {mealItems.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm p-2 bg-muted rounded"
                    >
                      <span>{item.name}</span>
                      <span>
                        {Math.round(item.calories * item.quantity)} cal
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveMeal}
              className="w-full"
              disabled={mealItems.length === 0}
            >
              Save Meal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
