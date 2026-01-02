import { useState } from "react";
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

/* ======================================================
   LOCAL SAFE PROFILE SNAPSHOT (TEMP)
   ====================================================== */

function useLocalPhysicalProfile() {
  // Temporary local snapshot — Convex will rehydrate later
  return {
    heightCm: null as number | null,
    weightKg: null as number | null,
  };
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
          <h3 className="mb-2 text-sm font-medium">
            Today’s Activity
          </h3>
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
        <h3 className="mb-3 text-sm font-medium">
          Today’s Activity
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">
              Exercises
            </div>
            <div className="text-lg font-semibold">
              {exercises.length}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">
              Duration
            </div>
            <div className="text-lg font-semibold">
              {totalDuration} min
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">
              Calories
            </div>
            <div className="text-lg font-semibold">
              {totalCalories} cal
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ======================================================
   PHYSICAL SUMMARY (PROFILE)
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
            <div className="text-xs text-muted-foreground">
              Height (cm)
            </div>
            <div className="text-sm font-medium">
              {heightCm ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Weight (kg)
            </div>
            <div className="text-sm font-medium">
              {weightKg ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              BMI
            </div>
            <div className="text-sm font-medium">
              {bmiDisplay}
            </div>
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
  const [tab, setTab] = useState<
    "overview" | "nutrition" | "activity"
  >("overview");

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
