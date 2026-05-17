import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { PlusIcon, TrashIcon, WifiOff, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { localDateIso } from "@/services/dateUtils";
import { haptics } from "@/motion";
import { useConnectivity } from "@/hooks/useConnectivity";

export default function PeriodTracker() {
  const connectivity = useConnectivity();
  const user = useQuery(api.users.getCurrentUser);
  const cycles = useQuery(api.cycles.getCycles);
  const addCycle = useMutation(api.cycles.addCycle);
  const deleteCycle = useMutation(api.cycles.deleteCycle);
  // Must be declared unconditionally — hooks cannot be called after early returns
  const setPeriodTracking = useMutation(api.users.setPeriodTracking);

  const [showAddCycle, setShowAddCycle] = useState(false);
  const [form, setForm] = useState({
    startDate: "",
    lengthDays: "",
    notes: "",
  });

  // 1️⃣ Offline — Convex queries will never resolve; show a calm placeholder
  if (connectivity === "offline" && user === undefined) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <WifiOff className="h-7 w-7 text-muted-foreground/30" aria-hidden="true" />
          <div>
            <p className="text-sm text-muted-foreground">Period tracking is available when online.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Your data is safe and will load when you reconnect.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 2️⃣ Convex still loading
  if (user === undefined) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-3/4 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // 3️⃣ Authenticated route, but user record not ready yet
  if (user === null) {
    return null;
  }

  // 4️⃣ Feature gating based on profile flag
  if (!user.periodTrackingEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Period Tracking</CardTitle>
          <CardDescription>Not enabled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Enable period tracking to log your cycles and get predictions.
          </p>
          <Button
            onClick={async () => {
              try {
                await setPeriodTracking({ enabled: true });
              } catch {
                toast.error("Couldn't enable period tracking");
              }
            }}
          >
            Enable Period Tracking
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSaveCycle = async () => {
    if (!form.startDate) {
      toast.error("Please enter a start date");
      return;
    }
    try {
      await addCycle({
        startDateIso: form.startDate,
        lengthDays: form.lengthDays ? parseFloat(form.lengthDays) : undefined,
        notes: form.notes || undefined,
      });
      haptics.complete();
      toast.success("Cycle logged");
      setShowAddCycle(false);
      setForm({ startDate: "", lengthDays: "", notes: "" });
    } catch {
      toast.error("Couldn't save this cycle — please try again");
    }
  };

  const handleDeleteCycle = async (cycleId: Id<"cycles">) => {
    try {
      haptics.destructive();
      await deleteCycle({ cycleId });
      toast.success("Cycle removed");
    } catch {
      toast.error("Couldn't remove this cycle");
    }
  };

  const sortedCycles = cycles
    ? [...cycles].sort(
        (a, b) =>
          new Date(b.startDateIso).getTime() -
          new Date(a.startDateIso).getTime(),
      )
    : [];

  const predictNextPeriod = () => {
    if (!sortedCycles || sortedCycles.length < 2) return null;

    const cycleLengths = sortedCycles
      .slice(0, -1)
      .map((cycle, i) => {
        const nextCycle = sortedCycles[i + 1];
        const start = new Date(cycle.startDateIso);
        const nextStart = new Date(nextCycle.startDateIso);
        return Math.abs(
          (start.getTime() - nextStart.getTime()) /
            (1000 * 60 * 60 * 24),
        );
      })
      .filter((length) => length > 0 && length < 60);

    if (cycleLengths.length === 0) return null;

    const avgLength = Math.round(
      cycleLengths.reduce((a, b) => a + b, 0) /
        cycleLengths.length,
    );

    const lastCycle = new Date(sortedCycles[0].startDateIso);
    const predicted = new Date(lastCycle);
    predicted.setDate(predicted.getDate() + avgLength);

    return { date: localDateIso(predicted), avgLength };
  };

  const prediction = predictNextPeriod();

  return (
    <div className="space-y-4">
      {prediction && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle>Next Period Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Date(prediction.date).toLocaleDateString(
                "en-US",
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                },
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Based on average cycle length of{" "}
              {prediction.avgLength} days
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cycle History</CardTitle>
              <CardDescription>
                Track your menstrual cycles
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddCycle(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Cycle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {cycles === undefined ? (
            <div className="space-y-2.5 py-1">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-4/5 rounded-xl" />
            </div>
          ) : sortedCycles.length === 0 ? (
            <Empty className="border-none bg-transparent py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle className="text-base">No cycles logged yet</EmptyTitle>
                <EmptyDescription>
                  Log your first cycle to start tracking and get predictions.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            sortedCycles.map((cycle) => (
              <div
                key={cycle._id}
                className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 transition-premium hover:bg-muted/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {new Date(cycle.startDateIso).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  {cycle.lengthDays && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {cycle.lengthDays} days
                    </div>
                  )}
                  {cycle.notes && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {cycle.notes}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteCycle(cycle._id)}
                  className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showAddCycle}
        onOpenChange={setShowAddCycle}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cycle</DialogTitle>
            <DialogDescription>
              Log a new menstrual cycle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lengthDays">Cycle Length (days, optional)</Label>
              <Input
                id="lengthDays"
                type="number"
                placeholder="28"
                value={form.lengthDays}
                onChange={(e) =>
                  setForm({ ...form, lengthDays: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about symptoms, mood, etc."
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <Button
              onClick={handleSaveCycle}
              className="w-full"
            >
              Save Cycle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
