import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, Trash2, X } from "lucide-react";
import { haptics } from "@/lib/haptics";
import type { Habit } from "@/data/local/habits";

interface HabitCardProps {
  habit: Habit;
  isCompletedToday: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

export function HabitCard({ habit, isCompletedToday, onToggle, onDelete }: HabitCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => {
        setConfirming(false);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{habit.title}</h3>
            {habit.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{habit.description}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {confirming ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Cancel deleting ${habit.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirming(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive"
                  aria-label={`Confirm remove ${habit.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    haptics.caution();
                    onDelete();
                    setConfirming(false);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${habit.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  haptics.caution();
                  setConfirming(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}

            <Button
              size="sm"
              variant={isCompletedToday ? "default" : "outline"}
              aria-label={isCompletedToday ? `Mark ${habit.title} incomplete` : `Mark ${habit.title} complete`}
              aria-pressed={isCompletedToday}
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(false);
                if (isCompletedToday) {
                  haptics.light();
                } else {
                  haptics.complete();
                }
                onToggle();
              }}
            >
              {isCompletedToday ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              ) : (
                <Circle className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
