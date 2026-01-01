import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function PeriodTracker() {
  const user = useQuery(api.users.getCurrentUser);
  const cycles = useQuery(api.cycles.getCycles);
  const addCycle = useMutation(api.cycles.addCycle);
  const deleteCycle = useMutation(api.cycles.deleteCycle);
  
  const [showAddCycle, setShowAddCycle] = useState(false);
  const [form, setForm] = useState({
    startDate: "",
    lengthDays: "",
    notes: "",
  });
  
  if (user === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Period Tracking</CardTitle>
          <CardDescription>Loading</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Loading your profile
          </p>
        </CardContent>
      </Card>
    );
  }

  if (user === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Period Tracking</CardTitle>
          <CardDescription>Sign-in required</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sign in to enable and use period tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!user.periodTrackingEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Period Tracking</CardTitle>
          <CardDescription>Not enabled</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Period tracking is not enabled for your account. You can enable it in your profile settings.
          </p>
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
      toast.success("Cycle added successfully");
      setShowAddCycle(false);
      setForm({ startDate: "", lengthDays: "", notes: "" });
    } catch (error) {
      toast.error("Failed to add cycle");
    }
  };
  
  const handleDeleteCycle = async (cycleId: Id<"cycles">) => {
    try {
      await deleteCycle({ cycleId });
      toast.success("Cycle deleted");
    } catch (error) {
      toast.error("Failed to delete cycle");
    }
  };
  
  const sortedCycles = cycles ? [...cycles].sort((a, b) => 
    new Date(b.startDateIso).getTime() - new Date(a.startDateIso).getTime()
  ) : [];
  
  const predictNextPeriod = () => {
    if (!sortedCycles || sortedCycles.length < 2) return null;
    const cycleLengths = sortedCycles
      .slice(0, -1)
      .map((cycle, i) => {
        const nextCycle = sortedCycles[i + 1];
        const start = new Date(cycle.startDateIso);
        const nextStart = new Date(nextCycle.startDateIso);
        return Math.abs((start.getTime() - nextStart.getTime()) / (1000 * 60 * 60 * 24));
      })
      .filter((length) => length > 0 && length < 60);
    
    if (cycleLengths.length === 0) return null;
    
    const avgLength = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
    const lastCycle = new Date(sortedCycles[0].startDateIso);
    const predicted = new Date(lastCycle);
    predicted.setDate(predicted.getDate() + avgLength);
    
    return { date: predicted.toISOString().split("T")[0], avgLength };
  };
  
  const prediction = predictNextPeriod();
  
  return (
    <div className="space-y-4">
      {prediction && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Next Period Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Date(prediction.date).toLocaleDateString("en-US", { 
                month: "long", 
                day: "numeric", 
                year: "numeric" 
              })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Based on average cycle length of {prediction.avgLength} days
            </p>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cycle History</CardTitle>
              <CardDescription>Track your menstrual cycles</CardDescription>
            </div>
            <Button onClick={() => setShowAddCycle(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Cycle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {cycles === undefined ? (
            <div className="text-center py-8 text-muted-foreground">Loading</div>
          ) : sortedCycles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cycles logged yet
            </div>
          ) : (
            sortedCycles.map((cycle) => (
              <Card key={cycle._id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {new Date(cycle.startDateIso).toLocaleDateString("en-US", { 
                          month: "long", 
                          day: "numeric", 
                          year: "numeric" 
                        })}
                      </div>
                      {cycle.lengthDays && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {cycle.lengthDays} days
                        </div>
                      )}
                      {cycle.notes && (
                        <div className="text-sm text-muted-foreground mt-2">{cycle.notes}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCycle(cycle._id)}
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
      
      <Dialog open={showAddCycle} onOpenChange={setShowAddCycle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cycle</DialogTitle>
            <DialogDescription>Log a new menstrual cycle</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="lengthDays">Cycle Length (days, optional)</Label>
              <Input
                id="lengthDays"
                type="number"
                placeholder="28"
                value={form.lengthDays}
                onChange={(e) => setForm({ ...form, lengthDays: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about symptoms, mood, etc..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
            
            <Button onClick={handleSaveCycle} className="w-full">
              Save Cycle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
