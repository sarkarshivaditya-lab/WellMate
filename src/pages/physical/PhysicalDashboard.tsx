import { useState, useMemo, useSyncExternalStore } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/card";

import Progress from "./Progress";
import ExerciseLog from "./ExerciseLog";
import FoodLog from "./FoodLog";
import PeriodTracker from "./PeriodTracker";
import PhysicalInsightsCard from "./PhysicalInsightsCard";
import PhysicalGoalAdvisor from "./PhysicalGoalAdvisor";
import PhysicalConfidenceCard from "./PhysicalConfidenceCard";

import { useExercisesByDate } from "@/hooks/useExercisesByDate";
import { useAllExercises } from "@/hooks/useAllExercises";
import { useLocalProfile } from "@/hooks/useLocalProfile";

import {
  getSyncStatus,
  subscribeToSyncStatus,
} from "@/sync/syncStatus";
import { localDateIso } from "@/services/dateUtils";


/* ======================================================
   DATE HELPERS
   ====================================================== */

function getLast7Days() {
  const days: { dateIso: string; label: string; fullLabel: string }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      dateIso: localDateIso(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      fullLabel: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    });
  }

  return days;
}

/* ======================================================
   WEEKLY ACTIVITY (DERIVED, REACTIVE)
   ====================================================== */

function useWeeklyActivity() {
  const allExercises = useAllExercises();
  const days = getLast7Days();

  return useMemo(() => {
    return days.map((day) => {
      const totalDuration = allExercises
        .filter((e) => e.dateIso === day.dateIso)
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      return {
        label: day.label,
        fullLabel: day.fullLabel,
        totalDuration,
      };
    });
  }, [allExercises, days]);
}

/* ======================================================
   TODAY ACTIVITY SUMMARY
   ====================================================== */

function TodayActivitySummary() {
  const today = localDateIso();
  const { exercises } = useExercisesByDate(today);

  if (!exercises || exercises.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="mb-2 text-sm font-medium">Today’s Activity</h3>
          <div className="text-sm text-muted-foreground">
            No activity logged yet today.
          </div>
        </div>
      </Card>
    );
  }

  const totalDuration = exercises.reduce(
    (sum, e) => sum + e.durationMinutes,
    0,
  );

  const totalCalories = exercises.reduce(
    (sum, e) => sum + e.caloriesBurnedEst,
    0,
  );

  return (
    <Card>
      <div className="p-6">
        <h3 className="mb-3 text-sm font-medium">Today’s Activity</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Exercises</div>
            <div className="text-lg font-semibold">{exercises.length}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="text-lg font-semibold">{totalDuration} min</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Calories</div>
            <div className="text-lg font-semibold">{totalCalories} cal</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ======================================================
   WEEKLY ACTIVITY TREND
   ====================================================== */

function WeeklyActivityTrend() {
  const data = useWeeklyActivity();

  const CHART_HEIGHT = 112;
  const DAILY_GOAL_MIN = 30;

  const goalHitDays = data.filter(
    (d) => d.totalDuration >= DAILY_GOAL_MIN,
  ).length;

  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].totalDuration >= DAILY_GOAL_MIN) {
      streak++;
    } else {
      break;
    }
  }

  const maxDuration = Math.max(
    DAILY_GOAL_MIN,
    ...data.map((d) => d.totalDuration),
  );

  const goalHeightPx = (DAILY_GOAL_MIN / maxDuration) * CHART_HEIGHT;

  return (
    <Card>
      <div className="p-6">
        <h3 className="mb-4 text-sm font-medium">Weekly Activity</h3>

        <div className="relative flex items-end gap-3 h-28">
          <div
            className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40"
            style={{ bottom: `${goalHeightPx}px` }}
          />

          {data.map((day, idx) => {
            const heightPx =
              (day.totalDuration / maxDuration) * CHART_HEIGHT;

            return (
              <div
                key={idx}
                className="group flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full h-28 flex items-end">
                  <div
                    className="w-full rounded bg-primary/60 transition-all group-hover:bg-primary"
                    style={{
                      height: `${Math.max(2, heightPx)}px`,
                    }}
                    title={`${day.fullLabel}: ${day.totalDuration} min`}
                  />
                </div>

                <div className="text-[10px] text-muted-foreground">
                  {day.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            {streak > 0 ? `${streak}-day streak` : "No active streak"}
          </span>
        </div>

        <div className="mt-4 rounded-lg bg-muted/40 px-4 py-3">
          <div className="text-xs text-muted-foreground">
            Weekly Summary
          </div>
          <div className="mt-1 text-sm">
            You reached your daily activity goal on{" "}
            <span className="font-medium">
              {goalHitDays} of the last 7 days
            </span>
            .
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ======================================================
   PHYSICAL SUMMARY
   ====================================================== */

function PhysicalSummaryCard() {
  const profile = useLocalProfile();

  const heightCm = profile?.heightCm ?? null;
  const weightKg = profile?.weightKg ?? null;

  let bmiDisplay = "—";
  if (heightCm && weightKg) {
    const hM = heightCm / 100;
    const bmi = weightKg / (hM * hM);
    if (Number.isFinite(bmi)) bmiDisplay = bmi.toFixed(1);
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="mb-3 text-sm font-medium">Profile</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Height (cm)</div>
            <div className="text-sm font-medium">{heightCm ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Weight (kg)</div>
            <div className="text-sm font-medium">{weightKg ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">BMI</div>
            <div className="text-sm font-medium">{bmiDisplay}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ======================================================
   DASHBOARD
   ====================================================== */

export default function PhysicalDashboard() {
  const [tab, setTab] = useState<"overview" | "nutrition" | "activity">(() => {
    const saved = sessionStorage.getItem("physical_tab");
    return saved === "nutrition" || saved === "activity" ? saved : "overview";
  });

  const syncStatus = useSyncExternalStore(
    subscribeToSyncStatus,
    getSyncStatus,
    getSyncStatus,
  );

  const syncMeta =
    syncStatus === "syncing"
      ? { label: "Syncing…", dot: "bg-blue-500 animate-pulse" }
      : syncStatus === "error"
        ? { label: "Sync error", dot: "bg-red-500" }
        : { label: "Up to date", dot: "bg-emerald-500" };

  return (
    <PageLayout
      title="Physical Health"
      subtitle="Today’s activity, nutrition, and progress."
      headerRight={
        <div
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground"
          title="Local changes sync automatically when you’re online."
        >
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${syncMeta.dot}`} />
          <span>{syncMeta.label}</span>
        </div>
      }
      tabs={[
        { label: "Overview", value: "overview" },
        { label: "Nutrition", value: "nutrition" },
        { label: "Activity", value: "activity" },
      ]}
      activeTab={tab}
      onTabChange={(v) => {
        const next = v as "overview" | "nutrition" | "activity";
        sessionStorage.setItem("physical_tab", next);
        setTab(next);
      }}
    >
      {tab === "overview" && (
        <div className="space-y-10">
          <PhysicalConfidenceCard />
          <TodayActivitySummary />
          <WeeklyActivityTrend />
          <PhysicalInsightsCard />
          <PhysicalGoalAdvisor />
          <PhysicalSummaryCard />
        </div>
      )}

      {tab === "nutrition" && (
        <div className="space-y-10">
          <div className="relative">
            <Card>
              <Progress />
            </Card>
          </div>

          <div className="relative">
            <Card>
              <FoodLog />
            </Card>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="space-y-6">
          <ExerciseLog />
          <PeriodTracker />
        </div>
      )}
    </PageLayout>
  );
}
