import { Button } from "@/components/ui/button.tsx";
import { TrashIcon } from "lucide-react";
import { haptics } from "@/motion";

interface DisplayMealItem {
  name: string;
  quantity: number;
  calories: number;
}

interface DisplayMeal {
  name: string;
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  items: DisplayMealItem[];
}

interface MealCardProps {
  meal: DisplayMeal;
  onDelete?: () => void;
}

export default function MealCard({ meal, onDelete }: MealCardProps) {
  return (
    <div className="rounded-xl bg-muted/40 px-4 py-3 transition-premium hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug">{meal.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {meal.totalCalories} cal · P: {meal.totalProteinG}g · F: {meal.totalFatG}g · C: {meal.totalCarbsG}g
          </div>
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { haptics.destructive(); onDelete!(); }}
            className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
      {meal.items.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {meal.items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex justify-between text-xs text-muted-foreground">
              <span>
                {item.quantity > 1 && `${item.quantity}× `}
                {item.name}
              </span>
              <span>{Math.round(item.calories * item.quantity)} cal</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
