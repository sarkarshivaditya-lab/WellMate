import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusIcon, TrashIcon, X, Dumbbell } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { toast } from "sonner";
import { estimateCaloriesFromExercise } from "@/services/nutritionEngine";
import { useExercisesByDate } from "@/hooks/useExercisesByDate";
import { readOnboardingPayload } from "@/data/local/onboardingPayload";
import { localDateIso } from "@/services/dateUtils";
import { emitAnalyticsEvent } from "@/analytics";
import { haptics } from "@/motion";

/* ---------- Skeleton ---------- */

function ExerciseRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded skeleton-shimmer" />
        <div className="h-3 w-56 rounded skeleton-shimmer" />
      </div>
      <div className="h-8 w-8 rounded skeleton-shimmer" />
    </div>
  );
}

/* ---------- Component ---------- */

export default function ExerciseLog() {
  const today = localDateIso();

  const { exercises, addExercise, deleteExercise } =
    useExercisesByDate(today);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "cardio",
    name: "",
    durationMinutes: "",
    notes: "",
  });

  const handleSaveExercise = () => {
    if (!form.name || !form.durationMinutes) {
      toast.error("Just add a name and duration to continue");
      return;
    }

    const durationMinutes = Number(form.durationMinutes);
    const weightKg = readOnboardingPayload()?.weightKg ?? 70;

    const caloriesBurnedEst = estimateCaloriesFromExercise(
      form.type,
      durationMinutes,
      weightKg,
    );

    addExercise({
      dateIso: today,
      type: form.type,
      name: form.name,
      durationMinutes,
      caloriesBurnedEst,
      notes: form.notes || undefined,
    });

    haptics.complete();
    toast.success("Exercise saved");
    emitAnalyticsEvent({ type: "wellness_logged", entity: "exercise", ts: Date.now() });
    setShowAddExercise(false);
    setForm({ type: "cardio", name: "", durationMinutes: "", notes: "" });
  };

  const totalCaloriesBurned =
    exercises?.reduce((sum, ex) => sum + ex.caloriesBurnedEst, 0) ?? 0;

  const totalDuration =
    exercises?.reduce((sum, ex) => sum + ex.durationMinutes, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Today’s Exercise</CardTitle>
            {exercises.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {totalDuration} min · {totalCaloriesBurned} cal burned
              </p>
            )}
          </div>

          <Button
            onClick={() => setShowAddExercise(true)}
            size="sm"
            className="card-glow"
          >
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {exercises.length === 0 ? (
          <Empty className="border-none bg-transparent py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Dumbbell />
              </EmptyMedia>
              <EmptyTitle className="text-base">Nothing logged today</EmptyTitle>
              <EmptyDescription>
                A short walk or stretch counts — totally optional.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y divide-border">
            {exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{exercise.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {exercise.type} · {exercise.durationMinutes} min · ~
                      {exercise.caloriesBurnedEst} cal
                    </div>

                    {exercise.notes && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {exercise.notes}
                      </div>
                    )}
                  </div>

                  {confirmDeleteId === exercise.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-9 px-3 text-xs"
                        onClick={() => {
                          haptics.destructive();
                          deleteExercise(exercise.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => { haptics.dismiss(); setConfirmDeleteId(null); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { haptics.caution(); setConfirmDeleteId(exercise.id); }}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={showAddExercise}
        onOpenChange={(open) => {
          if (!open) setForm({ type: "cardio", name: "", durationMinutes: "", notes: "" });
          setShowAddExercise(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
            <DialogDescription>
              Log any activity you’d like to remember
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Exercise Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm({ ...form, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="cycling">Cycling</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                  <SelectItem value="weightlifting">
                    Weightlifting
                  </SelectItem>
                  <SelectItem value="yoga">Yoga</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Exercise Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationMinutes: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <Button onClick={handleSaveExercise} className="w-full">
              Save Exercise
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
