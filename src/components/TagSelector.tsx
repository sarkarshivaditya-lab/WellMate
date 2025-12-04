import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface TagSelectorProps {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

const availableTags = [
  "stress",
  "gratitude",
  "productivity",
  "tiredness",
  "anxious",
  "happy",
  "calm",
  "energized",
  "frustrated",
  "hopeful",
];

export default function TagSelector({ selectedTags, onToggleTag }: TagSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Tags (optional)</Label>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <Badge
              key={tag}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onToggleTag(tag)}
            >
              {tag}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
