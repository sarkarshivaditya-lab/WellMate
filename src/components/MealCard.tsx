import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { TrashIcon } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

interface MealWithItems extends Doc<"meals"> {
  items: Doc<"mealItems">[];
}

interface MealCardProps {
  meal: MealWithItems;
  onDelete?: () => void;
}

export default function MealCard({ meal, onDelete }: MealCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{meal.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {meal.totalCalories} cal · P: {meal.totalProteinG}g · F: {meal.totalFatG}g · C: {meal.totalCarbsG}g
            </p>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      {meal.items.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-1">
            {meal.items.map((item) => (
              <div key={item._id} className="text-sm flex justify-between">
                <span className="text-muted-foreground">
                  {item.quantity > 1 && `${item.quantity}x `}
                  {item.name}
                </span>
                <span>{Math.round(item.calories * item.quantity)} cal</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
