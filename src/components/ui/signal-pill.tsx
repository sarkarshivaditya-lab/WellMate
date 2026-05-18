// src/components/ui/signal-pill.tsx
// Score card signal chip — a labelled metric with positive/caution/neutral polarity.
// Extracted from SleepScoreCard / HabitMomentumCard signal grids.
//
// Usage:
//   <SignalPill label="Duration" value="7h 20m" positive />

import React from "react";
import { cn } from "@/lib/utils";
import { signalColors } from "@/design/tokens";
import type { SignalPolarity } from "@/design/tokens";

type Props = {
  label: string;
  value: string;
  positive?: boolean;
  polarity?: SignalPolarity;  // overrides positive flag if provided
  className?: string;
};

export function SignalPill({ label, value, positive, polarity, className }: Props) {
  const resolved: SignalPolarity = polarity ?? (positive ? "positive" : "caution");
  const colors = signalColors[resolved];

  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5 space-y-0.5",
        colors.surface,
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-sm font-semibold", colors.text)}>{value}</p>
    </div>
  );
}
