import { useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import Progress from "./Progress";
import ExerciseLog from "./ExerciseLog";
import FoodLog from "./FoodLog";
import PeriodTracker from "./PeriodTracker";
import PhysicalInsightsCard from "./PhysicalInsightsCard";
import PhysicalGoalAdvisor from "./PhysicalGoalAdvisor";
import PhysicalConfidenceCard from "./PhysicalConfidenceCard";

function PhysicalSummaryCard() {
  const user = useQuery(api.users.getCurrentUser);

  const heightCm = typeof user?.heightCm === "number" ? user.heightCm : null;
  const weightKg = typeof user?.weightKg === "number" ? user.weightKg : null;

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
          <Card>
            <PhysicalConfidenceCard />
          </Card>

          <PhysicalInsightsCard />

          {/* ✅ BUTTON LIVES HERE */}
          <PhysicalGoalAdvisor />

          <PhysicalSummaryCard />
        </div>
      )}

      {tab === "nutrition" && (
        <div className="space-y-6">
          <Card><Progress /></Card>
          <Card><FoodLog /></Card>
        </div>
      )}

      {tab === "activity" && (
        <div className="space-y-6">
          <Card><ExerciseLog /></Card>
          <Card><PeriodTracker /></Card>
        </div>
      )}
    </PageLayout>
  );
}
