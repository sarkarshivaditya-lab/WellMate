// src/components/quickadd/QuickAddSheet.tsx
// Unified quick-capture entry point for all wellness modules.
// Minimal forms — for full detail, users navigate to dedicated pages.

import React, { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptics } from "@/motion/haptics";
import { localDateIso } from "@/services/dateUtils";

// Store functions
import { upsertMood } from "@/data/local/moodsStore";
import { addJournalEntry } from "@/data/local/journalStore";
import { addExercise } from "@/data/local/exercises";
import { addSleepLog } from "@/data/local/sleepStore";
import { addMeal } from "@/data/local/mealsStore";
import { addHabit } from "@/data/local/habitsStore";

type QuickAddEntity = "mood" | "journal" | "exercise" | "sleep" | "meal" | "habit";

const ENTITIES: { id: QuickAddEntity; label: string; emoji: string }[] = [
  { id: "mood", label: "Mood", emoji: "🌿" },
  { id: "journal", label: "Journal", emoji: "📓" },
  { id: "exercise", label: "Exercise", emoji: "⚡" },
  { id: "sleep", label: "Sleep", emoji: "🌙" },
  { id: "meal", label: "Meal", emoji: "🍽" },
  { id: "habit", label: "Habit", emoji: "🔁" },
];

const MOOD_OPTIONS = [
  { value: 1, emoji: "😔", label: "Very low" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😊", label: "Great" },
];

const EXERCISE_TYPES = [
  "cardio",
  "strength",
  "flexibility",
  "sports",
  "outdoor",
  "other",
];

// ── Mood ─────────────────────────────────────────────────────────────────────

function MoodForm({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const today = localDateIso();

  function handleSubmit() {
    if (!selected) return;
    upsertMood({ dateIso: today, moodValue: selected, note: note.trim() || undefined });
    haptics.complete();
    toast.success("Mood logged");
    onDone();
  }

  return (
    <div className="space-y-5">
      <div
        role="group"
        aria-label="How are you feeling?"
        className="flex justify-between gap-2"
      >
        {MOOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected === opt.value}
            aria-label={opt.label}
            onClick={() => { setSelected(opt.value); haptics.light(); }}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-premium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "min-h-[60px]",
              selected === opt.value
                ? "border-primary bg-primary/10"
                : "border-border bg-muted/40 hover:bg-muted/60",
            )}
          >
            <span aria-hidden className="text-2xl">{opt.emoji}</span>
            <span aria-hidden className="text-[10px] text-muted-foreground font-medium">
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      <Input
        placeholder="Add a note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="bg-muted/40 border-border/60"
      />

      <Button
        onClick={handleSubmit}
        disabled={!selected}
        className="w-full"
      >
        Log mood
      </Button>
    </div>
  );
}

// ── Journal ───────────────────────────────────────────────────────────────────

function JournalForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addJournalEntry({ title: title.trim() || undefined, text: trimmed, tags: [] });
    haptics.complete();
    toast.success("Journal entry saved");
    onDone();
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Title (optional)"
        aria-label="Journal entry title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-muted/40 border-border/60"
      />
      <label htmlFor="journal-text" className="sr-only">Journal entry</label>
      <textarea
        id="journal-text"
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className={cn(
          "w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5",
          "text-sm placeholder:text-muted-foreground resize-none",
          "focus:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-premium",
        )}
      />
      <Button onClick={handleSubmit} disabled={!text.trim()} className="w-full">
        Save entry
      </Button>
    </div>
  );
}

// ── Exercise ──────────────────────────────────────────────────────────────────

function ExerciseForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState("cardio");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  function handleSubmit() {
    if (!name.trim() || !duration) return;
    const mins = parseInt(duration, 10);
    if (!mins || mins <= 0) return;
    addExercise({
      dateIso: localDateIso(),
      type,
      name: name.trim(),
      durationMinutes: mins,
      caloriesBurnedEst: Math.round(mins * 5.5),
    });
    haptics.complete();
    toast.success("Exercise logged");
    onDone();
  }

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Exercise type"
        className="flex flex-wrap gap-1.5"
      >
        {EXERCISE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => { setType(t); haptics.light(); }}
            className={cn(
              "px-3 py-2 rounded-full text-xs font-medium border capitalize transition-premium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "min-h-[36px]",
              type === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <Input
        placeholder="Activity name (e.g. Morning run)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-muted/40 border-border/60"
      />
      <Input
        type="number"
        placeholder="Duration (minutes)"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        min={1}
        className="bg-muted/40 border-border/60"
      />
      <Button
        onClick={handleSubmit}
        disabled={!name.trim() || !duration}
        className="w-full"
      >
        Log exercise
      </Button>
    </div>
  );
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

function SleepForm({ onDone }: { onDone: () => void }) {
  const now = new Date();
  const [bedtime, setBedtime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");
  const [rating, setRating] = useState<number | null>(null);

  function buildIso(timeStr: string, isWake: boolean): string {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    // If wake time implies next calendar day, add 1 day
    if (isWake) {
      const [bh] = bedtime.split(":").map(Number);
      if (h < bh) d.setDate(d.getDate() + 1);
    }
    return d.toISOString();
  }

  function handleSubmit() {
    if (!rating) return;
    addSleepLog({
      startIso: buildIso(bedtime, false),
      endIso: buildIso(wakeTime, true),
      rating,
    });
    haptics.complete();
    toast.success("Sleep logged");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="sleep-bedtime" className="text-xs text-muted-foreground font-medium">
            Bedtime
          </label>
          <Input
            id="sleep-bedtime"
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className="bg-muted/40 border-border/60"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sleep-waketime" className="text-xs text-muted-foreground font-medium">
            Wake time
          </label>
          <Input
            id="sleep-waketime"
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="bg-muted/40 border-border/60"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p id="sleep-quality-label" className="text-xs text-muted-foreground font-medium">Sleep quality</p>
        <div role="group" aria-labelledby="sleep-quality-label" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rating === r}
              aria-label={`Sleep quality ${r} out of 5`}
              onClick={() => { setRating(r); haptics.light(); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-premium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "min-h-[44px]",
                rating === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60",
              )}
            >
              <span aria-hidden>{r}</span>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={!rating} className="w-full">
        Log sleep
      </Button>
    </div>
  );
}

// ── Meal ──────────────────────────────────────────────────────────────────────

function MealForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    const kcal = parseInt(calories, 10) || 0;
    addMeal({
      dateIso: localDateIso(),
      name: name.trim(),
      inputMode: "quick",
      totalCalories: kcal,
      totalProteinG: 0,
      totalFatG: 0,
      totalCarbsG: 0,
      items: [],
    });
    haptics.complete();
    toast.success("Meal logged");
    onDone();
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="What did you eat?"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-muted/40 border-border/60"
      />
      <Input
        type="number"
        placeholder="Calories (optional)"
        value={calories}
        onChange={(e) => setCalories(e.target.value)}
        min={0}
        className="bg-muted/40 border-border/60"
      />
      <p className="text-[11px] text-muted-foreground">
        For full nutrition details, use the meal logger in Physical Health.
      </p>
      <Button onClick={handleSubmit} disabled={!name.trim()} className="w-full">
        Log meal
      </Button>
    </div>
  );
}

// ── Habit ─────────────────────────────────────────────────────────────────────

function HabitForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");

  function handleSubmit() {
    if (!title.trim()) return;
    addHabit({ title: title.trim(), cadence, remindersEnabled: false });
    haptics.complete();
    toast.success("Habit created");
    onDone();
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Habit name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-muted/40 border-border/60"
      />
      <div role="group" aria-label="Habit cadence" className="flex gap-2">
        {(["daily", "weekly"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cadence === c}
            onClick={() => { setCadence(c); haptics.light(); }}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-medium border capitalize transition-premium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "min-h-[44px]",
              cadence === c
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">
        Add habit
      </Button>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  defaultEntity?: QuickAddEntity;
};

export function QuickAddSheet({ open, onClose, defaultEntity = "mood" }: Props) {
  const [active, setActive] = useState<QuickAddEntity>(defaultEntity);

  // Sync defaultEntity when it changes (from command palette context)
  React.useEffect(() => {
    if (open) setActive(defaultEntity);
  }, [open, defaultEntity]);

  const ActiveForm = {
    mood: MoodForm,
    journal: JournalForm,
    exercise: ExerciseForm,
    sleep: SleepForm,
    meal: MealForm,
    habit: HabitForm,
  }[active];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-[20px] px-4 pb-6 pt-0 max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        <SheetHeader className="pb-4 pt-1">
          <SheetTitle className="text-base font-semibold">Quick capture</SheetTitle>
        </SheetHeader>

        {/* Entity type tabs */}
        <div
          role="tablist"
          aria-label="What would you like to log?"
          className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-hide"
        >
          {ENTITIES.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={active === e.id}
              aria-controls={`quickadd-panel-${e.id}`}
              id={`quickadd-tab-${e.id}`}
              type="button"
              onClick={() => { setActive(e.id); haptics.light(); }}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-premium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "min-h-[36px]",
                active === e.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60",
              )}
            >
              <span aria-hidden>{e.emoji}</span>
              <span>{e.label}</span>
            </button>
          ))}
        </div>

        {/* Active form — aria-live announces form switch for screen readers */}
        <div
          role="tabpanel"
          id={`quickadd-panel-${active}`}
          aria-labelledby={`quickadd-tab-${active}`}
          aria-live="polite"
        >
          <ActiveForm onDone={onClose} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
