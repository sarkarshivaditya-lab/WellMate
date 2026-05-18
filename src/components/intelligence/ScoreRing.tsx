// src/components/intelligence/ScoreRing.tsx
// Reusable SVG arc score visualisation.
// Calm, minimal — not a dashboard widget, a quiet signal.

import React from "react";
import { cn } from "@/lib/utils";
import type { ScoreLevel } from "@/intelligence/types";

type Props = {
  score: number;       // 0-100
  level: ScoreLevel;
  size?: number;       // px, default 72
  strokeWidth?: number;
  label?: string;      // displayed below score
  className?: string;
};

const LEVEL_COLORS: Record<ScoreLevel, string> = {
  high: "text-emerald-500 dark:text-emerald-400",
  medium: "text-amber-500 dark:text-amber-400",
  low: "text-muted-foreground",
};

const LEVEL_STROKE: Record<ScoreLevel, string> = {
  high: "stroke-emerald-500 dark:stroke-emerald-400",
  medium: "stroke-amber-500 dark:stroke-amber-400",
  low: "stroke-muted-foreground/60",
};

export function ScoreRing({
  score,
  level,
  size = 72,
  strokeWidth = 5,
  label,
  className,
}: Props) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const dashOffset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted/40"
          />
          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn(
              "transition-all duration-500 ease-out",
              LEVEL_STROKE[level],
            )}
          />
        </svg>

        {/* Score number — centered in ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-lg font-bold tabular-nums leading-none",
              LEVEL_COLORS[level],
            )}
          >
            {progress}
          </span>
        </div>
      </div>

      {label && (
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}
