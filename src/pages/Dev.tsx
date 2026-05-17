import { useState, useEffect, useSyncExternalStore } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import { toast } from "sonner";
import practicesData from "@/data/practices.json";
import PageLayout from "@/components/layout/PageLayout";
import {
  getQueueSummary,
  getDeadLetterQueue,
  restoreFromDeadLetter,
  discardDeadLetter,
  subscribeToOperationQueue,
  getOperationQueue,
} from "@/reliability/operationQueue";
import { subscribeToConnectivity, getConnectivity } from "@/reliability/connectivity";
import {
  getDiagnosticsSnapshot,
  subscribeToDiagnostics,
  resetDiagnostics,
  type DiagnosticsSnapshot,
} from "@/reliability/diagnostics";
import {
  getHydrationState,
  subscribeToHydration,
} from "@/reliability/hydration";
import { getConflictLog } from "@/reliability/conflictResolver";
import {
  getDeadletterQueue as getLegacyDeadLetter,
  restoreDeadletterTask,
  discardDeadletterTask,
} from "@/sync/syncQueue";
import {
  runReliabilityStressTests,
  type StressTestReport,
} from "@/reliability/__tests__/stressTest";
import {
  getAnalyticsSnapshot,
  getDailySummaries,
  getOnboardingState,
  subscribeToAnalytics,
} from "@/analytics";
import type { AnalyticsSnapshot } from "@/analytics";

/* --------------------------------------------------
   ANALYTICS PANEL — component
   -------------------------------------------------- */

function useAnalyticsSnapshot(): AnalyticsSnapshot {
  const [snap, setSnap] = useState<AnalyticsSnapshot>(() => getAnalyticsSnapshot());
  useEffect(() => {
    const unsub = subscribeToAnalytics(() => setSnap(getAnalyticsSnapshot()));
    return unsub;
  }, []);
  return snap;
}

