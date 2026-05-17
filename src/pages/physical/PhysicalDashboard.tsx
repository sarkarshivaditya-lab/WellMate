import { useState, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import Progress from "./Progress";
import ExerciseLog from "./ExerciseLog";
import FoodLog from "./FoodLog";
import PeriodTracker from "./PeriodTracker";
import PhysicalInsightsCard from "./PhysicalInsightsCard";
import PhysicalGoalAdvisor from "./PhysicalGoalAdvisor";
import PhysicalConfidenceCard from "./PhysicalConfidenceCard";
import { SleepTabContent } from "../Sleep";

import { useExercisesByDate } from "@/hooks/useExercisesByDate";
import { useAllExercises } from "@/hooks/useAllExercises";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import { useFeatureTracker } from "@/analytics";

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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Today’s Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground/70">
            No activity yet today — use the Activity tab to log.
          </p>
        </CardContent>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Today’s Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Exercises</div>
            <div className="text-lg font-semibold tabular-nums">{exercises.length}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="text-lg font-semibold tabular-nums">{totalDuration} min</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Calories</div>
            <div className="text-lg font-semibold tabular-nums">{totalCalories} cal</div>
          </div>
        </div>
      </CardContent>
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
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
      </CardHeader>
      <CardContent>
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
                    className="w-full rounded bg-primary/60 transition-premium group-hover:bg-primary"
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

        <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3">
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
      </CardContent>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Height</div>
            <div className="text-sm font-medium tabular-nums">{heightCm ? `${heightCm} cm` : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Weight</div>
            <div className="text-sm font-medium tabular-nums">{weightKg ? `${weightKg} kg` : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">BMI</div>
            <div className="text-sm font-medium tabular-nums">{bmiDisplay}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ======================================================
   DASHBOARD
   ====================================================== */

export default function PhysicalDashboard() {
  useFeatureTracker("physical");
  const [tab, setTab] = useState<"overview" | "nutrition" | "activity" | "sleep">(() => {
    const saved = sessionStorage.getItem("physical_tab");
    if (saved === "nutrition" || saved === "activity" || saved === "sleep") return saved;
    return "overview";
  });

  return (
    <PageLayout
      title="Physical Health"
      subtitle="Activity, nutrition, sleep, and progress."
      tabs={[
        { label: "Overview", value: "overview" },
        { label: "Nutrition", value: "nutrition" },
        { label: "Activity", value: "activity" },
        { label: "Sleep", value: "sleep" },
      ]}
      activeTab={tab}
      onTabChange={(v) => {
        const next = v as "overview" | "nutrition" | "activity" | "sleep";
        sessionStorage.setItem("physical_tab", next);
        setTab(next);
      }}
    >
      {tab === "overview" && (
        <div key="overview" className="space-y-6 animate-wm-tab-in">
          <PhysicalConfidenceCard />
          <TodayActivitySummary />
          <WeeklyActivityTrend />
          <PhysicalInsightsCard />
          <PhysicalGoalAdvisor />
          <PhysicalSummaryCard />
        </div>
      )}

      {tab === "nutrition" && (
        <div key="nutrition" className="space-y-6 animate-wm-tab-in">
          <Progress />
          <FoodLog />
        </div>
      )}

      {tab === "activity" && (
        <div key="activity" className="space-y-6 animate-wm-tab-in">
          <ExerciseLog />
          <PeriodTracker />
        </div>
      )}

      {tab === "sleep" && (
        <div key="sleep" className="space-y-6 animate-wm-tab-in">
          <SleepTabContent />
        </div>
      )}
    </PageLayout>
  );
}
