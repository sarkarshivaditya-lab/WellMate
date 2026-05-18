import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HabitMomentumCard } from "@/components/intelligence/HabitMomentumCard";
import { computeHabitScore, computeHabitStats } from "@/intelligence/habitIntelligence";
import PageLayout from "@/components/layout/PageLayout";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
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
import { PlusIcon, Target } from "lucide-react";
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
} from "@/data/local/habitsStore";
import { localDateIso } from "@/services/dateUtils";
import { useFeatureTracker, emitAnalyticsEvent } from "@/analytics";
import { haptics } from "@/motion";

export default function Habits() {
  useFeatureTracker("habits");
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "custom">(
    "daily",
  );
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");

  const today = localDateIso();

  const [habits, setHabits] = useState(() => listHabits());
  const [todayEntries, setTodayEntries] = useState(() => listEntriesByDate(today));
  const [allEntries, setAllEntries] = useState(() => listAllEntries());

  // Memoized so intelligence doesn't recompute on dialog/input re-renders —
  // only recomputes when actual habit data changes.
  const habitScore = useMemo(() => computeHabitScore(), [allEntries]);
  const habitStats = useMemo(() => computeHabitStats(), [allEntries]);

  const handleAddHabit = () => {
    if (!title.trim()) {
      toast.error("Please enter a habit title");
      return;
    }

    const limit = getFeatureLimit("habits-max", null);
    if (limit !== null && habits.length >= limit) {
      toast.error(
        `Free plan limited to ${limit} habits. Upgrade to Pro for unlimited habits.`,
      );
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
    setTitle("");
    setDescription("");
    setShowDialog(false);
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
      {/* Dialog is rendered here so it shares state with headerRight button */}
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) { setTitle(""); setDescription(""); setCadence("daily"); setRemindersEnabled(false); }
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

      {!canAddMoreHabits() && (
        <GatedFeatureBanner
          feature="Unlimited Habits"
          description={`You've reached the free plan limit of ${getFeatureLimit("habits-max", null)} habits`}
          onUpgrade={() => navigate("/pricing")}
        />
      )}

      {habits.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Target />
            </EmptyMedia>
            <EmptyTitle>No habits yet</EmptyTitle>
            <EmptyDescription>
              Start building consistency with your first habit
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <PlusIcon className="h-4 w-4" />
              Create Habit
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          <HabitMomentumCard habitScore={habitScore} habitStats={habitStats} />

          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitCard
                key={habit.localId}
                habit={habit as never}
                isCompletedToday={isCompletedToday(habit.localId)}
                streak={computeStreak(habit.localId, allEntries)}
                onToggle={() => handleToggle(habit.localId)}
                onArchive={() => handleArchive(habit.localId)}
              />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