function AnalyticsPanel() {
  const snap = useAnalyticsSnapshot();
  const onboarding = getOnboardingState();
  const { today, aggregates, retention, sessionDepth, sessionDurationMs } = snap;

  const durationSec = Math.round(sessionDurationMs / 1000);
  const durationLabel =
    durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Analytics</CardTitle>
        <CardDescription>Local-only · privacy-first · aggregated summaries</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-xs font-mono">

        {/* Session */}
        <div>
          <div className="font-semibold text-sm mb-1 text-foreground">Current Session</div>
          <div className="flex flex-wrap gap-4">
            <div>Depth: <span className="text-blue-400">{sessionDepth}</span> actions</div>
            <div>Duration: <span className="text-blue-400">{durationLabel}</span></div>
            <div>Total sessions: {aggregates.totalSessions}</div>
            <div>Total actions: {aggregates.totalActions}</div>
          </div>
        </div>

        {/* Streak + retention */}
        <div>
          <div className="font-semibold text-sm mb-1 text-foreground">Retention</div>
          <div className="flex flex-wrap gap-4">
            <div>Streak: <span className={aggregates.currentStreak >= 3 ? "text-green-400" : "text-yellow-400"}>{aggregates.currentStreak}d</span></div>
            <div>Best: {aggregates.longestStreak}d</div>
            <div>Active this wk: <span className="text-green-400">{retention.activeDaysThisWeek}/7</span></div>
            <div>Active last wk: {retention.activeDaysLastWeek}/7</div>
            <div>Active/30d: {retention.activeDaysLast30}</div>
            <div>Avg actions/day: {retention.avgActionsPerActiveDay}</div>
          </div>
        </div>

        {/* Today's summary */}
        {today && (
          <div>
            <div className="font-semibold text-sm mb-1 text-foreground">Today ({today.date})</div>
            <div className="flex flex-wrap gap-3">
              {today.mealsLogged > 0 && <span>Meals: <span className="text-green-400">{today.mealsLogged}</span></span>}
              {today.sleepLogged > 0 && <span>Sleep: <span className="text-green-400">{today.sleepLogged}</span></span>}
              {today.exerciseLogged > 0 && <span>Exercise: <span className="text-green-400">{today.exerciseLogged}</span></span>}
              {today.habitsCompleted > 0 && <span>Habits: <span className="text-green-400">{today.habitsCompleted}</span></span>}
              {today.moodLogged > 0 && <span>Mood: <span className="text-green-400">{today.moodLogged}</span></span>}
              {today.journalEntries > 0 && <span>Journal: <span className="text-green-400">{today.journalEntries}</span></span>}
              {today.cycleLogged > 0 && <span>Cycle: <span className="text-green-400">{today.cycleLogged}</span></span>}
              {today.sessionCount > 0 && <span>Sessions: {today.sessionCount}</span>}
              {today.featuresOpened.length > 0 && (
                <span>Features: {today.featuresOpened.join(", ")}</span>
              )}
            </div>
          </div>
        )}

        {/* Entity consistency (30d) */}
        {Object.keys(retention.entityConsistency).length > 0 && (
          <div>
            <div className="font-semibold text-sm mb-1 text-foreground">30-day Consistency</div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(retention.entityConsistency).map(([entity, days]) => (
                <span key={entity}>
                  {entity}: <span className={days >= 20 ? "text-green-400" : days >= 10 ? "text-yellow-400" : "text-muted-foreground"}>{days}d</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feature engagement */}
        {Object.keys(aggregates.featureCounts).length > 0 && (
          <div>
            <div className="font-semibold text-sm mb-1 text-foreground">Feature Opens (lifetime)</div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(aggregates.featureCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([feature, count]) => (
                  <span key={feature}>
                    {feature}: <span className="text-blue-400">{count}</span>
                  </span>
                ))}
            </div>
            {retention.topFeature && (
              <div className="mt-1 text-muted-foreground">Top: {retention.topFeature}</div>
            )}
          </div>
        )}

        {/* Onboarding */}
        <div>
          <div className="font-semibold text-sm mb-1 text-foreground">Onboarding</div>
          <div className="flex flex-wrap gap-4">
            <div>Phase: <span className={onboarding.phase === "completed" ? "text-green-400" : "text-yellow-400"}>{onboarding.phase}</span></div>
            {onboarding.firstSeenDate && <div>First seen: {onboarding.firstSeenDate}</div>}
            {onboarding.completionDate && <div>Completed: {onboarding.completionDate}</div>}
          </div>
        </div>

        {/* Origin */}
        {aggregates.firstSeenDate && (
          <div className="text-muted-foreground">
            Analytics since: {aggregates.firstSeenDate} · {getDailySummaries().length} daily records
          </div>
        )}

        {/* Copy snapshot */}
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const data = { ...snap, onboarding, dailySummaries: getDailySummaries() };
              navigator.clipboard?.writeText(JSON.stringify(data, null, 2)).then(() =>
                toast.success("Analytics snapshot copied to clipboard"),
              );
            }}
          >
            Copy Analytics Snapshot
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------
   RELIABILITY PANEL — hooks
   -------------------------------------------------- */

function useQueueSummary() {
  return useSyncExternalStore(subscribeToOperationQueue, getQueueSummary, getQueueSummary);
}

function useDiagnostics(): DiagnosticsSnapshot {
  return useSyncExternalStore(subscribeToDiagnostics, getDiagnosticsSnapshot, getDiagnosticsSnapshot);
}

function useHydrationStatus() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => getHydrationState().status,
    () => getHydrationState().status,
  );
}

/* --------------------------------------------------
   RELIABILITY PANEL — component
   -------------------------------------------------- */

