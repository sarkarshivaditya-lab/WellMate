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
import type { Id } from "@/convex/_generated/dataModel";

export default function ExerciseLog() {
  const today = new Date().toISOString().split("T")[0];
  const exercises = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  });
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
      toast.error("Please fill in exercise name and duration");
      return;
    }
    const durationMinutes = parseFloat(form.durationMinutes);
    const weightKg = user?.weightKg || 70;
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
      toast.success("Exercise added successfully");
      setShowAddExercise(false);
      setForm({ type: "cardio", name: "", durationMinutes: "", notes: "" });
    } catch (error) {
      toast.error("Failed to add exercise");
    }
  };

  const handleDeleteExercise = async (exerciseId: Id<"exercises">) => {
    try {
      await deleteExercise({ exerciseId });
      toast.success("Exercise deleted");
    } catch (error) {
      toast.error("Failed to delete exercise");
    }
  };

  const totalCaloriesBurned =
    exercises?.reduce(
      (sum: number, ex: any) => sum + (ex.caloriesBurnedEst || 0),
      0,
    ) || 0;
  const totalDuration =
    exercises?.reduce(
      (sum: number, ex: any) => sum + (ex.durationMinutes || 0),
      0,
    ) || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Today's Exercise</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalDuration} min · {totalCaloriesBurned} cal burned
              </p>
            </div>
            <Button onClick={() => setShowAddExercise(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Exercise
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {exercises === undefined ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : exercises.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No exercises logged today
            </div>
          ) : (
            exercises.map((exercise: any) => (
              <Card key={exercise._id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{exercise.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {exercise.type} · {exercise.durationMinutes} min · ~
                        {exercise.caloriesBurnedEst} cal
                      </div>
                      {exercise.notes && (
                        <div className="text-sm text-muted-foreground mt-2">
                          {exercise.notes}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExercise(exercise._id)}
                      className="text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
            <DialogDescription>Log your workout activity</DialogDescription>
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
                placeholder="e.g., Morning Run"
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
                  setForm({ ...form, durationMinutes: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about your workout..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button onClick={handleSaveExercise} className="w-full">
              Save Exercise
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
