import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

interface MoodCardProps {
  mood: Doc<"moods">;
  onClick?: () => void;
}

const moodEmojis = ["😢", "😔", "😐", "😊", "😄"];
const moodLabels = ["Very Low", "Low", "Okay", "Good", "Excellent"];

export default function MoodCard({ mood, onClick }: MoodCardProps) {
  const emoji = moodEmojis[mood.moodValue - 1];
  const label = moodLabels[mood.moodValue - 1];
  const date = new Date(mood.dateIso);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card
      className={cn(onClick && "cursor-pointer hover:bg-accent/30 transition-premium")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{emoji}</span>
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{formattedDate}</p>
            </div>
          </div>
          {mood.note && (
            <div className="text-xs text-muted-foreground max-w-[200px] truncate">
              {mood.note}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
