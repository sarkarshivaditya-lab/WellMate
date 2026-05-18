import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HabitMomentumCard } from "@/components/intelligence/HabitMomentumCard";
import {
  computeHabitScore,
  computeHabitStats,
  computeHabitConsistencyProfile,
} from "@/intelligence/habitIntelligence";
import PageLayout from "@/components/layout/PageLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import HabitCard from "@/components/HabitCard";
import GatedFeatureBanner from "@/components/GatedFeatureBanner";
import {
  PlusIcon,
  Moon,
  Footprints,
  Utensils,
  Wind,
  BookOpen,
  Zap,
  Shield,
  Droplets,
  Heart,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getFeatureLimit } from "@/services/subscriptionUtils";
import {
  addHabit as addLocalHabit,
  archiveHabit,
  listHabits,
  toggleEntry,
  listEntriesByDate,
  listAllEntries,
  computeStreak,
  type LocalHabit,
  type LocalHabitEntry,
} from "@/data/local/habitsStore";
import { localDateIso } from "@/services/dateUtils";
import { useFeatureTracker, emitAnalyticsEvent } from "@/analytics";
import { haptics } from "@/motion";

// ── Category system ───────────────────────────────────────────────────────────

type HabitCategory =
  | "sleep"
  | "movement"
  | "nutrition"
  | "mindfulness"
  | "focus"
  | "energy"
  | "recovery";

const CATEGORY_CONFIG: Record<
  HabitCategory,
  { label: string; textColor: string; icon: LucideIcon }
> = {
  sleep:       { label: "Sleep",       textColor: "text-blue-400/80",   icon: Moon },
  movement:    { label: "Movement",    textColor: "text-emerald-400/80", icon: Footprints },
  nutrition:   { label: "Nutrition",   textColor: "text-amber-400/80",  icon: Utensils },
  mindfulness: { label: "Mindfulness", textColor: "text-violet-400/80", icon: Wind },
  focus:       { label: "Focus",       textColor: "text-sky-400/80",    icon: BookOpen },
  energy:      { label: "Energy",      textColor: "text-orange-400/80", icon: Zap },
  recovery:    { label: "Recovery",    textColor: "text-rose-400/80",   icon: Shield },
};

function inferCategory(title: string, description?: string): HabitCategory | null {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  if (/sleep|rest|wind.?down|bedtime|nap|wake up/.test(text)) return "sleep";
  if (/walk|run|gym|exercise|stretch|yoga|workout|steps|cardio|strength|lift|move|active/.test(text)) return "movement";
  if (/eat|drink|water|meal|food|fruit|vegetable|cook|protein|vitamin|supplement|caffeine|calor|nutriti|log.*meal|meal.*log/.test(text)) return "nutrition";
  if (/meditat|breath|journal|gratitude|mindful|reflect|pause|calm|aware/.test(text)) return "mindfulness";
  if (/read|learn|study|practice|skill|plan|review|write|focus|book|course/.test(text)) return "focus";
  if (/energize|energi|coffee|boost|refresh|recharge/.test(text)) return "energy";
  if (/foam.?roll|massage|ice|recover|recovery|rehabilit|cool.?down/.test(text)) return "recovery";
  return null;
}

// ── Suggested habits ──────────────────────────────────────────────────────────

type SuggestedHabit = {
  title: string;
  description: string;
  cadence: "daily" | "weekly";
  icon: LucideIcon;
  category: HabitCategory;
  why: string;
};

const SUGGESTED_HABITS: SuggestedHabit[] = [
  {
    title: "Drink water on waking",
    description: "Start the day hydrated",
    cadence: "daily",
    icon: Droplets,
    category: "nutrition",
    why: "Morning hydration supports energy and mental clarity throughout the day.",
  },
  {
    title: "10-minute walk",
    description: "A short walk, morning or evening",
    cadence: "daily",
    icon: Footprints,
    category: "movement",
    why: "Low-friction movement builds the foundation for a more active lifestyle.",
  },
  {
    title: "Wind down before bed",
    description: "No screens 30 minutes before sleep",
    cadence: "daily",
    icon: Moon,
    category: "sleep",
    why: "A consistent wind-down routine helps your body prepare naturally for rest.",
  },
  {
    title: "5-minute breathing",
    description: "Slow, intentional breathing",
    cadence: "daily",
    icon: Wind,
    category: "mindfulness",
    why: "Brief breathwork reduces cortisol and grounds the nervous system.",
  },
  {
    title: "Read for 20 minutes",
    description: "Books, articles, or long-form writing",
    cadence: "daily",
    icon: BookOpen,
    category: "focus",
    why: "Sustained reading trains focused attention and builds knowledge steadily.",
  },
  {
    title: "Log your meals",
    description: "A quick note of what you ate",
    cadence: "daily",
    icon: Utensils,
    category: "nutrition",
    why: "Awareness of eating patterns is the first step toward nutritional balance.",
  },
  {
    title: "Stretch after sitting",
    description: "A few minutes after long desk time",
    cadence: "daily",
    icon: Activity,
    category: "recovery",
    why: "Brief stretching reduces tension and supports posture over time.",
  },
  {
    title: "Write one thing you're grateful for",
    description: "One line is enough",
    cadence: "daily",
    icon: Heart,
    category: "mindfulness",
    why: "A gratitude practice gently shifts attention toward what's going well.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHabitWeekDots(habitLocalId: string, allEntries: LocalHabitEntry[]): boolean[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toLocaleDateString("en-CA");
    return allEntries.some(
      (e) => e.habitLocalId === habitLocalId && e.dateIso === iso && e.completed,
    );
  });
}

