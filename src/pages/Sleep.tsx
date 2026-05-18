import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SleepScoreCard } from "@/components/intelligence/SleepScoreCard";
import { computeSleepScore, computeSleepDebt, computeSleepRecoveryReadiness } from "@/intelligence/sleepIntelligence";
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
import { PlusIcon, MoonIcon, Watch, ChevronDown } from "lucide-react";
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

// ── Wearable integration notice ───────────────────────────────────────────────

const WEARABLE_SIGNALS = [
  "REM, light, and deep sleep stage breakdown",
  "Overnight HRV and resting heart rate",
  "Recovery readiness from continuous biometric signals",
  "Automatic sleep imports — no manual entry required",
  "Movement and restlessness patterns during sleep",
  "Long-term sleep architecture grounded in device data",
];

const WEARABLE_PLATFORMS = [
  "Apple Health",
  "Google Health Connect",
  "Fitbit",
  "Garmin",
  "Samsung Health",
  "Oura",
  "WHOOP",
  "& others",
];

function WearableIntegrationNotice() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-border/20 bg-muted/15 px-4 py-3.5">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 rounded-lg bg-primary/8 p-1.5">
          <Watch className="h-3.5 w-3.5 text-primary/50" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground/75 leading-snug">
            Deeper sleep insights are in preparation
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
            Current analysis uses manually logged data. Wearable integrations will unlock sleep-stage
            precision and automatic imports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse details" : "Expand details"}
          className="mt-0.5 flex-shrink-0 rounded-md p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors touch-manipulation"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border/15 pt-4">

          {/* What will improve */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              What becomes more precise
            </p>
            <ul className="space-y-1.5">
              {WEARABLE_SIGNALS.map((signal) => (
                <li
                  key={signal}
                  className="flex items-start gap-2 text-[12px] text-muted-foreground/80 leading-snug"
                >
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary/30" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>

          {/* Planned integrations */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Planned integrations at launch
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEARABLE_PLATFORMS.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border/25 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground/60"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Why not yet */}
          <div className="rounded-xl bg-muted/20 border border-border/10 px-3 py-3 space-y-1.5">
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Wearable integrations require production licensing agreements and finalized platform
              partnerships with each ecosystem. WellMate is building the synchronization and
              intelligence infrastructure now — privacy-first, with data remaining local and
              on-device where the platform allows.
            </p>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Current sleep insights are intentionally conservative. Once device integrations are
              live, sleep-stage data, HRV trends, and overnight recovery signals will feed directly
              into the longitudinal wellness intelligence layer — including future AI-powered
              recovery insights.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SleepTabContent() {
  useFeatureTracker("sleep");
  const [showDialog, setShowDialog] = useState(false);
  const [startTime, setStartTime] = useState("22:00");
  const [endTime, setEndTime] = useState("07:00");
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");

  // Reactive — updates immediately when a log is added
  const sleep = useRecentSleepLogs(7);

  const sleepScore = computeSleepScore();
  const sleepDebt = computeSleepDebt();
  const recoveryReadiness = computeSleepRecoveryReadiness();

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
        <WearableIntegrationNotice />

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <PlusIcon className="h-4 w-4" />
            Log Sleep
          </Button>
        </div>

        <SleepScoreCard
          sleepScore={sleepScore}
          sleepDebt={sleepDebt}
          recoveryReadiness={recoveryReadiness}
        />

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
