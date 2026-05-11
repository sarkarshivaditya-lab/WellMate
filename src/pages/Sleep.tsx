import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusIcon, MoonIcon } from "lucide-react";
import { toast } from "sonner";
import PageLayout from "@/components/layout/PageLayout";
import {
  addSleepLog,
  listRecentSleep,
} from "@/data/local/sleepStore";

const ratingEmojis = ["😫", "😴", "😐", "😊", "😄"];

export default function Sleep() {
  const [showDialog, setShowDialog] = useState(false);
  const [startTime, setStartTime] = useState("22:00");
  const [endTime, setEndTime] = useState("07:00");
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");

  const sleep = useMemo(() => listRecentSleep(7), []);

  const handleAddSleep = () => {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      .toLocaleDateString("en-CA");

    // Build offset string so timestamps represent local wall-clock time
    const offsetMin = now.getTimezoneOffset();
    const sign = offsetMin <= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const tzSuffix = `${sign}${String(Math.floor(absMin / 60)).padStart(2, "0")}:${String(absMin % 60).padStart(2, "0")}`;

    addSleepLog({
      startIso: `${yesterday}T${startTime}:00${tzSuffix}`,
      endIso: `${today}T${endTime}:00${tzSuffix}`,
      rating,
      notes: notes || undefined,
    });

    toast.success("Sleep logged (saved locally)");
    setShowDialog(false);
    setNotes("");
  };

  const calculateAverage = () => {
    if (sleep.length === 0) return 0;
    const total = sleep.reduce((sum, s) => sum + s.durationMin, 0);
    return Math.round(total / sleep.length);
  };

  const avg = calculateAverage();
  const avgHours = Math.floor(avg / 60);
  const avgMins = avg % 60;

  return (
    <PageLayout>
      <div className="w-full space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sleep Tracking</h1>
            <p className="text-muted-foreground">Monitor your rest quality</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="h-4 w-4 mr-2" />
                Log Sleep
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Sleep</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Bedtime</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Wake Time</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Sleep Quality</Label>
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRating(r)}
                        className={`text-3xl transition-all ${
                          rating === r ? "scale-125" : "opacity-50"
                        }`}
                      >
                        {ratingEmojis[r - 1]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button onClick={handleAddSleep} className="w-full">
                  Log Sleep
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>7-Day Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgHours}h {avgMins}m
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Based on {sleep.length} night{sleep.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sleep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sleep.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MoonIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sleep logs yet</p>
              </div>
            ) : (
              sleep.map((s) => {
                const hours = Math.floor(s.durationMin / 60);
                const mins = s.durationMin % 60;
                const date = new Date(s.startIso).toLocaleDateString();

                return (
                  <div
                    key={s.localId}
                    className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{date}</div>
                      <div className="text-sm text-muted-foreground">
                        {hours}h {mins}m
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {ratingEmojis[s.rating - 1]}
                      </span>
                      <Badge variant="secondary">{s.rating}/5</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
