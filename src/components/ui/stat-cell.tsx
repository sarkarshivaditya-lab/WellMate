// src/components/ui/stat-cell.tsx
// Metric value + unit + label display primitive.
// Used in: activity summaries, physical dashboard, weekly comparison rows.
//
// Anatomy:
//   value  — the number (large, bold, tabular)
//   unit   — optional suffix (small, muted)
//   label  — what the metric represents (micro-label above or below)

import React from "react";
import { cn } from "@/lib/utils";

type StatCellSize = "sm" | "md" | "lg";

type Props = {
  label: string;
  value: string | number | null;
  unit?: string;
  size?: StatCellSize;
  labelPosition?: "above" | "below";
  className?: string;
};

const VALUE_SIZE: Record<StatCellSize, string> = {
  lg: "text-3xl font-bold tabular-nums",
  md: "text-xl font-semibold tabular-nums",
  sm: "text-sm font-semibold tabular-nums",
};

export function StatCell({
  label,
  value,
  unit,
  size = "md",
  labelPosition = "above",
  className,
}: Props) {
  const labelEl = (
    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
  );

  const valueEl = (
    <div className="flex items-baseline gap-1 flex-wrap">
      <span className={cn(VALUE_SIZE[size], value === null && "opacity-30")}>
        {value ?? "—"}
      </span>
      {unit && value !== null && (
        <span className="text-xs text-muted-foreground font-normal">{unit}</span>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {labelPosition === "above" && labelEl}
      {valueEl}
      {labelPosition === "below" && labelEl}
    </div>
  );
}
