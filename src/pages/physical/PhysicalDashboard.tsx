import { useState, useMemo } from "react";
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

/* ======================================================
   LOCAL SAFE PROFILE SNAPSHOT (TEMP)
   ====================================================== */

function useLocalPhysicalProfile() {
  return {
    heightCm: null as number | null,
    weightKg: null as number | null,
  };
}

/* ======================================================
   DATE HELPERS
   ====================================================== */

function getLast7Days() {
  const days: { dateIso: string; label: string }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      dateIso: d.toISOString().split("T")[0],
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
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
        totalDuration,
      };
    });
  }, [allExercises, days]);
}

/* ======================================================
   TODAY ACTIVITY SUMMARY
   ====================================================== */

function TodayActivitySummary() {
  const today = new Date().toISOString().split("T")[0];
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

  const CHART_HEIGHT = 112; // px
  const maxDuration = Math.max(1, ...data.map((d) => d.totalDuration));

  return (
    <Card>
      <div className="p-6">
        <h3 className="mb-4 text-sm font-medium">Weekly Activity</h3>

        <div className="flex items-end gap-3 h-28">
          {data.map((day, idx) => {
            const heightPx =
              (day.totalDuration / maxDuration) * CHART_HEIGHT;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full h-28 flex items-end">
                  <div
                    className="w-full rounded bg-primary/60 transition-all"
                    style={{
                      height: `${Math.max(2, heightPx)}px`,
                    }}
                    title={`${day.totalDuration} min`}
                  />
                </div>

                <div className="text-[10px] text-muted-foreground">
                  {day.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Minutes exercised per day (last 7 days)
        </div>
      </div>
    </Card>
  );
}

/* ======================================================
   PHYSICAL SUMMARY
   ====================================================== */

function PhysicalSummaryCard() {
  const { heightCm, weightKg } = useLocalPhysicalProfile();

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
  const [tab, setTab] = useState<"overview" | "nutrition" | "activity">(
    "overview",
  );

  return (
    <PageLayout
      title="Physical Health"
      subtitle="Today’s activity, nutrition, and progress."
      tabs={[
        { label: "Overview", value: "overview" },
        { label: "Nutrition", value: "nutrition" },
        { label: "Activity", value: "activity" },
      ]}
      activeTab={tab}
      onTabChange={(v) =>
        setTab(v as "overview" | "nutrition" | "activity")
      }
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
        <div className="space-y-6">
          <Card>
            <Progress />
          </Card>
          <Card>
            <FoodLog />
          </Card>
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
