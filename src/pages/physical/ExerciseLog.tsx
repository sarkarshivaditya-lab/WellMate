import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { PlusIcon, TrashIcon } from "lucide-react";
import { estimateCaloriesFromExercise } from "@/services/nutritionEngine.ts";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel";

/* ---------- Types ---------- */

type ExerciseEntry = Doc<"exercises">;

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

/* ---------- Component ---------- */

export default function ExerciseLog() {
  const today = new Date().toISOString().split("T")[0];

  const exercises = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  }) as ExerciseEntry[] | undefined;

  const user = useQuery(api.users.getCurrentUser);
  const addExercise = useMutation(api.exercises.addExercise);
  const deleteExercise = useMutation(api.exercises.deleteExercise);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [form, setForm] = useState({
    type: "cardio",
    name: "",
    durationMinutes: "",
    notes: "",
  });

  const handleSaveExercise = async () => {
    if (!form.name || !form.durationMinutes) {
      toast.error("Just add a name and duration to continue");
      return;
    }

    const durationMinutes = Number(form.durationMinutes);
    const weightKg = user?.weightKg ?? 70;

    const caloriesBurnedEst = estimateCaloriesFromExercise(
      form.type,
      durationMinutes,
      weightKg,
    );

    try {
      await addExercise({
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
    } catch {
      toast.error("Couldn’t save that just now");
    }
  };

  const handleDeleteExercise = async (exerciseId: Id<"exercises">) => {
    try {
      await deleteExercise({ exerciseId });
      toast.success("Exercise removed");
    } catch {
      toast.error("Couldn’t remove exercise");
    }
  };

  const totalCaloriesBurned =
    exercises?.reduce((sum, ex) => sum + (ex.caloriesBurnedEst ?? 0), 0) ?? 0;

  const totalDuration =
    exercises?.reduce((sum, ex) => sum + (ex.durationMinutes ?? 0), 0) ?? 0;

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
            className="shadow-card hover:brightness-105 active:scale-[0.97]"
          >
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {exercises === undefined ? (
          <div className="divide-y divide-border">
            <ExerciseRowSkeleton />
            <ExerciseRowSkeleton />
          </div>
        ) : exercises.length === 0 ? (
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
            {exercises.map((exercise) => (
              <div
                key={exercise._id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">
                    {exercise.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {exercise.type} · {exercise.durationMinutes} min · ~
                    {exercise.caloriesBurnedEst ?? 0} cal
                  </div>
                  {exercise.notes && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {exercise.notes}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteExercise(exercise._id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
            <DialogDescription>
              Log any activity you’d like to remember
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Exercise Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="cycling">Cycling</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                  <SelectItem value="weightlifting">Weightlifting</SelectItem>
                  <SelectItem value="yoga">Yoga</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name">Exercise Name</Label>
              <Input
                id="name"
                placeholder="e.g., Morning walk"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="30"
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
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Anything you want to remember about it"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSaveExercise}
              className="w-full shadow-card hover:brightness-105 active:scale-[0.97]"
            >
              Save Exercise
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