function ReliabilityPanel() {
  const summary = useQueueSummary();
  const diag = useDiagnostics();
  const hydrationStatus = useHydrationStatus();
  const [connectivity, setConnectivity] = useState(() => getConnectivity());
  const [showEvents, setShowEvents] = useState(false);
  const [stressReport, setStressReport] = useState<StressTestReport | null>(null);
  const [stressRunning, setStressRunning] = useState(false);
  const deadLetter = getDeadLetterQueue();
  const legacyDeadLetter = getLegacyDeadLetter();
  const conflicts = getConflictLog();

  useEffect(() => {
    const unsub = subscribeToConnectivity((s) => setConnectivity(s));
    return unsub;
  }, []);

  const hydrationColor =
    hydrationStatus === "ready" ? "text-green-400"
    : hydrationStatus === "degraded" ? "text-yellow-400"
    : hydrationStatus === "failed" || hydrationStatus === "corrupted" ? "text-red-400"
    : "text-muted-foreground";

  const connectivityColor =
    connectivity === "online" ? "text-green-400" : "text-red-400";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reliability Diagnostics</CardTitle>
        <CardDescription>Engineering-only — sync, hydration, queue, and conflict state</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-xs font-mono">

        {/* Status row */}
        <div className="flex flex-wrap gap-4">
          <div>
            Hydration: <span className={hydrationColor}>{hydrationStatus}</span>
          </div>
          <div>
            Network: <span className={connectivityColor}>{connectivity}</span>
          </div>
          <div>Sync OK: <span className="text-green-400">{diag.syncSuccess}</span></div>
          <div>Sync Err: <span className="text-red-400">{diag.syncError}</span></div>
          <div>Retries: {diag.syncRetry}</div>
          <div>Auth aborts: {diag.authAbort}</div>
        </div>

        {/* Operation queue */}
        <div>
          <div className="font-semibold text-sm mb-1 text-foreground">Operation Queue</div>
          <div className="flex flex-wrap gap-3">
            <span>Pending: <span className="text-yellow-400">{summary.pending}</span></span>
            <span>Syncing: <span className="text-blue-400">{summary.syncing}</span></span>
            <span>Synced: <span className="text-green-400">{summary.synced}</span></span>
            <span>Failed: <span className="text-red-400">{summary.failed}</span></span>
            <span>Retry: {summary.retryScheduled}</span>
            <span>Conflict: <span className="text-orange-400">{summary.conflict}</span></span>
            <span>Dead-letter: <span className="text-red-500">{summary.deadLetter}</span></span>
            <span>Cancelled: {summary.cancelled}</span>
          </div>
        </div>

        {/* Conflict + duplicate prevention */}
        <div className="flex flex-wrap gap-4">
          <div>Conflicts detected: {diag.conflictDetected}</div>
          <div>Conflicts resolved: {diag.conflictResolved}</div>
          <div>Duplicates prevented: {diag.duplicatePrevented}</div>
          <div>Cross-tab syncs: {diag.crossTabSync}</div>
        </div>

        {/* Storage health */}
        <div className="flex flex-wrap gap-4">
          <div>Storage failures: <span className={diag.storageFailure > 0 ? "text-red-400" : ""}>{diag.storageFailure}</span></div>
          <div>Corruption recovery: {diag.corruptionRecovery}</div>
          <div>Quarantined: {diag.persistenceQuarantine}</div>
          <div>Memory pressure: {diag.memoryPressure}</div>
        </div>

        {/* Timing */}
        <div className="flex flex-wrap gap-4">
          <div>Avg hydration: {diag.avgHydrationMs !== null ? `${diag.avgHydrationMs}ms` : "—"}</div>
          <div>Last sync: {diag.lastSyncDurationMs !== null ? `${diag.lastSyncDurationMs}ms` : "—"}</div>
        </div>

        {/* Dead-letter queue */}
        {deadLetter.length > 0 && (
          <div>
            <div className="font-semibold text-sm mb-1 text-red-400">Dead-Letter Queue ({deadLetter.length})</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {[...deadLetter].map((op) => (
                <div key={op.operationId} className="flex items-center gap-2 p-2 bg-secondary/40 rounded text-xs">
                  <span className="flex-1 truncate">{op.entityType}/{op.entityId.slice(0, 8)} — {op.operationType}</span>
                  <span className="text-muted-foreground truncate max-w-32">{op.errorReason}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-xs px-2"
                    onClick={() => { restoreFromDeadLetter(op.operationId); toast.info("Op restored to queue"); }}
                  >Restore</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-5 text-xs px-2"
                    onClick={() => { discardDeadLetter(op.operationId); toast.info("Op discarded"); }}
                  >Discard</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy dead-letter queue (meals/exercises from syncQueue.ts) */}
        {legacyDeadLetter.length > 0 && (
          <div>
            <div className="font-semibold text-sm mb-1 text-red-400">Legacy Dead-Letter ({legacyDeadLetter.length})</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...legacyDeadLetter].map((task) => (
                <div key={task.id} className="flex items-center gap-2 p-2 bg-secondary/40 rounded text-xs">
                  <span className="flex-1 truncate">{task.entity}/{task.localId.slice(0, 8)} — {task.action}</span>
                  <span className="text-muted-foreground">attempts: {task.attempts}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-xs px-2"
                    onClick={() => { restoreDeadletterTask(task.id); toast.info("Legacy task restored"); }}
                  >Restore</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-5 text-xs px-2"
                    onClick={() => { discardDeadletterTask(task.id); toast.info("Legacy task discarded"); }}
                  >Discard</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent conflict log */}
        {conflicts.length > 0 && (
          <div>
            <div className="font-semibold text-sm mb-1 text-orange-400">Recent Conflicts ({conflicts.length})</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...conflicts].reverse().slice(0, 5).map((c) => (
                <div key={c.id} className="p-2 bg-secondary/40 rounded text-xs">
                  <span>{c.entityType}/{c.entityId.slice(0, 8)} — {c.conflictType} → {c.resolution}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent events toggle */}
        <div>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowEvents((v) => !v)}
          >
            {showEvents ? "Hide" : "Show"} recent events ({diag.recentEvents.length})
          </button>
          {showEvents && (
            <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
              {[...diag.recentEvents].reverse().slice(0, 30).map((e, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0">{new Date(e.ts).toISOString().slice(11, 23)}</span>
                  <span className="text-foreground">{e.type}</span>
                  {e.data && <span className="truncate">{JSON.stringify(e.data)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stress Test Runner */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              disabled={stressRunning}
              onClick={async () => {
                setStressRunning(true);
                setStressReport(null);
                try {
                  const report = await runReliabilityStressTests();
                  setStressReport(report);
                  if (report.failed === 0) {
                    toast.success(`All ${report.total} reliability tests passed in ${report.durationMs}ms`);
                  } else {
                    toast.error(`${report.failed}/${report.total} reliability tests FAILED`);
                  }
                } finally {
                  setStressRunning(false);
                }
              }}
            >
              {stressRunning ? "Running…" : "Run Stress Tests"}
            </Button>
            {stressReport && (
              <span className={`text-xs font-mono ${stressReport.failed === 0 ? "text-green-400" : "text-red-400"}`}>
                {stressReport.passed}/{stressReport.total} passed ({stressReport.durationMs}ms)
              </span>
            )}
          </div>
          {stressReport && stressReport.failed > 0 && (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {stressReport.results.filter(r => !r.passed).map((r, i) => (
                <div key={i} className="text-xs text-red-400 p-1 bg-secondary/30 rounded">
                  <span className="font-semibold">FAIL:</span> {r.name}
                  {r.error && <div className="text-muted-foreground mt-0.5 ml-2">{r.error}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { resetDiagnostics(); toast.info("Diagnostics reset"); }}
          >
            Reset Diagnostics
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const snapshot = {
                queue: getQueueSummary(),
                deadLetter: getDeadLetterQueue(),
                diagnostics: getDiagnosticsSnapshot(),
                hydration: getHydrationState(),
                ops: getOperationQueue(),
              };
              navigator.clipboard?.writeText(JSON.stringify(snapshot, null, 2)).then(() =>
                toast.success("Reliability snapshot copied to clipboard")
              );
            }}
          >
            Copy Snapshot
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

export default function Dev() {
  const user = useQuery(api.users.getCurrentUser);
  const meals = useQuery(api.meals.getRecentMeals, { days: 30 });
  const moods = useQuery(api.moods.listMoods, { limit: 30 });
  const journalEntries = useQuery(api.journal.listJournalEntries, {
    limit: 30,
  });
  const generateInsights = useAction(api.insights.generateWeeklyInsights);

  const [adapterMode, setAdapterMode] = useState<"mock" | "api">("mock");
  const [insights, setInsights] = useState<{
    moodAverage: number;
    stressIndicators: string[];
    notes: string;
  } | null>(null);

  const handleExportMeals = () => {
    if (!meals || meals.length === 0) {
      toast.error("No meals to export");
      return;
    }
    const csv = [
      "Date,Name,Input Mode,Calories,Protein(g),Fat(g),Carbs(g)",
      ...meals.map(
        (meal: {
          dateIso: string;
          name: string;
          inputMode: string;
          totalCalories: number;
          totalProteinG: number;
          totalFatG: number;
          totalCarbsG: number;
        }) =>
          [
            meal.dateIso,
            meal.name,
            meal.inputMode,
            meal.totalCalories,
            meal.totalProteinG,
            meal.totalFatG,
            meal.totalCarbsG,
          ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wellmate-meals-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Meals exported to CSV");
  };

  const handleToggleAdapter = () => {
    const newMode = adapterMode === "mock" ? "api" : "mock";
    setAdapterMode(newMode);
    toast.info(`Switched to ${newMode} adapter mode`);
  };

  const handleSeedPractices = () => {
    toast.success(
      `${practicesData.length} wellbeing practices are loaded from /src/data/practices.json`,
    );
  };

  const handleDebugInsights = async () => {
    try {
      const result = await generateInsights({});
      setInsights(result);
      toast.success("Insights generated successfully");
    } catch (error) {
      toast.error("Failed to generate insights");
    }
  };

  return (
    <PageLayout>
      <div className="w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Developer Tools</h1>
          <p className="text-muted-foreground">
            Debugging and testing utilities
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Info</CardTitle>
            <CardDescription>Current user details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>Name: {user?.name || "N/A"}</div>
            <div>Email: {user?.email || "N/A"}</div>
            <div>
              Onboarding Complete: {user?.hasCompletedOnboarding ? "Yes" : "No"}
            </div>
            {user?.weightKg && <div>Weight: {user.weightKg} kg</div>}
            {user?.heightCm && <div>Height: {user.heightCm} cm</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Food Adapter</CardTitle>
            <CardDescription>
              Switch between mock and API adapters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">
                Current Mode:{" "}
                <span className="text-primary">{adapterMode}</span>
              </div>
              <Button onClick={handleToggleAdapter}>Toggle Adapter Mode</Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Note: API adapter requires VITE_NUT_PROVIDER and VITE_NUT_API_KEY
              environment variables. Currently defaults to mock.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>
              Export your data for backup or analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={handleExportMeals}>Export Meals to CSV</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mental Wellbeing Tools</CardTitle>
            <CardDescription>Debug mental health features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button
                onClick={handleSeedPractices}
                variant="outline"
                className="w-full"
              >
                Verify Wellbeing Practices
              </Button>
              <Button onClick={handleDebugInsights} className="w-full">
                Generate Weekly Insights
              </Button>
            </div>

            {insights && (
              <div className="mt-4 p-4 bg-secondary rounded-lg space-y-2 text-sm">
                <div className="font-semibold">Insights Output:</div>
                <div>Mood Average: {insights.moodAverage}/5</div>
                <div>Stress Indicators:</div>
                <ul className="list-disc list-inside ml-2">
                  {insights.stressIndicators.map(
                    (indicator: string, i: number) => (
                      <li key={i}>{indicator}</li>
                    ),
                  )}
                </ul>
                <div className="pt-2 border-t">Notes: {insights.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Mental Coach Context</CardTitle>
            <CardDescription>View data sent to AI Mental Coach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div>
                <div className="font-semibold mb-1">Recent Moods:</div>
                {moods && moods.length > 0 ? (
                  <div className="p-3 bg-secondary/50 rounded font-mono text-xs">
                    {moods
                      .slice(0, 7)
                      .map((mood: (typeof moods)[number], i: number) => (
                        <div key={i}>
                          {new Date(mood.dateIso).toLocaleDateString()}:{" "}
                          {mood.moodValue}/5
                          {mood.note && ` - "${mood.note}"`}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No mood data yet</p>
                )}
              </div>

              <div>
                <div className="font-semibold mb-1">
                  Recent Journal Entries:
                </div>
                {journalEntries && journalEntries.length > 0 ? (
                  <div className="p-3 bg-secondary/50 rounded font-mono text-xs space-y-2">
                    {journalEntries
                      .slice(0, 3)
                      .map(
                        (entry: (typeof journalEntries)[number], i: number) => (
                          <div key={i}>
                            <div className="font-semibold">
                              {new Date(entry.dateIso).toLocaleDateString()}
                            </div>
                            <div className="text-muted-foreground line-clamp-2">
                              {entry.text}
                            </div>
                            {entry.tags.length > 0 && (
                              <div className="text-xs">
                                Tags: {entry.tags.join(", ")}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No journal entries yet
                  </p>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              This is the context data that gets sent to the AI Mental Coach to
              personalize responses.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Stats</CardTitle>
            <CardDescription>Current data counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Meals logged: {meals?.length || 0}</div>
            <div>Moods tracked: {moods?.length || 0}</div>
            <div>Journal entries: {journalEntries?.length || 0}</div>
            <div>Wellbeing practices: {practicesData.length}</div>
          </CardContent>
        </Card>

        <AnalyticsPanel />

        <ReliabilityPanel />

        <div className="text-xs text-muted-foreground">
          <p>WellMate Developer Tools v1.0</p>
          <p>For testing and debugging only. Do not expose in production.</p>
        </div>
      </div>
    </PageLayout>
  );
}
