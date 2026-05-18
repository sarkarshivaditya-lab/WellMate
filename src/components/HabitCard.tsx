import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Trash2, X } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { haptics } from "@/motion";

interface HabitCardProps {
  habit: Doc<"habits">;
  streak: number;
  isCompletedToday: boolean;
  onToggle: () => void;
  onArchive?: () => void;
  onClick?: () => void;
}

export default function HabitCard({
  habit,
  streak,
  isCompletedToday,
  onToggle,
  onArchive,
  onClick,
}: HabitCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="hover:bg-accent/30 transition-premium">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Content area — keyboard-accessible button when onClick is provided */}
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
              aria-label={`View details for ${habit.title}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{habit.title}</h3>
                {streak > 0 && (
                  <Badge variant="secondary" className="text-xs" aria-label={`${streak}-day streak`}>
                    <span aria-hidden>🔥</span> {streak} day{streak > 1 ? "s" : ""}
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
                    <span aria-hidden>⏰</span>{" "}
                    <span className="sr-only">Reminder at</span>
                    {habit.reminderTime}
                  </span>
                )}
              </div>
            </button>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{habit.title}</h3>
                {streak > 0 && (
                  <Badge variant="secondary" className="text-xs" aria-label={`${streak}-day streak`}>
                    <span aria-hidden>🔥</span> {streak} day{streak > 1 ? "s" : ""}
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
                    <span aria-hidden>⏰</span>{" "}
                    <span className="sr-only">Reminder at</span>
                    {habit.reminderTime}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 flex-shrink-0">
            {onArchive && (
              confirming ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 px-3 text-xs"
                    aria-label={`Confirm removing ${habit.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.destructive();
                      onArchive();
                      setConfirming(false);
                    }}
                  >
                    Remove
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label="Cancel remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.dismiss();
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
              )
            )}

            <Button
              size="sm"
              variant={isCompletedToday ? "default" : "outline"}
              aria-label={isCompletedToday ? `Mark ${habit.title} incomplete` : `Mark ${habit.title} complete`}
              aria-pressed={isCompletedToday}
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(false);
                isCompletedToday ? haptics.light() : haptics.complete();
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
