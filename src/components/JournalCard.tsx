import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

interface JournalCardProps {
  entry: Doc<"journalEntries">;
  onDelete?: () => void;
  onClick?: () => void;
}

export default function JournalCard({ entry, onDelete, onClick }: JournalCardProps) {
  const date = new Date(entry.dateIso);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className={onClick ? "cursor-pointer hover:bg-accent" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {formattedDate}
          </CardTitle>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 p-0"
            >
              <Trash2Icon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent onClick={onClick}>
        <p className="text-sm mb-3 line-clamp-3">{entry.text}</p>
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
