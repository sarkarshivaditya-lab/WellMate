// src/components/intelligence/WeeklySummaryCard.tsx
// Weekly comparison card for the Overview page.
// Shows this week vs last week deltas per domain.

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateWeeklySummaryText } from "@/intelligence/longitudinalEngine";
import type { WeeklyComparison } from "@/intelligence/types";

type Props = {
  comparison: WeeklyComparison;
  className?: string;
};

type DomainRow = {
  label: string;
  thisWeek: number | null;
  trend: "up" | "down" | "stable";
  unit: string;
};

function TrendBadge({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-amber-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/60" />;
}

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
      thisWeek: avgSleepHours,
      trend: trends.sleep,
      unit: "h avg",
    },
    {
      label: "Exercise",
      thisWeek: thisWeek.exerciseSessions > 0 ? thisWeek.exerciseSessions : null,
      trend: trends.activity,
      unit: "sessions",
    },
    {
      label: "Nutrition",
      thisWeek: thisWeek.mealsLogged > 0 ? thisWeek.mealsLogged : null,
      trend: trends.nutrition,
      unit: "meals",
    },
    {
      label: "Habits",
      thisWeek: habitPct,
      trend: trends.habits,
      unit: "% done",
    },
  ];

  const summaryText = generateWeeklySummaryText(comparison);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40",
        "bg-card/80 backdrop-blur-sm",
        "shadow-[0_1px_3px_rgba(20,60,50,0.05)]",
        "px-4 py-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">This week</p>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          vs last week
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{row.label}</span>
            <div className="flex-1 min-w-0">
              {row.thisWeek !== null ? (
                <span className="text-sm font-semibold tabular-nums">
                  {row.thisWeek}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    {row.unit}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <TrendBadge trend={row.trend} />
          </div>
        ))}
      </div>

      {summaryText && (
        <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/20 pt-3">
          {summaryText}
        </p>
      )}
    </div>
  );
}
