import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, MoonIcon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { toast } from "sonner";
import PageLayout from "@/components/layout/PageLayout";
import { addSleepLog } from "@/data/local/sleepStore";
import { useRecentSleepLogs } from "@/hooks/useSleepLogs";
import { useFeatureTracker, emitAnalyticsEvent } from "@/analytics";
import { haptics } from "@/motion";

const ratingEmojis = ["😫", "😴", "😐", "😊", "😄"];

export function SleepTabContent() {
  useFeatureTracker("sleep");
  const [showDialog, setShowDialog] = useState(false);
  const [startTime, setStartTime] = useState("22:00");
  const [endTime, setEndTime] = useState("07:00");
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");

  // Reactive — updates immediately when a log is added
  const sleep = useRecentSleepLogs(7);

  const handleAddSleep = () => {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA");
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      .toLocaleDateString("en-CA");

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

    haptics.complete();
    toast.success("Sleep logged");
    emitAnalyticsEvent({ type: "wellness_logged", entity: "sleep", ts: Date.now() });
    setShowDialog(false);
    setNotes("");
  };

  const avg = sleep.length === 0
    ? 0
    : Math.round(sleep.reduce((sum, s) => sum + s.durationMin, 0) / sleep.length);
  const avgHours = Math.floor(avg / 60);
  const avgMins = avg % 60;

  return (
    <>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Sleep</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bedtime</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Wake Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Sleep Quality</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRating(r)}
                    className={cn(
                      "flex-1 text-3xl rounded-xl py-2 transition-premium",
                      rating === r
                        ? "scale-105 bg-primary/10 ring-1 ring-primary/30"
                        : "opacity-50 hover:opacity-75",
                    )}
                  >
                    {ratingEmojis[r - 1]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
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

      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <PlusIcon className="h-4 w-4" />
            Log Sleep
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>7-Day Average</CardTitle>
          </CardHeader>
          <CardContent>
            {sleep.length === 0 ? (
              <div className="text-muted-foreground">
                <div className="text-3xl font-bold text-foreground/20 tabular-nums">—</div>
                <p className="mt-1 text-sm text-muted-foreground/70">Log a few nights to see your average.</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold tabular-nums">
                  {avgHours}h {avgMins}m
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on {sleep.length} night{sleep.length !== 1 ? "s" : ""}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sleep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sleep.length === 0 ? (
              <Empty className="border-none bg-transparent py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MoonIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">No sleep logged yet</EmptyTitle>
                  <EmptyDescription>
                    Log your first night to start tracking your rest patterns.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              sleep.map((s) => {
                const hours = Math.floor(s.durationMin / 60);
                const mins = s.durationMin % 60;
                const date = new Date(s.startIso).toLocaleDateString();

                return (
                  <div
                    key={s.localId}
                    className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 transition-premium hover:bg-muted/70"
                  >
                    <div>
                      <div className="text-sm font-medium">{date}</div>
                      <div className="text-xs text-muted-foreground">
                        {hours}h {mins}m
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {ratingEmojis[s.rating - 1]}
                      </span>
                      <Badge variant="secondary" className="text-xs">{s.rating}/5</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function Sleep() {
  return (
    <PageLayout
      title="Sleep"
      subtitle="Monitor your rest quality"
    >
      <SleepTabContent />
    </PageLayout>
  );
}
