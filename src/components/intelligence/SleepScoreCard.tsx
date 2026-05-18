// src/components/intelligence/SleepScoreCard.tsx
// Sleep intelligence card for the Sleep page.
// Surfaces sleep score, recovery readiness, debt, and key signals.

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import type { WellnessScore, SleepDebt } from "@/intelligence/types";

type Props = {
  sleepScore: WellnessScore;
  sleepDebt: SleepDebt;
  recoveryReadiness: { score: number; label: string; context: string };
  className?: string;
};

function TrendIcon({ trend }: { trend: WellnessScore["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-amber-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function SleepScoreCard({
  sleepScore,
  sleepDebt,
  recoveryReadiness,
  className,
}: Props) {
  if (sleepScore.dataQuality === "insufficient") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/30 bg-card/60 px-4 py-4",
          className,
        )}
      >
        <p className="text-sm font-medium">Sleep Intelligence</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {sleepScore.explanation}
        </p>
      </div>
    );
  }

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
          score={sleepScore.score}
          level={sleepScore.level}
          size={60}
          label="Sleep"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold leading-tight">{sleepScore.headline}</p>
            <TrendIcon trend={sleepScore.trend} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {sleepScore.explanation}
          </p>
        </div>
      </div>

      {/* Signal grid */}
      {sleepScore.signals.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {sleepScore.signals.slice(0, 4).map((sig) => (
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

      {/* Recovery readiness + debt row */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Recovery readiness
          </p>
          <p className={cn(
            "text-sm font-semibold mt-0.5",
            recoveryReadiness.score >= 70 ? "text-emerald-600 dark:text-emerald-400"
              : recoveryReadiness.score >= 45 ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}>
            {recoveryReadiness.label}
          </p>
        </div>

        {sleepDebt.hoursDebt > 0 && (
          <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Sleep debt (7d)
            </p>
            <p className="text-sm font-semibold mt-0.5 text-amber-600 dark:text-amber-400">
              −{sleepDebt.hoursDebt}h
            </p>
          </div>
        )}
      </div>

      {/* Recovery context */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {recoveryReadiness.context}
      </p>
    </div>
  );
}
