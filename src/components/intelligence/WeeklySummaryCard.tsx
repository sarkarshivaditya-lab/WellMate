// src/components/intelligence/WeeklySummaryCard.tsx
// Weekly comparison card for the Overview page.
// Shows this week vs last week deltas per domain.

import React from "react";
import { cn } from "@/lib/utils";
import { InsightCard } from "@/components/ui/insight-card";
import { TrendBadge } from "@/components/ui/trend-badge";
import { StatCell } from "@/components/ui/stat-cell";
import { generateWeeklySummaryText } from "@/intelligence/longitudinalEngine";
import type { WeeklyComparison } from "@/intelligence/types";

type Props = {
  comparison: WeeklyComparison;
  className?: string;
};

type DomainRow = {
  label: string;
  value: number | null;
  unit: string;
  trend: "up" | "down" | "stable";
};

export function WeeklySummaryCard({ comparison, className }: Props) {
  const { thisWeek, trends } = comparison;

  const avgSleepHours = thisWeek.sleepNights > 0
    ? Math.round((thisWeek.sleepAvgDurationMin / 60) * 10) / 10
    : null;
  const habitPct = thisWeek.habitsPossible > 0
    ? Math.round((thisWeek.habitsCompleted / thisWeek.habitsPossible) * 100)
    : null;

  const rows: DomainRow[] = [
    {
      label: "Sleep",
      value: avgSleepHours,
      unit: "h avg",
      trend: trends.sleep,
    },
    {
      label: "Exercise",
      value: thisWeek.exerciseSessions > 0 ? thisWeek.exerciseSessions : null,
      unit: "sessions",
      trend: trends.activity,
    },
    {
      label: "Nutrition",
      value: thisWeek.mealsLogged > 0 ? thisWeek.mealsLogged : null,
      unit: "meals",
      trend: trends.nutrition,
    },
    {
      label: "Habits",
      value: habitPct,
      unit: "% done",
      trend: trends.habits,
    },
  ];

  const summaryText = generateWeeklySummaryText(comparison);

  return (
    <InsightCard className={className}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">This week</p>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          vs last week
        </span>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </span>
            <div className="flex-1 min-w-0">
              {row.value !== null ? (
                <span className="text-sm font-semibold tabular-nums">
                  {row.value}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    {row.unit}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <TrendBadge trend={row.trend} size="sm" />
          </div>
        ))}
      </div>

      {summaryText && (
        <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/20 pt-3">
          {summaryText}
        </p>
      )}
    </InsightCard>
  );
}