function getWeekAggregate(habits: LocalHabit[], allEntries: LocalHabitEntry[]): boolean[] {
  if (habits.length === 0) return Array(7).fill(false) as boolean[];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toLocaleDateString("en-CA");
    return habits.some((h) =>
      allEntries.some(
        (e) => e.habitLocalId === h.localId && e.dateIso === iso && e.completed,
      ),
    );
  });
}

// ── Components ────────────────────────────────────────────────────────────────

function TodayMomentumCard({
  completedToday,
  totalHabits,
  weekAggregate,
}: {
  completedToday: number;
  totalHabits: number;
  weekAggregate: boolean[];
}) {
  const headline =
    totalHabits === 0
      ? "Add a habit to start tracking."
      : completedToday === totalHabits
      ? "All set for today."
      : completedToday === 0
      ? "Ready whenever you are."
      : "Building momentum.";

  const today = new Date();
  const DAY_SHORTS = ["S", "M", "T", "W", "T", "F", "S"];
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return DAY_SHORTS[d.getDay()];
  });

  return (
    <div className="rounded-2xl border border-border/20 bg-muted/15 px-4 py-4">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
            Today
          </p>
          <p className="text-[13px] font-medium text-foreground/80 leading-snug">
            {headline}
          </p>
        </div>
        {totalHabits > 0 && (
          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-bold tabular-nums text-foreground/90">
              {completedToday}
            </span>
            <span className="text-sm text-muted-foreground">/{totalHabits}</span>
          </div>
        )}
      </div>

      <div className="flex items-end gap-[7px]">
        {weekAggregate.map((done, i) => (
          <div key={i} className="flex flex-col items-center gap-[5px]">
            <span
              className={cn(
                "inline-block h-[7px] w-[7px] rounded-full transition-colors",
                done
                  ? "bg-primary/55"
                  : i === 6
                  ? "ring-1 ring-primary/25 bg-transparent"
                  : "bg-muted-foreground/12",
              )}
            />
            <span className="text-[9px] text-muted-foreground/35 font-medium select-none">
              {dayLabels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestedHabits({
  onAdd,
}: {
  onAdd: (title: string, description: string, cadence: "daily" | "weekly") => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">
        Suggested habits to start with
      </p>
      {SUGGESTED_HABITS.map((s) => {
        const config = CATEGORY_CONFIG[s.category];
        const Icon = s.icon;
        return (
          <button
            key={s.title}
            type="button"
            onClick={() => onAdd(s.title, s.description, s.cadence)}
            className="w-full flex items-start gap-3 rounded-2xl border border-border/15 bg-muted/10 px-4 py-3.5 text-left hover:bg-muted/20 active:bg-muted/25 transition-colors touch-manipulation"
          >
            <div className="mt-0.5 flex-shrink-0 rounded-lg bg-muted/25 p-1.5">
              <Icon className={cn("h-3.5 w-3.5", config.textColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-[13px] font-medium text-foreground/85">{s.title}</span>
                <span className={cn("text-[10px] font-medium", config.textColor)}>
                  {config.label}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground/65 leading-snug">{s.why}</p>
            </div>
            <PlusIcon className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 mt-1" />
          </button>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Habits() {
  useFeatureTracker("habits");
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "custom">("daily");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");

  const today = localDateIso();

  const [habits, setHabits] = useState(() => listHabits());
  const [todayEntries, setTodayEntries] = useState(() => listEntriesByDate(today));
  const [allEntries, setAllEntries] = useState(() => listAllEntries());

  const habitScore = useMemo(() => computeHabitScore(), [allEntries]);
  const habitStats = useMemo(() => computeHabitStats(), [allEntries]);
  const consistencyProfile = useMemo(
    () => computeHabitConsistencyProfile(),
    [allEntries, habits],
  );
  const weekAggregate = useMemo(
    () => getWeekAggregate(habits, allEntries),
    [habits, allEntries],
  );
  const completedTodayCount = useMemo(
    () => habits.filter((h) => todayEntries.some((e) => e.habitLocalId === h.localId && e.completed)).length,
    [habits, todayEntries],
  );

  const handleAddHabit = () => {
    if (!title.trim()) {
      toast.error("Please enter a habit title");
      return;
    }
    const limit = getFeatureLimit("habits-max", null);
    if (limit !== null && habits.length >= limit) {
      toast.error(`Free plan limited to ${limit} habits. Upgrade to Pro for unlimited habits.`);
      navigate("/pricing");
      return;
    }
    addLocalHabit({
      title,
      description: description || undefined,
      cadence,
      remindersEnabled,
      reminderTime: remindersEnabled ? reminderTime : undefined,
    });
    setHabits(listHabits());
    haptics.complete();
    toast.success("Habit created");
    emitAnalyticsEvent({ type: "wellness_logged", entity: "habit", ts: Date.now() });
    setTitle("");
    setDescription("");
    setShowDialog(false);
  };

  const handleAddSuggested = (
    suggestedTitle: string,
    suggestedDesc: string,
    suggestedCadence: "daily" | "weekly",
  ) => {
    const limit = getFeatureLimit("habits-max", null);
    if (limit !== null && habits.length >= limit) {
      toast.error(`Free plan limited to ${limit} habits. Upgrade to Pro for unlimited habits.`);
      navigate("/pricing");
      return;
    }
    addLocalHabit({
      title: suggestedTitle,
      description: suggestedDesc || undefined,
      cadence: suggestedCadence,
      remindersEnabled: false,
    });
    setHabits(listHabits());
    haptics.complete();
    toast.success("Habit added");
    emitAnalyticsEvent({ type: "wellness_logged", entity: "habit", ts: Date.now() });
  };

  const handleToggle = (localId: string) => {
    const wasComplete = isCompletedToday(localId);
    toggleEntry(localId, today);
    if (!wasComplete) {
      haptics.complete();
      emitAnalyticsEvent({ type: "wellness_logged", entity: "habit", ts: Date.now() });
    } else {
      haptics.light();
    }
    setTodayEntries(listEntriesByDate(today));
    setAllEntries(listAllEntries());
  };

  const handleArchive = (localId: string) => {
    archiveHabit(localId);
    setHabits(listHabits());
    toast.success("Habit removed");
  };

  const isCompletedToday = (localId: string): boolean => {
    const entry = todayEntries.find((e) => e.habitLocalId === localId);
    return entry?.completed || false;
  };

  const canAddMoreHabits = () => {
    const limit = getFeatureLimit("habits-max", null);
    if (limit === null) return true;
    return habits.length < limit;
  };

  return (
    <PageLayout
      title="Habits"
      subtitle="Small, repeatable actions that add up."
      headerRight={
        <Button
          size="sm"
          disabled={!canAddMoreHabits()}
          onClick={() => setShowDialog(true)}
        >
          <PlusIcon className="h-4 w-4" />
          New Habit
        </Button>
      }
    >
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            setTitle("");
            setDescription("");
            setCadence("daily");
            setRemindersEnabled(false);
          }
          setShowDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Habit</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={cadence}
                onValueChange={(v: typeof cadence) => setCadence(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Reminders</Label>
              <Switch
                checked={remindersEnabled}
                onCheckedChange={setRemindersEnabled}
              />
            </div>

            {remindersEnabled && (
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            )}

            <Button className="w-full" onClick={handleAddHabit}>
              Create Habit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {!canAddMoreHabits() && (
          <GatedFeatureBanner
            feature="Unlimited Habits"
            description={`You've reached the free plan limit of ${getFeatureLimit("habits-max", null)} habits`}
            onUpgrade={() => navigate("/pricing")}
          />
        )}

        <TodayMomentumCard
          completedToday={completedTodayCount}
          totalHabits={habits.length}
          weekAggregate={weekAggregate}
        />

        {habits.length === 0 ? (
          <SuggestedHabits onAdd={handleAddSuggested} />
        ) : (
          <>
            <HabitMomentumCard habitScore={habitScore} habitStats={habitStats} />

            {consistencyProfile.overloadRisk && (
              <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground/80 mb-0.5">Many habits active</p>
                <p>
                  Focusing on one or two habits at a time often builds more lasting consistency
                  than maintaining many at once. Consider archiving a few until these feel steady.
                </p>
              </div>
            )}

            {!consistencyProfile.overloadRisk &&
              consistencyProfile.hasReturnOpportunity &&
              habits.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <p>Some habits are ready to continue whenever you are. Every return counts.</p>
                </div>
              )}

            <div className="space-y-3">
              {habits.map((habit) => {
                const category = inferCategory(habit.title, habit.description);
                const categoryConfig = category ? CATEGORY_CONFIG[category] : null;
                const weekDots = getHabitWeekDots(habit.localId, allEntries);
                return (
                  <HabitCard
                    key={habit.localId}
                    habit={habit as never}
                    isCompletedToday={isCompletedToday(habit.localId)}
                    streak={computeStreak(habit.localId, allEntries)}
                    onToggle={() => handleToggle(habit.localId)}
                    onArchive={() => handleArchive(habit.localId)}
                    categoryLabel={categoryConfig?.label}
                    categoryColor={categoryConfig?.textColor}
                    weekDots={weekDots}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
