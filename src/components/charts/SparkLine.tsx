// src/components/charts/SparkLine.tsx
// Wellness-aesthetic inline trend line.
// Replaces MiniLineChart — uses CSS vars, no hardcoded hex, calm motion.
//
// Usage:
//   <SparkLine data={[3,4,4,5,3,4]} />
//   <SparkLine data={moodHistory} module="mood" height={80} />

import React from "react";
import { cn } from "@/lib/utils";
import { moduleColors } from "@/design/tokens";
import type { WellnessModule } from "@/design/tokens";

// Map wellness modules to Tailwind stroke colors via currentColor
const MODULE_STROKE: Partial<Record<WellnessModule, string>> = {
  mood:     "text-emerald-500",
  sleep:    "text-indigo-400",
  exercise: "text-blue-400",
  habit:    "text-rose-400",
  meal:     "text-amber-400",
  journal:  "text-violet-400",
};

type Props = {
  data: number[];
  module?: WellnessModule;
  height?: number;
  width?: number;
  strokeWidth?: number;
  showDots?: boolean;
  showArea?: boolean;
  className?: string;
  emptyMessage?: string;
};

export function SparkLine({
  data,
  module,
  height = 80,
  width = 300,
  strokeWidth = 2,
  showDots = true,
  showArea = true,
  className,
  emptyMessage = "Not enough data yet",
}: Props) {
  const colorClass = module ? (MODULE_STROKE[module] ?? "text-primary") : "text-primary";

  if (data.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-muted/30",
          className,
        )}
        style={{ width, height }}
      >
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const padding = { x: 8, y: 8 };
  const chartW = width - padding.x * 2;
  const chartH = height - padding.y * 2;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const points = data.map((v, i) => ({
    x: padding.x + (i / (data.length - 1)) * chartW,
    y: padding.y + chartH - ((v - minVal) / range) * chartH,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = [
    linePath,
    `L ${points[points.length - 1].x.toFixed(1)},${(height - padding.y).toFixed(1)}`,
    `L ${points[0].x.toFixed(1)},${(height - padding.y).toFixed(1)} Z`,
  ].join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", colorClass, className)}
      aria-hidden
    >
      {/* Area fill */}
      {showArea && (
        <path
          d={areaPath}
          fill="currentColor"
          fillOpacity="0.08"
          strokeWidth={0}
        />
      )}

      {/* Trend line */}
      <path
        d={linePath}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500 ease-out"
      />

      {/* Data points */}
      {showDots && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill="currentColor"
          className="transition-all duration-500 ease-out"
        />
      ))}
    </svg>
  );
}
