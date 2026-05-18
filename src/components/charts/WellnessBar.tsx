// src/components/charts/WellnessBar.tsx
// Horizontal progress / goal bar in the wellness aesthetic.
// Calm motion, teal/emerald palette, accessible contrast.
//
// Usage:
//   <WellnessBar value={65} />
//   <WellnessBar value={7.5} max={8} unit="h" label="Sleep target" />
//   <WellnessBar value={4} max={7} module="exercise" showLabel />

import React from "react";
import { cn } from "@/lib/utils";
import type { WellnessModule } from "@/design/tokens";

// Map module to fill color
const MODULE_FILL: Partial<Record<WellnessModule, string>> = {
  sleep:    "bg-indigo-400",
  exercise: "bg-blue-400",
  mood:     "bg-emerald-500",
  habit:    "bg-rose-400",
  meal:     "bg-amber-400",
  journal:  "bg-violet-400",
};

type Props = {
  value: number;           // current value
  max?: number;            // defaults to 100 (treat value as %)
  unit?: string;           // optional unit label
  label?: string;          // optional text label
  module?: WellnessModule; // drives fill color
  showPercent?: boolean;   // show percentage text inside bar
  height?: "sm" | "md" | "lg";
  className?: string;
};

const HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2",
};

export function WellnessBar({
  value,
  max = 100,
  unit,
  label,
  module,
  showPercent,
  height = "md",
  className,
}: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const fillColor = module
    ? (MODULE_FILL[module] ?? "bg-primary")
    : pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-primary"
        : "bg-amber-400";

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || unit) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          )}
          {unit && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {value}{unit} / {max}{unit}
            </span>
          )}
        </div>
      )}

      <div className={cn("w-full rounded-full bg-muted/40 overflow-hidden", HEIGHT[height])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            fillColor,
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>

      {showPercent && (
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">
          {Math.round(pct)}%
        </p>
      )}
    </div>
  );
}
