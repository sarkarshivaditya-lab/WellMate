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
import type { Doc, Id } from "@/convex/_generated/dataModel";

/* ---------- Types ---------- */

type MealWithItems = Doc<"meals"> & {
  items: Doc<"mealItems">[];
};

/* ---------- Skeleton ---------- */

function MealSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-14 rounded-md bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

/* ---------- Component ---------- */

export default function FoodLog() {
  const today = new Date().toISOString().split("T")[0];

  const meals = useQuery(api.meals.getMealsByDate, {
    dateIso: today,
  }) as MealWithItems[] | undefined;

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
    setMealItems((prev) => [...prev, item]);
    if (!mealName) setMealName(result.name);
  };

  const handleAddDetailed = () => {
    if (!detailedForm.name || !detailedForm.calories) {
      toast.error("Just add a name and calories to continue");
      return;
    }

    const item: MealItemData = {
      name: detailedForm.name,
      calories: Number(detailedForm.calories),
      proteinG: Number(detailedForm.protein) || 0,
      fatG: Number(detailedForm.fat) || 0,
      carbsG: Number(detailedForm.carbs) || 0,
      quantity: 1,
      unit: "serving",
    };

    setMealItems((prev) => [...prev, item]);
    if (!mealName) setMealName(detailedForm.name);

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
      toast.error("Add at least one item if you’d like to save this meal");
      return;
    }

    const totals = calculateMealTotals(mealItems);

    try {
      await addMeal({
        dateIso: today,
        name: mealName || "Meal",
        inputMode,
        items: mealItems,
        sourceAdapter: inputMode === "quick" ? "mock" : undefined,
        ...totals,
      });

      toast.success("Meal saved");
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
    } catch {
      toast.error("Couldn’t save that meal just now");
    }
  };

  const handleDeleteMeal = async (mealId: Id<"meals">) => {
    try {
      await deleteMeal({ mealId });
      toast.success("Meal removed");
    } catch {
      toast.error("Couldn’t remove that meal");
    }
  };

  const dayTotals = meals?.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProteinG,
      fat: acc.fat + meal.totalFatG,
      carbs: acc.carbs + meal.totalCarbsG,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Today’s Meals</CardTitle>
            {dayTotals && (
              <p className="mt-1 text-sm text-muted-foreground">
                {dayTotals.calories} cal · P: {dayTotals.protein.toFixed(1)}g ·
                F: {dayTotals.fat.toFixed(1)}g · C: {dayTotals.carbs.toFixed(1)}
                g
              </p>
            )}
          </div>
          <Button
            onClick={() => setShowAddMeal(true)}
            size="sm"
            className="shadow-card hover:brightness-105 active:scale-[0.97]"
          >
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {meals === undefined ? (
          <MealSkeleton />
        ) : meals.length === 0 ? (
          <div className="py-6 text-center space-y-1">
            <div className="text-sm text-muted-foreground">
              No meals logged yet today
            </div>
            <div className="text-xs text-muted-foreground">
              If you want, you can log even one meal — totally optional.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div key={meal._id} className="rounded-md border border-border">
                <MealCard
                  meal={meal}
                  onDelete={() => handleDeleteMeal(meal._id)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showAddMeal} onOpenChange={setShowAddMeal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Meal</DialogTitle>
            <DialogDescription>
              Log whatever feels easiest — quick search or manual entry
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
              onValueChange={(v) => setInputMode(v as "quick" | "detailed")}
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

                <Button
                  onClick={handleAddDetailed}
                  className="w-full shadow-card hover:brightness-105 active:scale-[0.97]"
                >
                  Add Item
                </Button>
              </TabsContent>
            </Tabs>

            {mealItems.length > 0 && (
              <div className="space-y-2">
                <Label>Items in this meal</Label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {mealItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-xs text-muted-foreground"
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
              className="w-full shadow-card hover:brightness-105 active:scale-[0.97]"
              disabled={mealItems.length === 0}
            >
              Save Meal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
