// src/components/intelligence/HabitMomentumCard.tsx
// Habit intelligence card for the Habits page.
// Shows momentum score, streak leaders, consistency, resilience.

import React from "react";
import { Flame, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { InsightCard, InsightCardHeader } from "@/components/ui/insight-card";
import { SignalPill } from "@/components/ui/signal-pill";
import { TrendBadge } from "@/components/ui/trend-badge";
import { WellnessBar } from "@/components/charts/WellnessBar";
import type { WellnessScore } from "@/intelligence/types";
import type { HabitStats } from "@/intelligence/habitIntelligence";

type Props = {
  habitScore: WellnessScore;
  habitStats: HabitStats[];
  className?: string;
};

export function HabitMomentumCard({ habitScore, habitStats, className }: Props) {
  const topHabits = [...habitStats]
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  return (
    <InsightCard
      insufficient={habitScore.dataQuality === "insufficient"}
      insufficientLabel="Habit Intelligence"
      insufficientBody={habitScore.explanation}
      className={className}
    >
      {/* Score header */}
      <InsightCardHeader
        leading={
          <ScoreRing
            score={habitScore.score}
            level={habitScore.level}
            size={60}
            label="Habits"
          />
        }
        title={habitScore.headline}
        body={habitScore.explanation}
        trailing={<TrendBadge trend={habitScore.trend} />}
      />

      {/* Signal grid */}
      {habitScore.signals.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {habitScore.signals.slice(0, 4).map((sig) => (
            <SignalPill
              key={sig.label}
              label={sig.label}
              value={sig.value}
              positive={sig.positive}
            />
          ))}
        </div>
      )}

      {/* Top habits by streak */}
      {topHabits.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Streaks
          </p>
          {topHabits.map((hs) => (
            <div key={hs.habit.localId} className="flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-medium truncate">{hs.habit.title}</p>
                <WellnessBar
                  value={Math.round(hs.consistency30 * 100)}
                  max={100}
                  module="habit"
                  height="sm"
                />
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
                    <span className="text-xs text-muted-foreground tabular-nums">
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
    </InsightCard>
  );
}
