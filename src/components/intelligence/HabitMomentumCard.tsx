// src/components/intelligence/HabitMomentumCard.tsx
// Habit intelligence card for the Habits page.
// Shows momentum score, streak leaders, consistency, resilience.

import React from "react";
import { Flame, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import type { WellnessScore } from "@/intelligence/types";
import type { HabitStats } from "@/intelligence/habitIntelligence";

type Props = {
  habitScore: WellnessScore;
  habitStats: HabitStats[];
  className?: string;
};

export function HabitMomentumCard({ habitScore, habitStats, className }: Props) {
  if (habitScore.dataQuality === "insufficient") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/30 bg-card/60 px-4 py-4",
          className,
        )}
      >
        <p className="text-sm font-medium">Habit Intelligence</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {habitScore.explanation}
        </p>
      </div>
    );
  }

  const topHabits = [...habitStats]
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40",
        "bg-card/80 backdrop-blur-sm",
        "shadow-[0_1px_3px_rgba(20,60,50,0.05)]",
        "px-4 py-4 space-y-4",
        className,
      )}
    >
      {/* Score header */}
      <div className="flex items-center gap-4">
        <ScoreRing
          score={habitScore.score}
          level={habitScore.level}
          size={60}
          label="Habits"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{habitScore.headline}</p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {habitScore.explanation}
          </p>
        </div>
      </div>

      {/* Signal grid */}
      {habitScore.signals.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {habitScore.signals.slice(0, 4).map((sig) => (
            <div
              key={sig.label}
              className={cn(
                "rounded-xl px-3 py-2.5 space-y-0.5",
                sig.positive
                  ? "bg-emerald-500/8 border border-emerald-500/15"
                  : "bg-amber-500/8 border border-amber-500/15",
              )}
            >
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {sig.label}
              </p>
              <p className={cn(
                "text-sm font-semibold",
                sig.positive ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
              )}>
                {sig.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Top habits by streak */}
      {topHabits.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Streaks
          </p>
          {topHabits.map((hs) => (
            <div key={hs.habit.localId} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{hs.habit.title}</p>
                <div className="mt-0.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      hs.consistency30 >= 0.7
                        ? "bg-emerald-500"
                        : hs.consistency30 >= 0.4
                          ? "bg-amber-500"
                          : "bg-muted-foreground/40",
                    )}
                    style={{ width: `${Math.round(hs.consistency30 * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hs.streak > 0 ? (
                  <>
                    <Flame className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {hs.streak}d
                    </span>
                  </>
                ) : hs.bouncebacks > 0 ? (
                  <>
                    <RotateCcw className="h-3 w-3 text-sky-500" />
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {Math.round(hs.consistency30 * 100)}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(hs.consistency30 * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
