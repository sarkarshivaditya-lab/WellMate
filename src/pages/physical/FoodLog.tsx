import { useState } from "react";
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
import { PlusIcon, UtensilsCrossed } from "lucide-react";
import FoodSearchInput from "@/components/FoodSearchInput.tsx";
import MealCard from "@/components/MealCard.tsx";
import type { FoodSearchResult } from "@/adapters/foodAdapter.interface.ts";
import {
  calculateMealTotals,
  foodResultToMealItem,
} from "@/services/mealService.ts";
import type { MealItemData } from "@/services/mealService.ts";
import { toast } from "sonner";
import { useMealsByDate } from "@/hooks/useMealsByDate";
import { localDateIso } from "@/services/dateUtils";
import { emitAnalyticsEvent } from "@/analytics";
import { haptics } from "@/motion";

/* ---------- Skeleton ---------- */

function MealSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-14 rounded-xl skeleton-shimmer" />
      ))}
    </div>
  );
}

/* ---------- Component ---------- */

export default function FoodLog() {
  const today = localDateIso();

  const { meals, addMeal, deleteMeal } = useMealsByDate(today);

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

  const handleSaveMeal = () => {
    if (mealItems.length === 0) {
      toast.error("Add at least one item if you’d like to save this meal");
      return;
    }

    const totals = calculateMealTotals(mealItems);

    addMeal({
      dateIso: today,
      name: mealName || "Meal",
      inputMode,
      items: mealItems,
      ...totals,
    });

    haptics.complete();
    toast.success("Meal saved");
    emitAnalyticsEvent({ type: "wellness_logged", entity: "meal", ts: Date.now() });
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
  };

  const dayTotals = meals.reduce(
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
            {meals.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {dayTotals.calories} cal · P: {dayTotals.protein.toFixed(1)}g ·
                F: {dayTotals.fat.toFixed(1)}g · C: {dayTotals.carbs.toFixed(1)}g
              </p>
            )}
          </div>
          <Button
            onClick={() => setShowAddMeal(true)}
            size="sm"
            className="card-glow"
          >
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!meals ? (
          <MealSkeleton />
        ) : meals.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <UtensilsCrossed className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">No meals logged today</div>
            <div className="text-xs text-muted-foreground/70">
              Logging even one meal can be helpful — optional.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={() => deleteMeal(meal.id)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={showAddMeal}
        onOpenChange={(open) => {
          if (!open) {
            setMealName("");
            setMealItems([]);
            setInputMode("quick");
            setDetailedForm({ name: "", calories: "", protein: "", fat: "", carbs: "" });
          }
          setShowAddMeal(open);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Meal</DialogTitle>
            <DialogDescription>
              Log whatever feels easiest — quick or manual
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Meal Name</Label>
              <Input
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

              <TabsContent value="quick">
                <FoodSearchInput onSelect={handleAddFromSearch} />
              </TabsContent>

              <TabsContent value="detailed" className="space-y-3">
                <Input
                  placeholder="Food name"
                  value={detailedForm.name}
                  onChange={(e) =>
                    setDetailedForm({ ...detailedForm, name: e.target.value })
                  }
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Calories"
                  value={detailedForm.calories}
                  onChange={(e) =>
                    setDetailedForm({ ...detailedForm, calories: e.target.value })
                  }
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Protein (g)"
                    value={detailedForm.protein}
                    onChange={(e) =>
                      setDetailedForm({ ...detailedForm, protein: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Fat (g)"
                    value={detailedForm.fat}
                    onChange={(e) =>
                      setDetailedForm({ ...detailedForm, fat: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Carbs (g)"
                    value={detailedForm.carbs}
                    onChange={(e) =>
                      setDetailedForm({ ...detailedForm, carbs: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleAddDetailed} className="w-full">
                  Add Item
                </Button>
              </TabsContent>
            </Tabs>

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
    </Card>
  );
}
