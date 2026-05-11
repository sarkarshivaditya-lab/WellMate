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
import { PlusIcon, TrashIcon, X } from "lucide-react";
import { toast } from "sonner";
import { estimateCaloriesFromExercise } from "@/services/nutritionEngine";
import { useExercisesByDate } from "@/hooks/useExercisesByDate";

/* ---------- Skeleton ---------- */

function ExerciseRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 py-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-3 w-56 rounded bg-muted" />
      </div>
      <div className="h-8 w-8 rounded bg-muted" />
    </div>
  );
}

/* ---------- Sync Badge (UI-Only) ---------- */

type SyncStatus = "pending" | "synced" | "error";

type ExerciseWithSyncStatus = {
  syncStatus?: unknown;
};

function normalizeSyncStatus(value: unknown): SyncStatus {
  if (value === "synced" || value === "error" || value === "pending") {
    return value;
  }
  return "pending";
}

function SyncBadge({ status }: { status?: SyncStatus }) {
  const s = status ?? "pending";

  if (s === "synced") {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
        synced
      </span>
    );
  }

  if (s === "error") {
    return (
      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
        error
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
      pending
    </span>
  );
}

/* ---------- Component ---------- */

export default function ExerciseLog() {
  const today = new Date().toISOString().split("T")[0];

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
    const weightKg = 70;

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

    toast.success("Exercise saved");
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
            <p className="mt-1 text-sm text-muted-foreground">
              {totalDuration} min · {totalCaloriesBurned} cal burned
            </p>
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
          <div className="py-8 text-center space-y-1">
            <div className="text-sm text-muted-foreground">
              No exercise logged yet today
            </div>
            <div className="text-xs text-muted-foreground">
              Even a short walk or stretch can be helpful — totally optional.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {exercises.map((exercise) => {
              const syncStatus = normalizeSyncStatus(
                (exercise as ExerciseWithSyncStatus).syncStatus,
              );

              return (
                <div
                  key={exercise.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">
                        {exercise.name}
                      </div>
                      <SyncBadge status={syncStatus} />
                    </div>

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
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          deleteExercise(exercise.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDeleteId(exercise.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
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
            <div>
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

            <div>
              <Label>Exercise Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationMinutes: e.target.value,
                  })
                }
              />
            </div>

            <div>
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
