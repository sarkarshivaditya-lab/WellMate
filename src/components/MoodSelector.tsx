import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { haptics } from "@/motion";

interface MoodSelectorProps {
  initialMood?: number;
  initialNote?: string;
  onSave: (mood: number, note: string) => void;
  onCancel?: () => void;
}

const moodEmojis = [
  { value: 1, emoji: "😢", label: "Very Low" },
  { value: 2, emoji: "😔", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export default function MoodSelector({
  initialMood,
  initialNote = "",
  onSave,
  onCancel,
}: MoodSelectorProps) {
  const [selectedMood, setSelectedMood] = useState<number | null>(initialMood || null);
  const [note, setNote] = useState(initialNote);

  const handleSave = () => {
    if (selectedMood !== null) {
      haptics.gentle();
      onSave(selectedMood, note);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between gap-2">
          {moodEmojis.map((mood) => (
            <button
              key={mood.value}
              onClick={() => { haptics.light(); setSelectedMood(mood.value); }}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl transition-premium",
                selectedMood === mood.value
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-secondary hover:bg-secondary/80"
              )}
            >
              <span className="text-3xl">{mood.emoji}</span>
              <span className="text-xs text-muted-foreground">{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Add a note (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's on your mind?"
          className="min-h-[100px] resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={selectedMood === null}
          className="flex-1"
        >
          Log mood
        </Button>
        {onCancel && (
          <Button onClick={() => { haptics.dismiss(); onCancel(); }} variant="outline">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
