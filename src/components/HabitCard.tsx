import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

interface HabitCardProps {
  habit: Doc<"habits">;
  streak: number;
  isCompletedToday: boolean;
  onToggle: () => void;
  onClick?: () => void;
}

export default function HabitCard({
  habit,
  streak,
  isCompletedToday,
  onToggle,
  onClick,
}: HabitCardProps) {
  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1" onClick={onClick}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{habit.title}</h3>
              {streak > 0 && (
                <Badge variant="secondary" className="text-xs">
                  🔥 {streak} day{streak > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {habit.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {habit.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs capitalize">
                {habit.cadence}
              </Badge>
              {habit.reminderTime && (
                <span className="text-xs text-muted-foreground">
                  ⏰ {habit.reminderTime}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant={isCompletedToday ? "default" : "outline"}
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isCompletedToday ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
