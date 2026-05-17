import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocalJournalEntry } from "@/data/local/journalStore";
import { haptics } from "@/motion";

const MOOD_EMOJIS = ["😢", "😔", "😐", "😊", "😄"];

interface JournalCardProps {
  entry: LocalJournalEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function JournalCard({ entry, onEdit, onDelete }: JournalCardProps) {
  const date = new Date(entry.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card
      className={cn(
        "group transition-premium",
        onEdit && "cursor-pointer hover:bg-accent/30",
      )}
      onClick={onEdit}
    >
      <CardContent className="p-4">
        {/* Meta row: mood + date + action buttons */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {entry.mood !== undefined && (
              <span className="text-base leading-none flex-shrink-0" aria-label={MOOD_EMOJIS[entry.mood - 1]}>
                {MOOD_EMOJIS[entry.mood - 1]}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground truncate">
              {formattedDate} · {formattedTime}
            </span>
          </div>

          <div
            className="flex items-center gap-0.5 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label="Edit entry"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); haptics.destructive(); onDelete(); }}
                aria-label="Delete entry"
              >
                <Trash2Icon className="h-3.5 w-3.5 text-destructive/70" />
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        {entry.title && (
          <p className="text-sm font-semibold leading-snug mb-1">{entry.title}</p>
        )}

        {/* Body preview */}
        <p className="text-[13px] text-foreground/80 leading-relaxed line-clamp-3">{entry.text}</p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
