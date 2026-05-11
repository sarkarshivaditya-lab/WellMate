import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogTrigger,
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
import {
  checkFeatureAccess,
  getFeatureLimit,
} from "@/services/subscriptionUtils";
import {
  addHabit as addLocalHabit,
  archiveHabit,
  listHabits,
  toggleEntry,
  listEntriesByDate,
} from "@/data/local/habitsStore";

export default function Habits() {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "custom">(
    "daily",
  );
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");

  const today = new Date().toISOString().split("T")[0];

  const [habits, setHabits] = useState(() => listHabits());
  const [todayEntries, setTodayEntries] = useState(() => listEntriesByDate(today));

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

    toast.success("Habit created (saved locally)");
    setTitle("");
    setDescription("");
    setShowDialog(false);
  };

  const handleToggle = (localId: string) => {
    toggleEntry(localId, today);
    setTodayEntries(listEntriesByDate(today));
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

  if (!habits) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Habits</h1>
          <p className="text-sm text-muted-foreground">
            Build consistency through daily actions
          </p>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button disabled={!canAddMoreHabits()}>
              <PlusIcon className="h-4 w-4 mr-2" />
              New Habit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Habit</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
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
      </div>

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
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Habit
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <HabitCard
              key={habit.localId}
              habit={habit as never}
              isCompletedToday={isCompletedToday(habit.localId)}
              streak={0}
              onToggle={() => handleToggle(habit.localId)}
              onArchive={() => handleArchive(habit.localId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
